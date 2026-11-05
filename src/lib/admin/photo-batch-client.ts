import {showPhotoPublication} from './photo-publication-status';
import {PUBLICATION_MAX_BYTES} from '../publication-limits.mjs';
import {validateAlbumFields,groupPhotoAlbums} from '../photo-albums.mjs';
import YAML from 'yaml';
import {photoUploadDataUrl,PHOTO_SOURCE_MAX_BYTES} from './photo-upload';
import {createCloudDraftClient} from './cloud-drafts.mjs';
import {readAdminSession,createGitHubClient,textToBase64} from './github-content.mjs';
import {dataUrlFile} from './publish-story.mjs';

type Publication={state:string;url?:string;publishedContent?:string};
type PhotoState={id:string;title:string;type:string;status:string;sourcePath:string;sourceBlobSha:string;rawContent:string;publication?:Publication};
type Entry={key:string;name:string;selected:boolean;overrides?:string[];inherited?:Record<string,string>};
type Item={entry:Entry;state:PhotoState;client:ReturnType<typeof createCloudDraftClient>;card:HTMLElement;status:HTMLElement;select:HTMLInputElement;fields:Record<string,HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>;cover:HTMLInputElement;timer:number;dirty:boolean;locked:boolean;conflict:boolean;body:string;doc:YAML.Document};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const KEY=/^draft-photo-[a-f0-9-]{36}$/;
const SLUG=/^[\p{L}\p{N}][\p{L}\p{N}-]{0,180}$/u;
function parse(raw:string){const front=raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);if(!front)throw Error('照片草稿格式无效。');const doc=YAML.parseDocument(front[1]);if(doc.errors.length)throw Error('照片草稿格式无效。');doc.toJS({maxAliasCount:0});return {doc,body:raw.slice(front[0].length)};}
async function read(path:string){const r=await fetch(path,{credentials:'same-origin',cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'读取失败，请重新登录后重试。');return data;}
function imageURL(value:string){if(/^data:image\/(?:webp|png|jpeg);base64,/.test(value))return value;if(value.startsWith('/')&&!value.startsWith('//'))return new URL(value,'https://tkkdy.me').href;try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{}return '';}
function messageOf(error:unknown){return error instanceof Error?error.message:'操作未完成。';}

export async function initializePhotoBatch(){
 const root=document.querySelector<HTMLElement>('[data-photo-batch]');if(!root)return;
 const picker=root.querySelector<HTMLInputElement>('[data-batch-files]')!,list=root.querySelector<HTMLElement>('[data-batch-list]')!,message=root.querySelector<HTMLElement>('[data-batch-message]')!,summary=root.querySelector<HTMLElement>('[data-batch-summary]')!,publish=root.querySelector<HTMLButtonElement>('[data-batch-publish]')!;
 const items:Item[]=[];let entries:Entry[]=[],processing=false,busy=false,restoring=true,ready=false;
 const review=root.querySelector<HTMLDialogElement>('[data-batch-review]')!,confirm=root.querySelector<HTMLButtonElement>('[data-batch-confirm]')!;
 const groupFields=Object.fromEntries([...root.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('[data-group-field]')].map(el=>[el.dataset.groupField!,el]));
 picker.disabled=true;
 const url=new URL(location.href),requested=url.searchParams.get('batch');
 const batch=requested&&UUID.test(requested)?requested:crypto.randomUUID();
 url.searchParams.set('batch',batch);history.replaceState(null,'',url);
 const storageKey='editor-photo-batch:'+batch;
 let savedDefaults=false;
 try{const defaults=JSON.parse(sessionStorage.getItem(storageKey+':defaults')||'null');if(defaults&&typeof defaults==='object'){savedDefaults=true;for(const [name,field] of Object.entries(groupFields))if(typeof defaults[name]==='string')field.value=defaults[name].slice(0,name==='alt'?500:name==='series'?120:40);}}catch{}
 function values():Record<string,string>{return {...Object.fromEntries(Object.entries(groupFields).map(([name,field])=>[name,field.value.trim()])),frameDescription:groupFields.alt.value.trim()};}
 function markDirty(item:Item){item.dirty=true;item.status.textContent='正在保存……';clearTimeout(item.timer);if(!busy&&!processing&&!restoring&&!item.locked&&!item.conflict)item.timer=window.setTimeout(()=>void save(item).catch(()=>{}),600);}
 function inherit(){
  const defaults=values();
  for(const item of items){if(item.locked||item.conflict)continue;for(const [name,value] of Object.entries(defaults)){if(item.entry.overrides?.includes(name))continue;if(item.fields[name].value!==value){item.fields[name].value=value;markDirty(item);}item.entry.inherited??={};item.entry.inherited[name]=value;}item.card.querySelector('img')!.alt=item.fields.alt.value||'待填写说明的照片';}
  const series=new Set(items.map(item=>item.fields.series.value).filter(Boolean));
  for(const name of series){const group=items.filter(item=>item.fields.series.value===name);if(!group.some(item=>item.cover.checked)){const first=group.find(item=>item.entry.selected&&!item.locked&&!item.conflict);if(first){first.cover.checked=true;markDirty(first);}}}
  persist();update();
 }
 function restoreDefaults(){
  if(!savedDefaults)for(const [name,field] of Object.entries(groupFields)){const unique=new Set(items.map(item=>item.fields[name].value));if(unique.size===1)field.value=items[0]?.fields[name].value||field.value;}
  const defaults=values();for(const item of items){const overrides=new Set(item.entry.overrides||[]);for(const [name,value] of Object.entries(defaults)){const prior=item.entry.inherited?.[name];if(prior!==undefined?item.fields[name].value!==prior:item.fields[name].value!==value)overrides.add(name);}item.entry.overrides=[...overrides];}
 }

 function persist(){try{sessionStorage.setItem(storageKey,JSON.stringify(entries));sessionStorage.setItem(storageKey+':defaults',JSON.stringify(values()));}catch{message.textContent='本组列表暂时无法保留；已保存的照片仍可从「照片」中的私有草稿恢复。';}}
 function update(){
  const selected=items.filter(x=>x.entry.selected&&!x.locked);
  summary.textContent=items.length?`本组 ${items.length} 张 · 已选 ${selected.length} 张发布`:'尚未选择照片';
  publish.textContent=selected.length?`预览并发布 ${selected.length} 张`:'预览并发布';
  publish.disabled=processing||busy||restoring||!selected.length||selected.some(x=>x.conflict);
  picker.disabled=!ready||processing||busy||restoring;
  confirm.disabled=busy||processing||restoring;
  for(const field of Object.values(groupFields))field.disabled=picker.disabled;
  for(const button of root!.querySelectorAll<HTMLButtonElement>('[data-batch-select-all],[data-batch-select-none]'))button.disabled=picker.disabled;
  for(const item of items){const disabled=busy||processing||restoring||item.locked||item.conflict;for(const field of Object.values(item.fields))field.disabled=disabled;item.cover.disabled=disabled;item.select.disabled=disabled;item.card.querySelector<HTMLButtonElement>('[data-item-save]')!.disabled=disabled;item.card.classList.toggle('is-selected',item.entry.selected);item.card.classList.toggle('is-cover',item.cover.checked);item.cover.name='cover-'+batch+'-'+item.fields.series.value;}

 }
 function snapshot(item:Item):PhotoState{
  for(const name of ['title','alt','caption','series','capturedAt','frameDescription']){const value=item.fields[name].value.trim();if(value)item.doc.set(name,value);else item.doc.delete(name);}
  if(item.fields.frameDisplay.value==='description'&&!item.fields.frameDescription.value.trim()&&item.fields.alt.value.trim())item.doc.set('frameDescription',item.fields.alt.value.trim());
  item.doc.set('albumCover',item.cover.checked);item.doc.set('frameDisplay',item.fields.frameDisplay.value);
  const data=item.doc.toJS({maxAliasCount:0});
  return {...item.state,title:String(data.title||data.alt||'未命名照片'),rawContent:'---\n'+item.doc.toString()+'---\n'+item.body};
 }
 async function save(item:Item){
  clearTimeout(item.timer);if(item.locked)throw Error('这张照片已有发布尝试，请先核对提案状态。');
  if(item.conflict)throw Error('另一台设备已保存此照片，请从草稿重新打开比较。');
  const state=snapshot(item);
  try{await item.client.save(state);item.state=state;item.dirty=snapshot(item).rawContent!==state.rawContent;item.status.textContent=item.dirty?'仍有修改待保存':'已保存 · 私有草稿';}
  catch(error){item.dirty=true;if((error as {status?:number}).status===409)item.conflict=true;item.status.textContent=messageOf(error)+' 未保存的修改仍在此页。';update();throw error;}
 }
 function lock(item:Item,locked:boolean){
  item.locked=locked;item.select.disabled=locked||item.conflict;item.cover.disabled=locked||item.conflict;
  for(const field of Object.values(item.fields))field.disabled=locked;
  const saveButton=item.card.querySelector<HTMLButtonElement>('[data-item-save]')!;saveButton.disabled=locked;
 }
 function receipt(item:Item){
  lock(item,true);item.entry.selected=false;item.select.checked=false;
  item.status.textContent=item.state.publication?.state==='proposed'?'发布提案已提交，等待既有 CI 与合并流程。':'这张照片已有发布尝试，请核对历史提案，避免重复发布。';
  const href=item.state.publication?.url;
  if(href&&/^https:\/\/github\.com\/Tkkdy\/tkkdyyy\.github\.io\/pull\/\d+$/.test(href)){const a=document.createElement('a');a.href=href;a.textContent='查看发布进度';item.status.append(' ',a);showPhotoPublication(root!,href);}
 }
 function mount(entry:Entry,state:PhotoState,client:Item['client'],dirty=false){
  const {doc,body}=parse(state.rawContent),data=doc.toJS({maxAliasCount:0});
  const card=document.createElement('article');card.className='photo-batch-card';card.dataset.photoKey=entry.key;
  const visual=document.createElement('button');visual.type='button';visual.className='photo-batch-visual';visual.dataset.itemEdit='';visual.setAttribute('aria-expanded','false');visual.setAttribute('aria-label','编辑 '+entry.name);
  const img=document.createElement('img');img.src=imageURL(String(data.image||''));img.alt=String(data.alt||'待填写说明的照片');img.loading='lazy';
  const editHint=document.createElement('span');editHint.className='batch-edit-hint';editHint.textContent='点击编辑';visual.append(img,editHint);
  const bar=document.createElement('div');bar.className='batch-card-bar';
  const selection=document.createElement('label');selection.className='photo-check';const select=document.createElement('input');select.type='checkbox';select.checked=entry.selected;select.dataset.itemSelected='';selection.append(select,'选中发布');bar.append(selection);
  const coverLabel=document.createElement('label');coverLabel.className='photo-check batch-cover-check';const cover=document.createElement('input');cover.type='checkbox';cover.checked=data.albumCover===true;cover.dataset.itemCover='';coverLabel.append(cover,'主图');bar.append(coverLabel);
  const name=document.createElement('p');name.className='batch-file-name';name.textContent=entry.name;
  const content=document.createElement('div');content.className='photo-batch-fields';content.id='photo-options-'+entry.key;content.hidden=true;visual.setAttribute('aria-controls',content.id);
  const fields:Item['fields']={};
  const detail=document.createElement('details');detail.className='batch-frame-options';const detailTitle=document.createElement('summary');detailTitle.textContent='单张更多设置';detail.append(detailTitle);
  for(const [name,label] of [['alt','单张说明'],['caption','单张短句（选填）'],['title','标题（选填）'],['series','相簿名称'],['capturedAt','拍摄日期'],['frameDescription','单张物品描述（选填）']]){
   const wrap=document.createElement('label');wrap.textContent=label;
   const control=['title','series','capturedAt'].includes(name)?document.createElement('input'):document.createElement('textarea');control.value=String(data[name]||'').slice(0,name==='capturedAt'?10:1000);control.maxLength=name==='alt'?500:name==='caption'?1000:name==='series'?120:240;control.dataset.field=name;if(control instanceof HTMLTextAreaElement)control.rows=2;if(control instanceof HTMLInputElement)control.type=name==='capturedAt'?'date':'text';
   if(name==='alt'){control.placeholder='使用整组说明；在这里修改，只影响这一张';content.append(wrap);}else detail.append(wrap);wrap.append(control);fields[name]=control;
  }
  const displayLabel=document.createElement('label');displayLabel.textContent='相纸白边展示';const display=document.createElement('select');display.dataset.field='frameDisplay';for(const [value,text] of [['information','照片说明'],['date','拍摄日期'],['description','物品描述']]){const option=document.createElement('option');option.value=value;option.textContent=text;display.append(option);}display.value=data.frameDisplay||'information';displayLabel.append(display);detail.append(displayLabel);fields.frameDisplay=display;content.append(detail);
  const status=document.createElement('p');status.setAttribute('role','status');status.className='photo-batch-status';status.textContent=dirty?'尚未保存':'已保存 · 私有草稿';
  const actions=document.createElement('div');actions.className='photo-batch-card-actions';
  const button=document.createElement('button');button.type='button';button.textContent='保存这张';button.dataset.itemSave='';
  const advanced=document.createElement('a');advanced.href='/admin/photos/edit/?draft='+encodeURIComponent(entry.key)+'&batch='+encodeURIComponent(batch);advanced.textContent='更多信息';actions.append(button,advanced);detail.append(actions);card.append(visual,bar,name,content,status);list.append(card);
  visual.addEventListener('click',(event)=>{const expanded=Boolean(content.hidden);content.hidden=!expanded;visual.setAttribute('aria-expanded',String(expanded));card.classList.toggle('is-editing',expanded);if(expanded&&(event.detail===0||matchMedia('(min-width:601px)').matches))fields.alt.focus({preventScroll:true});});
  const item:Item={entry,state,client,card,status,select,fields,timer:0,dirty,locked:false,conflict:false,doc,body,cover};items.push(item);
  select.addEventListener('change',()=>{entry.selected=select.checked;persist();update();});
  for(const field of Object.values(fields)){
   let composing=false;const schedule=()=>{const fieldName=field.dataset.field!;if(fieldName in groupFields||fieldName==='frameDescription'){item.entry.overrides=[...new Set([...(item.entry.overrides||[]),fieldName])];persist();}img.alt=fields.alt.value||'待填写说明的照片';update();item.dirty=true;if(!processing&&!busy)message.textContent='每张照片独立保存；只会发布你勾选的照片。';status.textContent='待保存……';clearTimeout(item.timer);if(!composing&&!busy&&!item.locked)item.timer=window.setTimeout(()=>void save(item).catch(()=>{}),900);};
   field.addEventListener('input',schedule);field.addEventListener('compositionstart',()=>{composing=true;clearTimeout(item.timer);});field.addEventListener('compositionend',()=>{composing=false;schedule();});
  }
  cover.addEventListener('change',()=>{const series=item.fields.series.value.trim();if(cover.checked&&!series){cover.checked=false;message.textContent='请先填写相簿名称，再指定主图。';return;}if(cover.checked){for(const other of items){if(other!==item&&other.cover.checked&&other.fields.series.value.trim()===series){if(other.locked){cover.checked=false;message.textContent='这本相簿的主图已有发布尝试，请先核对提案。';return;}other.cover.checked=false;other.dirty=true;void save(other).catch(()=>{});}}}item.dirty=true;update();status.textContent='主图设置待保存……';clearTimeout(item.timer);item.timer=window.setTimeout(()=>void save(item).catch(()=>{}),900);});
  const reset=document.createElement('button');reset.type='button';reset.className='batch-use-group';reset.textContent='恢复整组信息';content.insertBefore(reset,detail);reset.addEventListener('click',()=>{if(item.locked||item.conflict||busy)return;item.entry.overrides=[];for(const [name,value] of Object.entries(values()))item.fields[name].value=value;item.entry.inherited=values();markDirty(item);persist();update();});
  button.addEventListener('click',()=>void save(item).catch(()=>{}));
  advanced.addEventListener('click',async event=>{if(!item.dirty)return;event.preventDefault();try{await save(item);location.assign(advanced.href);}catch{message.textContent='请先处理这张照片的保存问题，或保留此页。';}});
  if(state.publication)receipt(item);update();return item;
 }
 window.addEventListener('beforeunload',event=>{if(processing||busy||items.some(x=>x.dirty)){event.preventDefault();event.returnValue='';}});
 try{
  const auth=await readAdminSession();if(!auth.privateDrafts||auth.publicationMode!=='pull-request')throw Error('请登录私人编辑台后上传照片。');
  try{const stored=JSON.parse(sessionStorage.getItem(storageKey)||'[]');if(Array.isArray(stored))entries=stored.filter((x:Entry)=>KEY.test(x?.key)&&typeof x.name==='string').slice(0,20).map((x:Entry)=>({key:x.key,name:x.name.slice(0,255),selected:x.selected===true,overrides:Array.isArray(x.overrides)?x.overrides.filter(name=>name in groupFields||name==='frameDescription'):[],inherited:x.inherited&&typeof x.inherited==='object'?x.inherited:{}}));}catch{}
  for(const entry of entries){
   try{const client=createCloudDraftClient({key:entry.key,session:readAdminSession}),saved=await client.load();if(!saved||saved.state.type!=='Image'){entry.selected=false;continue;}mount(entry,saved.state,client);}
   catch(error){const note=document.createElement('p');note.textContent=entry.name+'：'+messageOf(error);list.append(note);}
  }
  restoreDefaults();ready=true;message.textContent=items.length?'已恢复本组照片和选择。整组填一次，单张可以不同。':'新上传的照片默认全选，点击缩略图可单独修改。';
 }catch(error){message.textContent=messageOf(error);return;}finally{restoring=false;update();}
 for(const field of Object.values(groupFields)){
  let composing=false;field.addEventListener('compositionstart',()=>{composing=true;});field.addEventListener('compositionend',()=>{composing=false;inherit();});
  field.addEventListener('input',()=>{if(!composing)inherit();});field.addEventListener('change',()=>{if(!composing)inherit();});
 }
 for(const [selector,selected] of [['[data-batch-select-all]',true],['[data-batch-select-none]',false]] as const)root.querySelector(selector)!.addEventListener('click',()=>{for(const item of items)if(!item.locked&&!item.conflict){item.entry.selected=selected;item.select.checked=selected;}persist();update();});
 function closeReview(){if(busy)return;review.close();document.documentElement.classList.remove('batch-review-open');publish.focus({preventScroll:true});}
 root.querySelector('[data-batch-review-close]')!.addEventListener('click',closeReview);
 review.addEventListener('cancel',event=>{event.preventDefault();closeReview();});review.addEventListener('click',event=>{if(event.target===review)closeReview();});
 publish.addEventListener('click',async()=>{
  if(busy||processing)return;const chosen=items.filter(item=>item.entry.selected&&!item.locked);if(!chosen.length)return;
  const missing=chosen.find(item=>!item.fields.alt.value.trim());if(missing){message.textContent='给整组填写一句照片说明即可；也可以点开照片单独填写。';groupFields.alt.focus();return;}
  busy=true;update();
  try{
   for(const item of chosen)if(item.dirty)await save(item);
   const photos=chosen.map(item=>({id:item.entry.key,...parse(snapshot(item).rawContent).doc.toJS({maxAliasCount:0}),hasFile:true}));for(const photo of photos)validateAlbumFields({...photo,status:'published'});groupPhotoAlbums(photos);
   root.querySelector('[data-batch-review-summary]')!.textContent=`准备发布 ${chosen.length} 张；${items.length-chosen.length} 张继续保留为私有草稿。点击相簿可展开，再点照片放大。`;
   confirm.textContent=document.querySelector('meta[name="editor-local-preview"]')?`本地检查 ${chosen.length} 张（不会上线）`:`确认发布 ${chosen.length} 张`;
   review.showModal();document.documentElement.classList.add('batch-review-open');review.querySelector('[data-photo-albums]')!.dispatchEvent(new CustomEvent('photo-albums:update',{detail:photos}));
  }catch(error){message.textContent=messageOf(error)+' 未提交发布。';}finally{busy=false;update();}
 });
 picker.addEventListener('change',async()=>{
  const files=Array.from(picker.files||[]);if(!files.length||processing||busy)return;
  if(entries.length+files.length>20){message.textContent='一组最多 20 张，请分组选择。';picker.value='';return;}
  processing=true;update();let added=0,failed=0;const failures:string[]=[];
  try{for(let i=0;i<files.length;i++){
   const file=files[i];message.textContent=`正在处理 ${i+1}/${files.length}：${file.name}`;
   try{
    if(file.size>PHOTO_SOURCE_MAX_BYTES)throw Error('超过 50 MB，请缩小后再选择。');
    const image=await photoUploadDataUrl(file),encoded=image.split(',')[1]||'';
    if(!/^data:image\/(?:webp|png|jpeg);base64,/.test(image)||Math.floor(encoded.length*3/4)>8_000_000)throw Error('转换后的照片过大或格式不支持，请缩小或转为 JPEG 后重试。');
    const key='draft-photo-'+crypto.randomUUID(),slug='photo-'+key.slice(-12),now=new Date(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const doc=new YAML.Document({slug,image,alt:groupFields.alt.value.trim(),publishedAt:date,status:'draft',window:{enabled:false,timeOfDay:[],seasons:[]}});
    const defaults=values();for(const [name,value] of Object.entries(defaults))if(value)doc.set(name,value);if(defaults.series&&!items.some(item=>item.fields.series.value===defaults.series&&item.cover.checked))doc.set('albumCover',true);
    const state:PhotoState={id:key,title:'未命名照片',type:'Image',status:'draft',sourcePath:`src/content/images/${slug}.md`,sourceBlobSha:'',rawContent:'---\n'+doc.toString()+'---\n'};
    const entry:Entry={key,name:file.name,selected:true,overrides:[],inherited:values()},client=createCloudDraftClient({key,session:readAdminSession}),item=mount(entry,state,client,true);entries.push(entry);persist();await save(item);added++;
   }catch(error){failed++;failures.push(file.name+'：'+messageOf(error));}
  }}finally{processing=false;picker.value='';persist();update();message.textContent=`本次已保存 ${added} 张私有照片草稿。`+(failed?` ${failed} 张未完成：${failures.join('；')}`:' 已默认选中，可取消不想发布的照片。');}
 });
 confirm.addEventListener('click',async()=>{
  if(processing||busy||!review.open)return;
  const chosen=items.filter(x=>x.entry.selected&&!x.locked);if(!chosen.length)return;
  const missing=chosen.find(x=>!x.fields.alt.value.trim());if(missing){message.textContent='请先为「'+missing.entry.name+'」填写照片说明。';missing.fields.alt.focus();return;}
  busy=true;for(const item of items){clearTimeout(item.timer);lock(item,true);}update();
  // Lock UI during preparation without treating unattempted drafts as publication receipts.
  for(const item of items)if(!item.state.publication)item.locked=false;
  const prepared:{item:Item;raw:string;state:PhotoState}[]=[],files:{path:string;contentBase64:string}[]=[],marked:Item[]=[];let dispatched=false;
  try{
   for(const item of chosen)await save(item);
   const catalog=await read('/api/stories'),resources=catalog.resources||[],slugs=new Set<string>(),paths=new Set<string>();let bytes=0;
   for(const item of chosen){
    const state=snapshot(item),{doc,body}=parse(state.rawContent),data=doc.toJS({maxAliasCount:0}),slug=String(data.slug||''),path=`src/content/images/${slug}.md`;
    if(!SLUG.test(slug)||slugs.has(slug)||resources.some((r:{type:string;slug:string;sourcePath:string})=>r.sourcePath===path||(r.type==='Image'&&r.slug===slug)))throw Error('照片网址标识重复或已被使用，请在更多信息中修改。');
    validateAlbumFields({...data,status:'published'});slugs.add(slug);doc.set('status','published');
    if(String(data.image).startsWith('data:')){const upload=await dataUrlFile(data.image,'photo-'+slug);doc.set('image',upload.publicPath);files.push({path:upload.gitPath,contentBase64:upload.contentBase64});}
    const raw='---\n'+doc.toString()+'---\n'+body;if(raw.includes('data:image/'))throw Error('照片尚未转换为发布资源。');files.push({path,contentBase64:textToBase64(raw)});prepared.push({item,raw,state});
   }
   const albumPhotos=resources.filter((r:{type:string})=>r.type==='Image').map((r:{sourcePath:string;rawContent:string})=>({id:r.sourcePath,...parse(r.rawContent).doc.toJS({maxAliasCount:0})}));for(const {item} of prepared)albumPhotos.push({id:item.entry.key,...item.doc.toJS({maxAliasCount:0})});groupPhotoAlbums(albumPhotos);
   for(const file of files){if(paths.has(file.path))throw Error('发布资源路径重复。');paths.add(file.path);bytes+=atob(file.contentBase64).length;}
   if(bytes>PUBLICATION_MAX_BYTES)throw Error('所选照片总资源超过 100 MB，请减少本次勾选的数量。');
   if(document.querySelector('meta[name="editor-local-preview"]')){message.textContent=`本地预览：${chosen.length} 张照片已通过发布检查并保存草稿，未创建提案、未更新线上网站。`;return;}
   for(const {item} of prepared){const intent={...snapshot(item),publication:{state:'pending'}};await item.client.save(intent);item.state=intent;marked.push(item);}
   const auth=await readAdminSession(),github=createGitHubClient({owner:'Tkkdy',repo:'tkkdyyy.github.io',branch:auth.branch,csrf:auth.csrf});
   dispatched=true;
   const result=await github.proposeFiles({expectedHeadOid:catalog.head,message:`Publish ${chosen.length} selected photos`,files});
   for(const {item,raw} of prepared){item.state={...item.state,publication:{state:'proposed',url:result.proposal.url,publishedContent:raw}};receipt(item);await item.client.save(item.state);}
   message.textContent=`${chosen.length} 张照片的发布提案已提交；未勾选的照片仍保留为私有草稿。`;
  }catch(error){
   if(!dispatched){for(const item of marked){const clean={...item.state};delete clean.publication;try{await item.client.save(clean);item.state=clean;}catch{receipt(item);}}}
   else for(const item of marked)receipt(item);
   message.textContent=messageOf(error)+(dispatched?' 请先核对历史提案，不要重复发布。':' 尚未发送发布请求。');
  }finally{review.close();document.documentElement.classList.remove('batch-review-open');busy=false;for(const item of items){lock(item,Boolean(item.state.publication));if(item.dirty&&!item.locked&&!item.conflict)item.timer=window.setTimeout(()=>void save(item).catch(()=>{}),900);}persist();update();}
 });
}
