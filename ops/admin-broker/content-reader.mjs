/** Live editorial content, pinned to one Git head; no frontend code updates on content publish. */
import YAML from 'yaml';import {requirePolicy} from './policy.mjs';
const PATH=/^src\/content\/(articles|essays|fragments)\/[\p{L}\p{N}][\p{L}\p{N}_.-]{0,180}\.md$/u;
export function editorialStory(path,text,blobSha){
 requirePolicy(PATH.test(path)&&typeof text==='string'&&Buffer.byteLength(text)<=1_000_000,'内容文件超出读取范围。');
 const front=text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);requirePolicy(front&&front[1].length<=32000,'内容frontmatter无效。');const data=YAML.parseDocument(front[1]).toJS({maxAliasCount:0});requirePolicy(data&&typeof data.slug==='string'&&['draft','published','archived'].includes(data.status),'内容元数据无效。');
 const collection=path.split('/')[2],type={articles:'Article',essays:'Essay',fragments:'Fragment'}[collection],body=text.slice(front[0].length);
 const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?value.slice(0,10):'';
 return {id:{articles:'article',essays:'essay',fragments:'fragment'}[collection]+'-'+data.slug,type,title:data.title||(collection==='fragments'?body.trim().slice(0,60):data.slug),deck:data.description||data.summary||'',body,status:data.status,slug:data.slug,categories:Array.isArray(data.categories)?data.categories:[],tags:Array.isArray(data.tags)?data.tags:[],publishedAt:date(data.publishedAt),updatedAt:date(data.updatedAt||data.publishedAt),showOnHomepage:data.homepage?.show===true,featured:data.featured===true,cover:data.cover||data.image||'',coverAlt:data.coverAlt||data.imageAlt||'',publishNumber:data.publishNumber,sourcePath:path,sourceBlobSha:blobSha};
}
export function createContentReader({github,repository,branch}){
 const [owner,repo]=repository.split('/');let cached;
 return async()=>{
  const head=(await github(`/repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`)).object?.sha;requirePolicy(/^[a-f0-9]{40}$/.test(head||''),'分支版本无效。');if(cached?.head===head)return cached;
  const tree=await github(`/repos/${repository}/git/trees/${head}?recursive=1`);requirePolicy(!tree.truncated&&Array.isArray(tree.tree),'仓库内容树不完整。');const files=tree.tree.filter(f=>f.type==='blob'&&PATH.test(f.path));requirePolicy(files.length<=300&&files.every(f=>/^[a-f0-9]{40}$/.test(f.sha)&&f.size<=1_000_000),'内容清单超限。');const stories=[];
  for(let index=0;index<files.length;index+=30){const chunk=files.slice(index,index+30),query=`query {repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(repo)}){${chunk.map((file,i)=>`f${i}:object(oid:${JSON.stringify(file.sha)}){...on Blob{text}}`).join(' ')}}}`;
   const result=await github('/graphql',{method:'POST',body:JSON.stringify({query})});requirePolicy(!result.errors&&result.data?.repository,'内容读取失败。');for(const [i,file]of chunk.entries())stories.push(editorialStory(file.path,result.data.repository['f'+i]?.text,file.sha));
  }
  stories.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.id.localeCompare(b.id));cached={head,stories};return cached;
 };
}
