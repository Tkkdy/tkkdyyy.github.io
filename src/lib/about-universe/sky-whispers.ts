import { distantBodies, skyWhispers } from './entities';
import backgrounds from './backgrounds.json';
/** A single quiet note at a time; hover, focus and touch use the same state. */
export function mountSkyWhispers(root:HTMLElement,signal:AbortSignal) {
  const stage=root.querySelector<HTMLElement>('.universe-stage')!;
  const regions=[...root.querySelectorAll<HTMLElement>('[data-whisper]')];
  let active:string|null=null,pinned:string|null=null,mouseSpot:string|null=null;
  function place(region:HTMLElement) {
    const x=Number.parseFloat(region.style.left)||0,y=Number.parseFloat(region.style.top)||0;
    region.dataset.side=x+280>stage.clientWidth?'left':'right';
    region.dataset.vertical=y>innerHeight-130?'above':y<110?'below':'middle';
    const stageBox=stage.getBoundingClientRect(),noteWidth=Math.min(230,stage.clientWidth-48);
    const left=stageBox.left+(region.dataset.side==='left'?x-30-noteWidth:x+30);
    const top=stageBox.top+y-16,height=region.querySelector<HTMLElement>('.universe-whisper-copy')!.offsetHeight;
    const crowded=[...root.querySelectorAll<HTMLElement>('[data-node]')].some(node=>{
      if(node.hidden)return false;
      const box=node.getBoundingClientRect();
      return left<box.right+8&&left+noteWidth>box.left-8&&top<box.bottom+8&&top+height>box.top-8;
    });
    if(crowded)region.dataset.vertical=y>height+36?'above':'below';
  }
  function show(id:string|null) {
    if(active===id)return;
    active=id;
    for(const region of regions){
      const open=region.dataset.whisper===id;
      region.dataset.open=String(open);
      const button=region.querySelector('button')!,copy=region.querySelector<HTMLElement>('.universe-whisper-copy')!;
      button.setAttribute('aria-expanded',String(open));
      if(open){button.setAttribute('aria-describedby',copy.id);place(region);}else button.removeAttribute('aria-describedby');
      copy.inert=!open;copy.setAttribute('aria-hidden',String(!open));
    }
    root.dispatchEvent(new CustomEvent('universe-whisper-change',{detail:id}));
  }
  for(const region of regions){
    region.dataset.open='false';
    const button=region.querySelector('button')!,copy=region.querySelector<HTMLElement>('.universe-whisper-copy')!;
    copy.inert=true;copy.setAttribute('aria-hidden','true');
    let escaped=false;
    region.addEventListener('pointerenter',event=>{escaped=false;if(event.pointerType==='mouse'){mouseSpot=region.dataset.whisper!;show(mouseSpot);}},{signal});
    region.addEventListener('pointermove',event=>{if(event.pointerType==='mouse'){mouseSpot=region.dataset.whisper!;if(!escaped)show(mouseSpot);}},{signal});
    region.addEventListener('pointerleave',()=>{escaped=false;if(mouseSpot===region.dataset.whisper)mouseSpot=null;if(active===region.dataset.whisper&&pinned!==region.dataset.whisper&&!region.contains(document.activeElement))show(null);},{signal});
    region.addEventListener('focusin',()=>show(region.dataset.whisper!),{signal});
    region.addEventListener('focusout',event=>{if(active===region.dataset.whisper&&pinned!==region.dataset.whisper&&!region.contains(event.relatedTarget as Node|null))show(null);},{signal});
    button.addEventListener('click',()=>{pinned=pinned===region.dataset.whisper?null:region.dataset.whisper!;show(pinned);},{signal});
    region.addEventListener('keydown',event=>{if(event.key==='Escape'){escaped=true;pinned=null;show(null);event.stopPropagation();}},{signal});
  }
  const dismiss=()=>{pinned=null;show(null);};
  document.addEventListener('pointerdown',event=>{if(!regions.some(region=>region.contains(event.target as Node)))dismiss();},{signal});
  window.addEventListener('scroll',()=>{
    // Scroll/focus settling may fire after pointerenter. Keep a note under the mouse readable.
    const hovered=regions.find(region=>region.dataset.whisper===mouseSpot&&region.matches(':hover')&&!region.hidden);
    if(active&&hovered?.dataset.whisper===active){place(hovered);return;}
    dismiss();
  },{passive:true,signal});
  root.addEventListener('universe-dismiss-whispers',dismiss,{signal});
  // Static/reduced-motion mode aligns the same star reading spots to object-fit:cover.
  const layoutStatic=()=>{
    if(root.dataset.renderer==='webgl')return;
    const width=stage.clientWidth,height=root.querySelector<HTMLElement>('.universe-art')!.clientHeight;
    const cover=Math.max(width/backgrounds.output.width,height/backgrounds.output.height);
    for(const region of regions){
      const star=skyWhispers.find(spot=>spot.id===region.dataset.whisper);
      const body=distantBodies.find(spot=>spot.id===region.dataset.whisper);
      const x=star?width/2+(star.hero.x-.5)*backgrounds.output.width*cover:width*(.5+body!.position.x*1000/body!.position.z);
      const y=star?height/2+(star.hero.y-.5)*backgrounds.output.height*cover:height*(.5+body!.position.y*1000/body!.position.z);
      region.style.left=x+'px';region.style.top=y+'px';
      region.hidden=x<22||x>width-22||y<22||y>height-22;
      place(region);
    }
  };
  const resize=new ResizeObserver(()=>{dismiss();layoutStatic();});resize.observe(stage);
  const mode=new MutationObserver(()=>{dismiss();layoutStatic();});mode.observe(root,{attributes:true,attributeFilter:['data-renderer','data-enhanced']});
  layoutStatic();
  signal.addEventListener('abort',()=>{resize.disconnect();mode.disconnect();},{once:true});
}
