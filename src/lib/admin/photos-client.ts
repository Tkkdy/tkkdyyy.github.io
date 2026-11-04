import {validateAlbumFields} from '../photo-albums.mjs';
import YAML from 'yaml';
import {photoUploadDataUrl} from './photo-upload';
import {createCloudDraftClient} from './cloud-drafts.mjs';
import {readAdminSession,createGitHubClient,textToBase64} from './github-content.mjs';
import {dataUrlFile} from './publish-story.mjs';
import {editorLink} from './editor-links.mjs';

type Resource={type:string;sourcePath:string;sourceBlobSha:string;rawContent:string;title:string;status?:string;slug?:string};
const IMAGE_PATH=/^src\/content\/images\/[\p{L}\p{N}][\p{L}\p{N}_.-]{0,180}\.md$/u;
const SLUG=/^[\p{L}\p{N}][\p{L}\p{N}-]{0,180}$/u;
async function api(path:string){const r=await fetch(path,{credentials:'same-origin',cache:'no-store'});const body=await r.json();if(!r.ok)throw Error(body.error||'读取失败，请确认登录状态。');return body;}
function documentOf(raw:string){const front=raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);if(!front)throw Error('照片元数据格式无效。');const doc=YAML.parseDocument(front[1]);if(doc.errors.length)throw Error('照片元数据格式无效。');doc.toJS({maxAliasCount:0});return {doc,body:raw.slice(front[0].length)};}
function photoURL(value:string){if(value.startsWith('/')&&!value.startsWith('//'))return new URL(value,'https://tkkdy.me').href;if(value.startsWith('data:image/webp;base64,'))return value;try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{}return '';}
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}

export async function initializePhotoLibrary(){
 const list=document.querySelector<HTMLElement>('[data-photo-list]'),message=document.querySelector<HTMLElement>('[data-photo-list-message]');if(!list||!message)return;
 try{
  const auth=await readAdminSession();if(!auth.privateDrafts)throw Error('请在私人编辑台登录后管理照片。');
  const [catalog,privateDrafts]=await Promise.all([api('/api/stories'),api('/api/drafts')]);
  const photos:Resource[]=(catalog.resources||[]).filter((item:Resource)=>item.type==='Image');
  list.replaceChildren();
  for(const item of [...privateDrafts.drafts.filter((d:{type:string})=>d.type==='Image'),...photos]){
   const link=document.createElement('a');link.className='photo-list-card';link.href=editorLink(item);
   if(item.rawContent){const data=documentOf(item.rawContent).doc.toJS({maxAliasCount:0}),url=photoURL(String(data.image||''));if(url){const image=document.createElement('img');image.src=url;image.alt=String(data.alt||'');image.loading='lazy';link.append(image);}}
   const title=document.createElement('strong');title.textContent=item.title||'未命名照片';const note=document.createElement('small');note.textContent=item.key?'私有草稿 · 继续编辑':item.status==='published'?'已发布 · 编辑照片':'仓库内容 · '+(item.status||'draft');link.append(title,note);list.append(link);
  }
  message.textContent=`${photos.length} 张仓库照片，${privateDrafts.drafts.filter((d:{type:string})=>d.type==='Image').length} 份私有照片草稿。`;
 }catch(e){message.textContent=e instanceof Error?e.message:'照片读取失败。';}
}

export async function initializePhotoEditor(){
 const form=document.querySelector<HTMLFormElement>('[data-photo-form]')!,message=document.querySelector<HTMLElement>('[data-photo-message]');if(!form||!message)return;
 const figure=form.querySelector<HTMLElement>('[data-photo-figure]')!,preview=form.querySelector<HTMLImageElement>('[data-photo-preview]')!,file=form.elements.namedItem('photo') as HTMLInputElement,submit=form.querySelector<HTMLButtonElement>('[type=submit]')!;
 const value=(name:string)=>(form.elements.namedItem(name) as HTMLInputElement|HTMLTextAreaElement).value.trim();
 let timer=0,dirty=false,composing=false,busy=false,processing=false,sequence=0,attempted=false;
 try{
  const auth=await readAdminSession();if(!auth.privateDrafts||auth.publicationMode!=='pull-request')throw Error('请在支持私有草稿和发布提案的私人编辑台使用此页。');
  const query=new URL(location.href).searchParams,source=query.get('source'),draft=query.get('draft');
  if(source&&!IMAGE_PATH.test(source))throw Error('照片路径无效。');
  if(draft&&!/^draft-photo-[a-f0-9-]{36}$/.test(draft))throw Error('照片草稿标识无效。');
  const key=source||draft||'draft-photo-'+crypto.randomUUID();
  if(!source&&!draft){const url=new URL(location.href);url.searchParams.set('draft',key);history.replaceState(null,'',url);}
  const client=createCloudDraftClient({key,session:readAdminSession});
  const [live,saved]=await Promise.all([source?api('/api/content?path='+encodeURIComponent(source)):Promise.resolve(null),client.load()]);
  if(live&&live.resource?.type!=='Image')throw Error('此内容不是照片。');
  const publishedMatches=Boolean(live&&saved?.state?.publication?.publishedContent===live.resource.rawContent);
  const initial=publishedMatches?live.resource.rawContent:(saved?.state?.rawContent||live?.resource.rawContent);
  const parsed=initial?documentOf(initial):{doc:new YAML.Document({slug:'photo-'+key.slice(-12),image:'',alt:'',publishedAt:today(),status:'draft',window:{enabled:false,timeOfDay:[],seasons:[]}}),body:''};
  const doc=parsed.doc,data=doc.toJS({maxAliasCount:0}),baseline=publishedMatches?live.resource.sourceBlobSha:(saved?.state?.sourceBlobSha||live?.resource.sourceBlobSha||'');
  let image=String(data.image||''),publication=publishedMatches?null:(saved?.state?.publication||null);
  attempted=Boolean(publication);
  for(const name of ['title','alt','caption','capturedAt','location','slug','series','frameDescription']){const control=form.elements.namedItem(name) as HTMLInputElement|HTMLTextAreaElement;control.value=String(data[name]??'');if(name==='capturedAt')control.value=control.value.slice(0,10);}
  (form.elements.namedItem('albumCover') as HTMLInputElement).checked=data.albumCover===true;
  (form.elements.namedItem('frameDisplay') as HTMLSelectElement).value=data.frameDisplay||'information';
  (form.elements.namedItem('tags') as HTMLTextAreaElement).value=(data.tags||[]).join('\n');
  (form.elements.namedItem('window.enabled') as HTMLInputElement).checked=data.window?.enabled===true;
  (form.elements.namedItem('window.note') as HTMLInputElement).value=String(data.window?.note||'');
  for(const name of ['timeOfDay','seasons'])for(const control of form.querySelectorAll<HTMLInputElement>(`[name="window.${name}"]`))control.checked=Array.isArray(data.window?.[name])&&data.window[name].includes(control.value);
  function showImage(){const url=photoURL(image);preview.src=url;figure.hidden=!url;preview.alt=value('alt')||'待编辑照片预览';file.required=!image;(form.querySelector('[data-photo-caption]') as HTMLElement).textContent=value('caption');}
  function snapshot(){
   for(const name of ['title','alt','caption','capturedAt','location','slug','series','frameDescription']){const text=value(name);if(text)doc.set(name,text);else doc.delete(name);}
   doc.set('albumCover',(form.elements.namedItem('albumCover') as HTMLInputElement).checked);doc.set('frameDisplay',(form.elements.namedItem('frameDisplay') as HTMLSelectElement).value);
   doc.set('image',image);doc.set('tags',value('tags').split('\n').map(x=>x.trim()).filter(Boolean));
   doc.setIn(['window','enabled'],(form.elements.namedItem('window.enabled') as HTMLInputElement).checked);
   for(const name of ['timeOfDay','seasons'])doc.setIn(['window',name],[...form.querySelectorAll<HTMLInputElement>(`[name="window.${name}"]:checked`)].map(x=>x.value));
   const note=value('window.note');if(note)doc.setIn(['window','note'],note);else doc.deleteIn(['window','note']);
   return {id:key,title:value('title')||value('alt')||'未命名照片',type:'Image',status:'draft',sourcePath:source||`src/content/images/${value('slug')}.md`,sourceBlobSha:baseline,rawContent:'---\n'+doc.toString()+'---\n'+parsed.body,...(publication?{publication}:{})};
  }
  function lockFields(locked:boolean){for(const control of form.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('input,textarea,select'))control.disabled=locked;(form.querySelector<HTMLButtonElement>('[data-photo-save]')!).disabled=locked;}
  async function save(){if(processing)throw Error('照片仍在处理中，请稍候。');const state=snapshot();await client.save(state);dirty=snapshot().rawContent!==state.rawContent;message!.textContent='已保存到云端 · 私有照片草稿';return state;}
  const batch=query.get('batch'),backLink=document.querySelector<HTMLAnchorElement>('[data-photo-back]');
  if(batch&&/^[a-f0-9-]{36}$/.test(batch)&&backLink){backLink.href='/admin/photos/upload/?batch='+encodeURIComponent(batch);backLink.textContent='返回本组选图';backLink.addEventListener('click',async event=>{if(!dirty)return;event.preventDefault();if(processing||busy){message!.textContent='请等照片处理和保存完成后再返回。';return;}clearTimeout(timer);try{await save();location.assign(backLink.href);}catch(e){message!.textContent=e instanceof Error?e.message:'保存失败，请保留此页或下载备份。';}});}
  async function safeSave(){try{await save();}catch(e){dirty=true;message!.textContent=(e instanceof Error?e.message:'保存失败。')+' 当前照片仍在此页，可下载备份。';}}
  function schedule(){dirty=true;clearTimeout(timer);showImage();if(!composing&&!busy&&!processing&&!attempted)timer=window.setTimeout(()=>void safeSave(),900);}
  form.addEventListener('input',event=>{if(event.target!==file)schedule();});form.addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer);});form.addEventListener('compositionend',()=>{composing=false;schedule();});
  file.addEventListener('change',async()=>{
   const selected=file.files?.[0];if(!selected)return;
   if(selected.size>8_000_000){message!.textContent='照片不得超过 8 MB，请缩小后再上传。';return;}
   const current=++sequence;processing=true;clearTimeout(timer);submit.disabled=true;message!.textContent='正在处理照片并去除敏感元数据……';
   try{const converted=await photoUploadDataUrl(selected);if(current!==sequence)return;image=converted;showImage();dirty=true;}
   catch(e){message!.textContent=e instanceof Error?e.message:'无法读取这张照片，请使用 JPEG、PNG 或 WebP。';}
   finally{if(current===sequence){processing=false;submit.disabled=attempted;if(dirty)schedule();}}
  });
  form.querySelector('[data-photo-save]')?.addEventListener('click',()=>void safeSave());
  form.querySelector('[data-photo-download]')?.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='private-photo-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(busy||processing||attempted)return;busy=true;clearTimeout(timer);submit.disabled=true;lockFields(true);
   try{
    if(!image)throw Error('请先选择照片。');if(!value('alt'))throw Error('请填写照片说明。');if(!SLUG.test(value('slug')))throw Error('网址标识只能包含文字、数字和连字符。');
    const state=await save(),catalog=await api('/api/stories'),resources:Resource[]=catalog.resources||[];
    const path=source||`src/content/images/${value('slug')}.md`,current=resources.find(item=>item.sourcePath===path);
    if(source?current?.sourceBlobSha!==baseline:Boolean(current))throw Error('这张照片的仓库版本已变化，请保留草稿并核对后再发布。');
    if(resources.some(item=>item.type==='Image'&&item.sourcePath!==source&&item.slug===value('slug')))throw Error('网址标识已被其他照片使用，请换一个。');
    const publishDoc=documentOf(state.rawContent).doc;publishDoc.set('status','published');if(!publishDoc.get('publishedAt'))publishDoc.set('publishedAt',today());
    validateAlbumFields(publishDoc.toJS({maxAliasCount:0}));
    const uploads:{path:string;contentBase64:string}[]=[];
    if(image.startsWith('data:')){const upload=await dataUrlFile(image,'photo-'+value('slug'));publishDoc.set('image',upload.publicPath);uploads.push({path:upload.gitPath,contentBase64:upload.contentBase64});}
    const raw='---\n'+publishDoc.toString()+'---\n'+parsed.body;if(raw.includes('data:image/'))throw Error('照片尚未转换为发布资源。');
    const session=await readAdminSession(),github=createGitHubClient({owner:'Tkkdy',repo:'tkkdyyy.github.io',branch:session.branch,csrf:session.csrf});
    if(document.querySelector('meta[name="editor-local-preview"]')){message!.textContent='本地预览：照片已通过发布检查并保存私有草稿，未创建提案、未更新线上网站。';return;}
    // Persist the write attempt before GitHub I/O: even a reload cannot blindly replay an unknown result.
    publication={state:'pending'};await client.save(snapshot());attempted=true;
    const result=await github.proposeFiles({expectedHeadOid:catalog.head,message:'Publish photo: '+value('slug'),files:[...uploads,{path,contentBase64:textToBase64(raw)}]});
    publication={state:'proposed',url:result.proposal.url,publishedContent:raw};await client.save(snapshot());
    message!.textContent='照片发布提案已创建，CI 与合并完成后上线。';const link=document.createElement('a');link.href=result.proposal.url;link.textContent='查看发布进度';message!.append(' ',link);
   }catch(e){message!.textContent=(e instanceof Error?e.message:'发布未确认。')+(attempted?' 请先核对发布提案，不要重复提交。':'');}
   finally{busy=false;submit.disabled=attempted;lockFields(attempted);}
  });
  showImage();form.hidden=false;submit.disabled=attempted;lockFields(attempted);
  if(attempted){message.textContent='这份草稿已有发布尝试，请先核对提案状态；发布后从照片列表打开最新照片继续编辑。';if(/^https:\/\/github\.com\/Tkkdy\/tkkdyyy\.github\.io\/pull\/\d+$/.test(publication.url||'')){const link=document.createElement('a');link.href=publication.url;link.textContent='查看发布进度';message.append(' ',link);}}
  else message.textContent=saved?'已恢复私有照片草稿，尚未公开。':'照片只会保存在私有草稿，点击发布后才进入公开发布流程。';
 }catch(e){message.textContent=e instanceof Error?e.message:'照片编辑器载入失败。';}
}
