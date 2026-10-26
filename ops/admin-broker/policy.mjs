/** Server-side limits for Editorial Studio and pinned Sveltia GitHub backend. */
import {parse,Kind,valueFromASTUntyped,visit} from 'graphql';
import {parseFragment} from 'parse5';
import YAML from 'yaml';
export function requirePolicy(ok,message){if(!ok)throw Object.assign(Error(message),{status:403});}
const CONTENT=/^src\/content\/(articles|essays|fragments|projects|images)\/[\p{L}\p{N}][\p{L}\p{N}_.-]{0,180}\.md$/u;
const MEDIA=/^public\/uploads\/(?:[\p{L}\p{N}][\p{L}\p{N}_.-]*\/)*[\p{L}\p{N}][\p{L}\p{N}_.-]{0,180}\.(png|jpe?g|gif|webp|avif|svg)$/iu;
export function permittedPath(path){return typeof path==='string'&&path.length<250&&(CONTENT.test(path)||MEDIA.test(path));}
function decodeContents(value){
 requirePolicy(typeof value==='string'&&value.length<=11_000_000&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value),'文件内容不是受支持的base64。');
 const data=Buffer.from(value,'base64');requirePolicy(data.length<=8_000_000,'单文件不得超过8MB。');return data;
}
const SVG_TAGS=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','defs','linearGradient','radialGradient','stop','clipPath','mask','pattern','symbol','use','title','desc','image']);
export function validateSvg(text){
 requirePolicy(!/<!DOCTYPE|<!ENTITY|<\?|<!\[CDATA/i.test(text),'SVG包含不允许的文档指令。');
 const root=parseFragment(text);let found=false;
 function walk(node){
  if(node.nodeName==='#text'||node.nodeName==='#comment')return;
  if(node.tagName){
   requirePolicy(node.namespaceURI==='http://www.w3.org/2000/svg'&&SVG_TAGS.has(node.tagName),'SVG包含动态或不支持的元素。');if(node.tagName==='svg')found=true;
   for(const attr of node.attrs??[]){
    requirePolicy(!/^on/i.test(attr.name)&&!['style','src','srcset'].includes(attr.name),'SVG包含活动属性。');
    if(attr.name==='href')requirePolicy(/^#[A-Za-z0-9_-]+$/.test(attr.value)||node.tagName==='image'&&/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(attr.value),'SVG外部引用不允许。');
    requirePolicy(!/url\(/i.test(attr.value)||/^url\(#[A-Za-z0-9_-]+\)$/.test(attr.value),'SVG外部样式引用不允许。');
   }
  }
  for(const child of node.childNodes??[])walk(child);
 }
 for(const node of root.childNodes)walk(node);requirePolicy(found,'无有效SVG根元素。');
}
export function validateAddition({path,contents}){
 requirePolicy(permittedPath(path),'只能修改内容集合和上传图片。');const body=decodeContents(contents);
 requirePolicy(!/-----BEGIN (?:[A-Z ]*PRIVATE KEY)|github_pat_[A-Za-z0-9_]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-proj-[A-Za-z0-9_-]{30,}/.test(body.toString('utf8')),'内容可能含私钥或Token，已拒绝发布。');
 if(CONTENT.test(path)){
  requirePolicy(body.length<=1_000_000,'Markdown文件过大。');const text=new TextDecoder('utf-8',{fatal:true}).decode(body),front=text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  requirePolicy(front&&front[1].length<=32_000,'缺少有效frontmatter。');const doc=YAML.parseDocument(front[1]);requirePolicy(!doc.errors.length,'frontmatter格式错误。');const data=doc.toJS({maxAliasCount:0});
  requirePolicy(data&&typeof data==='object'&&!Array.isArray(data),'frontmatter须为对象。');
  requirePolicy(['draft','published','archived'].includes(data.status),'内容状态错误。');requirePolicy(typeof data.slug==='string'&&/^[\p{L}\p{N}][\p{L}\p{N}-]{0,180}$/u.test(data.slug),'URL slug无效。');
  const collection=path.split('/')[2];
  for(const field of ['publishedAt','updatedAt','startedAt','capturedAt'])if(Object.hasOwn(data,field))requirePolicy(typeof data[field]==='string'&&/^\d{4}-\d{2}-\d{2}/.test(data[field])&&Number.isFinite(Date.parse(data[field])),`${field}须为有效日期；未填写的可选日期应省略。`);
  if(['articles','essays'].includes(collection))requirePolicy(typeof data.title==='string'&&data.title.trim(),'缺少标题。');
  if(collection==='projects')requirePolicy(typeof data.name==='string'&&data.name.trim(),'项目缺少名称。');
  if(collection==='images')requirePolicy(typeof data.image==='string'&&data.image&&typeof data.alt==='string'&&data.alt.trim(),'影像缺少图片或说明。');
  if(collection!=='projects')requirePolicy(typeof data.publishedAt==='string'&&/^\d{4}-\d{2}-\d{2}/.test(data.publishedAt)&&Number.isFinite(Date.parse(data.publishedAt)),'缺少有效日期。');
  if(data.cover)requirePolicy(typeof data.coverAlt==='string'&&data.coverAlt.trim(),'封面缺少说明。');
  if(path.startsWith('src/content/articles/')&&data.status!=='draft')requirePolicy(Number.isSafeInteger(data.publishNumber)&&data.publishNumber>0&&typeof data.description==='string'&&data.description.trim(),'文章缺少编号或描述。');
 }else{
  const ext=path.split('.').at(-1).toLowerCase();let valid=false;
  if(ext==='png')valid=body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(['jpg','jpeg'].includes(ext))valid=body[0]===255&&body[1]===216&&body[2]===255;
  if(ext==='gif')valid=['GIF87a','GIF89a'].includes(body.subarray(0,6).toString('ascii'));
  if(ext==='webp')valid=body.subarray(0,4).toString()==='RIFF'&&body.subarray(8,12).toString()==='WEBP';
  if(ext==='avif')valid=body.subarray(4,8).toString()==='ftyp'&&['avif','avis'].includes(body.subarray(8,12).toString());
  if(ext==='svg'){validateSvg(new TextDecoder('utf-8',{fatal:true}).decode(body));valid=true;}
  requirePolicy(valid,'图片扩展名与内容不匹配，或SVG包含不安全内容。');
 }
 return body.length;
}
export function validateCommit(input,config){
 requirePolicy(config.allowMain===true||config.branch!=='main','main写入尚未启用。');
 requirePolicy(input?.branch?.repositoryNameWithOwner===config.repository&&input?.branch?.branchName===config.branch,'不能写入其他仓库或分支。');
 requirePolicy(/^[a-f0-9]{40}$/.test(input.expectedHeadOid||''),'必须指定准确的当前提交。');
 requirePolicy(typeof input.message?.headline==='string'&&input.message.headline.trim()&&input.message.headline.length<=200,'提交说明错误。');
 const additions=input.fileChanges?.additions??[],deletions=input.fileChanges?.deletions??[];
 requirePolicy(Array.isArray(additions)&&Array.isArray(deletions)&&additions.length+deletions.length>0&&additions.length+deletions.length<=64,'文件变更数量错误。');
 const paths=new Set();let total=0;
 for(const file of [...additions,...deletions]){requirePolicy(permittedPath(file.path)&&!paths.has(file.path),'重复文件或不允许的路径。');paths.add(file.path);}
 for(const file of additions)total+=validateAddition(file);requirePolicy(total<=20_000_000,'本次发布资源总量超过20MB。');
 return {paths:[...paths],bytes:total};
}
export function authorizeGraphql(body,config){
 requirePolicy(typeof body?.query==='string'&&body.query.length<=120_000,'GraphQL请求过大或缺失。');const ast=parse(body.query,{maxTokens:20000}),operations=ast.definitions.filter(x=>x.kind===Kind.OPERATION_DEFINITION);
 requirePolicy(operations.length===1&&ast.definitions.length===1,'仅允许单一操作，不接受片段定义。');const operation=operations[0],variables=body.variables??{};let nodes=0;
 visit(ast,{enter(){requirePolicy(++nodes<=15000,'GraphQL结构过大。');}});
 const fields=operation.selectionSet.selections;requirePolicy(fields.every(x=>x.kind===Kind.FIELD),'不允许根片段。');
 if(operation.operation==='mutation'){
  requirePolicy(fields.length===1&&fields[0].name.value==='createCommitOnBranch','不允许其他GitHub写操作。');const args=fields[0].arguments;
  requirePolicy(args.length===1&&args[0].name.value==='input','写操作参数错误。');const input=valueFromASTUntyped(args[0].value,variables);validateCommit(input,config);return {mutation:true,input};
 }
 requirePolicy(operation.operation==='query','不接受订阅。');const [owner,repo]=config.repository.split('/');
 for(const field of fields){
  requirePolicy(field.name.value==='repository','只允许读取指定仓库。');const args=Object.fromEntries(field.arguments.map(x=>[x.name.value,valueFromASTUntyped(x.value,variables)]));
  requirePolicy(args.owner===owner&&args.name===repo,'不允许读取其他仓库。');
 }
 return {mutation:false};
}
