import YAML from 'yaml';
import {marked} from 'marked';
import {sanitizeAdminHtml} from './safe-preview.mjs';
import {createCloudDraftClient} from './cloud-drafts.mjs';
import {readAdminSession,createGitHubClient,textToBase64} from './github-content.mjs';
import {dataUrlFile} from './publish-story.mjs';
type Field={name:string;label:string;widget:string;required?:boolean;options?:string[]};
export async function initializeResourceEditor(){
 const root=document.querySelector<HTMLElement>('.resource-editor');if(!root)return;
 const message=root.querySelector<HTMLElement>('[data-resource-message]')!;
 const form=root.querySelector<HTMLFormElement>('form')!;
 const body=form.querySelector<HTMLTextAreaElement>('[name="resource-body"]')!;
 const container=form.querySelector<HTMLElement>('[data-resource-fields]')!;
 const source=new URL(location.href).searchParams.get('source');
 let timer=0,dirty=false,composing=false,submitting=false,failedPublication=false;
 try{
  const session=await readAdminSession();if(!session.privateDrafts||!source)throw Error('请从云端内容目录选择项目或影像；本机继续使用 Sveltia 备用编辑器。');
  const load=async()=>{const r=await fetch('/api/content?path='+encodeURIComponent(source),{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('内容读取失败。');return r.json();};
  const live=await load(),resource=live.resource,client=createCloudDraftClient({key:source,session:readAdminSession}),saved=await client.load();
  const initial=saved?.state?.rawContent||resource.rawContent;
  let sourceBlobSha=saved?.state?.sourceBlobSha||resource.sourceBlobSha;
  const front=initial.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);if(!front)throw Error('内容格式无效。');
  const doc=YAML.parseDocument(front[1]);let data=doc.toJS({maxAliasCount:0});body.value=initial.slice(front[0].length);
  const schema=await(await fetch('/admin/content-schema.json',{credentials:'same-origin',cache:'no-store'})).json();
  const fields:Field[]=schema.collections.find((c:{name:string})=>source.includes('/'+c.name+'/'))?.fields||[];
  const controls=new Map<string,HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>();
  for(const field of fields){
   if(field.name==='body'||['object'].includes(field.widget)||field.widget==='list'&&Array.isArray(data[field.name])&&data[field.name].some((v:unknown)=>typeof v==='object'))continue;
   const label=document.createElement('label');label.textContent=field.label;
   let control:HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
   if(field.widget==='select') {control=document.createElement('select');for(const option of field.options||[]){const node=document.createElement('option');node.value=node.textContent=option;control.append(node);}}
   else if(['text','list','richtext'].includes(field.widget)){control=document.createElement('textarea');control.rows=field.widget==='list'?3:4;}
   else {control=document.createElement('input');control.type=field.widget==='boolean'?'checkbox':field.widget==='number'?'number':'text';}
   if(control instanceof HTMLInputElement&&control.type==='checkbox')control.checked=Boolean(data[field.name]);
   else control.value=Array.isArray(data[field.name])?data[field.name].join('\n'):String(data[field.name]??'');
   control.name=field.name;control.required=field.required!==false&&field.widget!=='boolean';label.append(control);controls.set(field.name,control);
   if(field.widget==='image'){
    const file=document.createElement('input');file.type='file';file.accept='image/png,image/jpeg,image/webp,image/gif,image/avif';file.setAttribute('aria-label','上传'+field.label);
    file.addEventListener('change',()=>{const image=file.files?.[0];if(!image)return;if(image.size>8_000_000){message.textContent='图片不得超过8 MB。';return;}const reader=new FileReader();reader.onload=()=>{control.value=String(reader.result);schedule();};reader.readAsDataURL(image);});label.append(file);
   }
   container.append(label);
  }
  function snapshot(){
   for(const field of fields){const control=controls.get(field.name);if(!control)continue;let value:unknown=control instanceof HTMLInputElement&&control.type==='checkbox'?control.checked:field.widget==='list'?control.value.split('\n').map(s=>s.trim()).filter(Boolean):field.widget==='number'&&control.value?Number(control.value):control.value;
    if(value===''&&field.required===false){doc.delete(field.name);delete data[field.name];}else{doc.set(field.name,value);data[field.name]=value;}
   }
   return {id:'resource-'+data.slug,title:data.name||data.title||data.slug,type:resource.type,sourcePath:source!,sourceBlobSha,rawContent:'---\n'+doc.toString()+'---\n'+body.value};
  }
  async function save(){const state=snapshot();await client.save(state);dirty=JSON.stringify(snapshot())!==JSON.stringify(state);message.textContent='已保存到云端 · 私有草稿';return state;}
  async function safeSave(){try{await save();}catch(e){dirty=true;message.textContent=(e instanceof Error?e.message:'保存失败。')+' 当前内容仍在此页，可下载备份。';}}
  function schedule(){dirty=true;clearTimeout(timer);if(!composing&&!submitting)timer=window.setTimeout(()=>void safeSave(),900);}
  form.addEventListener('input',schedule);form.addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer);});form.addEventListener('compositionend',()=>{composing=false;schedule();});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  root.querySelector('[data-resource-save]')?.addEventListener('click',()=>void safeSave());
  root.querySelector('[data-resource-download]')?.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='editorial-resource.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  root.querySelector('[data-resource-preview]')?.addEventListener('click',()=>{const preview=root.querySelector<HTMLElement>('[data-resource-preview-body]')!;preview.innerHTML=sanitizeAdminHtml(marked.parse(body.value,{async:false}));preview.hidden=false;});
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(submitting||failedPublication)return;submitting=true;clearTimeout(timer);const button=form.querySelector<HTMLButtonElement>('[type="submit"]')!;button.disabled=true;
   try{
    const state=await save();if(data.status==='draft')throw Error('私有草稿已保存；请选择已发布状态后再发布。');
    const latest=await load();if(latest.resource.sourceBlobSha!==sourceBlobSha)throw Error('仓库内容已变化，请下载草稿并比较后继续。');
    const auth=await readAdminSession(),github=createGitHubClient({owner:'Tkkdy',repo:'tkkdyyy.github.io',branch:auth.branch,csrf:auth.csrf});
    const uploads:{path:string;contentBase64:string}[]=[];
    const publishDoc=YAML.parseDocument(state.rawContent.match(/^---\n([\s\S]*?)\n---/)![1]);
    for(const field of fields){const control=controls.get(field.name);if(field.widget==='image'&&control?.value.startsWith('data:')){const upload=await dataUrlFile(control.value,'resource-'+data.slug+'-'+field.name);publishDoc.set(field.name,upload.publicPath);uploads.push({path:upload.gitPath,contentBase64:upload.contentBase64});}}
    const content='---\n'+publishDoc.toString()+'---\n'+body.value;
    if(content.includes('data:image/'))throw Error('仍有未上传图片，请检查内容。');
    // A write with an unknown result is never replayed automatically.
    failedPublication=true;
    const result=await github.proposeFiles({expectedHeadOid:latest.head,message:'Publish '+resource.type+': '+data.slug,files:[...uploads,{path:source!,contentBase64:textToBase64(content)}]});
    message.textContent='内容提案已创建，等待必需 CI 与合并。';const link=document.createElement('a');link.href=result.proposal.url;link.textContent='查看发布提案';message.append(' ',link);
   }catch(error){message.textContent=error instanceof Error?error.message:'发布失败，请保留草稿。';}finally{submitting=false;button.disabled=failedPublication;}
  });
  message.textContent='已载入；修改自动保存为私有草稿。复杂项目配置保留原值，必要时使用本地 Sveltia。';form.hidden=false;
 }catch(error){message.textContent=error instanceof Error?error.message:'载入失败。';}
}
