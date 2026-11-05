import YAML from 'yaml';
import {frameText,groupPhotoAlbums} from './photo-albums.mjs';
type Photo={id:string;image:string;alt:string;title?:string;caption?:string;capturedAt?:string|Date;series?:string;albumCover?:boolean;frameDisplay?:string;frameDescription?:string;orientation?:string;hasFile?:boolean;href?:string};
type Album={key:string;title:string;photos:Photo[]};
const safeImage=(src:string)=>{if(!src)return '';if(/^data:image\/(?:webp|png|jpeg);base64,/.test(src))return src;try{const url=new URL(src,location.origin);if((url.protocol==='https:'||url.origin===location.origin)&&!url.username&&!url.password)return url.href;}catch{}return '';};
export async function initializePhotoAlbums(root:HTMLElement){
 const message=root.querySelector<HTMLElement>('[data-album-message]')!,groupsNode=root.querySelector<HTMLElement>('[data-album-groups]')!,dialog=root.querySelector<HTMLDialogElement>('[data-album-viewer]')!,paper=dialog.querySelector<HTMLElement>('[data-viewer-paper]')!,viewerImage=dialog.querySelector<HTMLElement>('[data-viewer-image]')!,viewerCaption=dialog.querySelector<HTMLElement>('[data-viewer-caption]')!,viewerTitle=dialog.querySelector<HTMLElement>('[data-viewer-title]')!,count=dialog.querySelector<HTMLElement>('[data-viewer-count]')!,prev=dialog.querySelector<HTMLButtonElement>('[data-viewer-prev]')!,next=dialog.querySelector<HTMLButtonElement>('[data-viewer-next]')!;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),duration=(ms:number)=>reduced.matches?1:ms,easing='cubic-bezier(.2,.75,.25,1)';
 let active:Album|undefined,index=0,returnFocus:HTMLElement|undefined,closing=false,closeGeneration=0;
 const viewerAnimations:Animation[]=[];
 function animate(node:HTMLElement,frames:Keyframe[],ms:number){const a=node.animate(frames,{duration:duration(ms),easing});a.finished.catch(()=>{});return a;}
 function pulse(node:HTMLElement){animate(node,[{scale:'1'},{scale:'.985'},{scale:'1'}],170);}
 function imageNode(photo:Photo){const src=safeImage(photo.image);if(photo.hasFile!==false&&src){const image=document.createElement('img');image.src=src;image.alt=photo.alt||'';image.loading='lazy';image.decoding='async';image.addEventListener('load',()=>{const surface=image.parentElement;if(surface?.classList.contains('album-photo-surface')){const ratio=image.naturalWidth/image.naturalHeight;surface.classList.toggle('is-portrait',ratio<.85);surface.classList.toggle('is-square',ratio>=.85&&ratio<=1.15);surface.style.aspectRatio=String(image.naturalWidth)+' / '+String(image.naturalHeight);}},{once:true});image.addEventListener('error',()=>{const fallback=placeholder();image.replaceWith(fallback);},{once:true});return image;}return placeholder();}
 function placeholder(){const node=document.createElement('span');node.className='album-placeholder';node.textContent='暂无照片 · 仅为布局占位';return node;}
 function showPhoto(direction=0){
  if(!active)return;
  viewerAnimations.splice(0).forEach(a=>a.cancel());
  const photo=active.photos[index];viewerImage.replaceChildren(imageNode(photo));viewerCaption.textContent=frameText(photo);viewerTitle.textContent=active.title;count.textContent=`${String(index+1).padStart(2,'0')} / ${String(active.photos.length).padStart(2,'0')}`;prev.disabled=index===0;next.disabled=index===active.photos.length-1;
  viewerAnimations.push(animate(paper,[{opacity:direction ? .25 : 0,transform:`translate(${direction*18}px,${direction?0:14}px) scale(${direction ? .994 : .965})`},{opacity:1,transform:'translate(0,0) scale(1)'}],direction?250:330));
 }
 function open(album:Album,photoIndex:number,button:HTMLElement){active=album;index=photoIndex;returnFocus=button;closing=false;closeGeneration++;if(!dialog.open)dialog.showModal();document.documentElement.classList.add('album-dialog-open');showPhoto();dialog.querySelector<HTMLButtonElement>('[data-viewer-close]')!.focus({preventScroll:true});}
 async function close(){if(!dialog.open||closing)return;closing=true;const generation=++closeGeneration;viewerAnimations.splice(0).forEach(a=>a.cancel());const animation=animate(paper,[{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(7px) scale(.985)'}],190);await animation.finished.catch(()=>{});if(generation!==closeGeneration)return;dialog.close();closing=false;document.documentElement.classList.remove('album-dialog-open');returnFocus?.focus({preventScroll:true});}
 function step(direction:number){if(!active||closing)return;const target=index+direction;if(target<0||target>=active.photos.length)return;index=target;showPhoto(direction);}
 dialog.querySelector('[data-viewer-close]')!.addEventListener('click',event=>{pulse(event.currentTarget as HTMLElement);void close();});prev.addEventListener('click',()=>{pulse(prev);step(-1);});next.addEventListener('click',()=>{pulse(next);step(1);});
 dialog.addEventListener('cancel',event=>{event.preventDefault();void close();});dialog.addEventListener('click',event=>{if(event.target===dialog||event.target===dialog.querySelector('[data-viewer-shell]'))void close();});dialog.addEventListener('close',()=>{document.documentElement.classList.remove('album-dialog-open');});
 dialog.addEventListener('keydown',event=>{if(event.key==='ArrowRight'){event.preventDefault();step(1);}if(event.key==='ArrowLeft'){event.preventDefault();step(-1);}});
 let start:{x:number;y:number}|null=null;paper.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')start={x:e.clientX,y:e.clientY};});paper.addEventListener('pointerup',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)>45&&Math.abs(dy)<65)step(dx<0?1:-1);});paper.addEventListener('pointercancel',()=>{start=null;});
 function render(photos:Photo[]){
  const albums=groupPhotoAlbums(photos) as Album[];groupsNode.replaceChildren();message.textContent=albums.length?'':'公开影像正在慢慢出现。';
  for(const [groupIndex,album] of albums.entries()){
   const article=document.createElement('article');article.className='album-group';article.dataset.album=album.key;
   const heading=document.createElement('header');heading.className='album-group-heading';const h2=document.createElement('h2');h2.textContent=album.title;const total=document.createElement('span');total.className='album-group-count';total.textContent=`${String(album.photos.length).padStart(2,'0')} ${album.photos.length===1?'PHOTO':'PHOTOS'}`;heading.append(h2,total);
   const stage=document.createElement('div');stage.className='album-stage';stage.id='album-stage-'+groupIndex;
   const cards:HTMLButtonElement[]=[];
   for(const [i,photo] of album.photos.entries()){
    const button=document.createElement('button');button.type='button';button.className='album-paper'+(i===0?' is-cover':'');button.dataset.albumPhoto=String(i);if(i>=6)button.dataset.beyondStack='';button.setAttribute('aria-label',(photo.title||photo.alt||'照片')+'，点击展开或查看');
    const side=i%2?1:-1,offset=i===0?0:side*(18+Math.floor(i/2)*17),rotation=i===0?0:side*(2.5+i*.8);
    button.style.cssText=`--stack-x:${offset}px;--stack-y:${i===0?5:-8-i*4}px;--stack-r:${rotation}deg;--stack-z:${20-i};--spread-y:${[0,18,-5,12,-9,16][i%6]}px;--spread-r:${[-2,2.6,-1.4,2,-2.7,1.2][i%6]}deg`;
    const surface=document.createElement('span');surface.className='album-photo-surface'+(photo.orientation==='portrait'?' is-portrait':photo.orientation==='square'?' is-square':'');surface.append(imageNode(photo));const caption=document.createElement('span');caption.className='album-paper-caption';const text=document.createElement('span');text.textContent=frameText(photo);caption.append(text);button.append(surface,caption);stage.append(button);cards.push(button);
   }
   const toggle=document.createElement('button');toggle.type='button';toggle.className='album-toggle';toggle.dataset.albumToggle='';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',stage.id);const label=document.createElement('span');label.textContent='展开这一组';const arrow=document.createElement('span');arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');toggle.append(label,arrow);if(album.photos.length>1)heading.insertBefore(toggle,total);article.append(heading,stage);groupsNode.append(article);
   let running:Animation[]=[],spreadGeneration=0;
   function spread(expanded:boolean){
    const generation=++spreadGeneration;const before=cards.map(card=>card.getBoundingClientRect()),height=stage.getBoundingClientRect().height;
    cards.forEach((card,i)=>{if(i>=6)card.style.visibility='visible';});running.forEach(a=>a.cancel());running=[];article.classList.toggle('is-open',expanded);toggle.setAttribute('aria-expanded',String(expanded));label.textContent=expanded?'收拢这一组':'展开这一组';
    const finalHeight=stage.getBoundingClientRect().height;
    for(const [i,card] of cards.entries()){
     card.tabIndex=expanded||i===0?0:-1;
     const after=card.getBoundingClientRect(),transform=getComputedStyle(card).transform;
     if(after.width>0&&before[i].width>0)running.push(animate(card,[{transform:`translate(${before[i].x-after.x}px,${before[i].y-after.y}px) scale(${before[i].width/after.width},${before[i].height/after.height}) ${transform}`,opacity:expanded&&i>=6?0:1},{transform,opacity:expanded||i<6?1:0}],420));
    }
    running.push(animate(stage,[{height:height+'px'},{height:finalHeight+'px'}],420));Promise.all(running.map(a=>a.finished.catch(()=>{}))).then(()=>{if(generation===spreadGeneration)cards.forEach(card=>{card.style.visibility='';});});
   }
   cards.forEach((card,i)=>{if(i>0)card.tabIndex=-1;card.addEventListener('click',()=>{pulse(card);if(album.photos.length===1)open(album,i,card);else if(!article.classList.contains('is-open'))spread(true);else open(album,i,card);});});toggle.addEventListener('click',()=>{pulse(toggle);spread(!article.classList.contains('is-open'));});
  }
 }
 try{
  if(root.dataset.livePreview==='true'){
   message.textContent='';root.addEventListener('photo-albums:update',event=>render((event as CustomEvent<Photo[]>).detail));
  }else if(root.dataset.privatePreview==='true'){
   const query=new URL(location.href).searchParams,batch=query.get('batch'),back=document.querySelector<HTMLAnchorElement>('[data-album-back]');if(batch&&/^[a-f0-9-]{36}$/.test(batch)&&back)back.href='/admin/photos/upload/?batch='+batch;
   const api=async(path:string)=>{const r=await fetch(path,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('请先登录私人编辑台，再预览草稿。');return r.json();};
   const session=await api('/api/session');if(!session.privateDrafts)throw Error('此页只预览受保护的照片草稿。');
   let keys:string[]=[];
   if(batch){try{keys=JSON.parse(sessionStorage.getItem('editor-photo-batch:'+batch)||'[]').map((e:{key:string})=>e.key).filter((key:string)=>/^draft-photo-[a-f0-9-]{36}$/.test(key));}catch{}}
   if(!keys.length){const list=await api('/api/drafts');keys=list.drafts.filter((d:{type:string})=>d.type==='Image').map((d:{key:string})=>d.key);}
   const photos:Photo[]=[];
   for(const key of keys.slice(0,60)){const {draft}=await api('/api/drafts?key='+encodeURIComponent(key));if(!draft?.state.rawContent)continue;const raw=draft.state.rawContent,front=raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);if(!front)continue;const data=YAML.parse(front[1],{maxAliasCount:0});if(!safeImage(String(data.image||'')))continue;photos.push({id:key,...data,image:String(data.image),hasFile:true});}
   const unnamedBatch=Boolean(batch&&photos.length>1&&photos.every(p=>!p.series));if(unnamedBatch)photos.forEach(p=>{p.series='本组选图（仅预览）';});
   render(photos);message.textContent=unnamedBatch?'本组未命名照片临时叠放供预览，不会写入相簿名称；发布前请在编辑台填写名称。':'这是私有草稿预览，分组和文字来自你填写的信息，不会发布。';
   const demo=document.createElement('button');demo.type='button';demo.className='album-layout-demo';demo.dataset.albumDemo='';demo.textContent='查看多组布局示意（无真实照片）';root.insertBefore(demo,groupsNode);let demoMode=false;demo.addEventListener('click',()=>{pulse(demo);demoMode=!demoMode;if(!demoMode){render(photos);message.textContent='已返回你的私有草稿预览，不会发布。';demo.textContent='查看多组布局示意（无真实照片）';animate(groupsNode,[{opacity:.35,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],260);return;}demo.textContent='返回我的私有草稿';const samples:Photo[]=[];for(const [g,n] of [7,1,1,3].entries())for(let i=0;i<n;i++)samples.push({id:`layout-${g}-${i}`,image:'',alt:'布局占位，不是真实摄影',series:`布局示意 ${String.fromCharCode(65+g)}`,caption:'此处展示你填写的信息',orientation:(g+i)%3===1?'portrait':'landscape',hasFile:false,albumCover:i===0});render(samples);message.textContent='仅为多组错落布局示意：没有虚构照片、日期或个人近况。点击上方按钮可返回你的草稿。';animate(groupsNode,[{opacity:.35,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],260);});
  }else{render(JSON.parse(root.querySelector('[data-album-data]')!.textContent||'[]'));}
 }catch(error){message.textContent=error instanceof Error?error.message:'相簿暂时无法读取。';}
}
