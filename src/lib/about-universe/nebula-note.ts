/** One quiet reading spot; pointer, keyboard and touch share the same visible state. */
export function mountNebulaNote(root:HTMLElement,signal:AbortSignal) {
  const region=root.querySelector<HTMLElement>('[data-nebula-note]');
  const trigger=region?.querySelector<HTMLButtonElement>('button');
  const copy=region?.querySelector<HTMLElement>('[data-nebula-copy]');
  if(!region||!trigger||!copy)return;
  let pinned=false;
  const show=(value:boolean)=>{
    region.dataset.open=String(value);trigger.setAttribute('aria-expanded',String(value));
    copy.setAttribute('aria-hidden',String(!value));copy.inert=!value;
  };
  region.dataset.ready='true';show(false);
  region.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')show(true);},{signal});
  region.addEventListener('pointerleave',()=>{if(!pinned&&!region.contains(document.activeElement))show(false);},{signal});
  region.addEventListener('focusin',()=>show(true),{signal});
  region.addEventListener('focusout',event=>{if(!pinned&&!region.contains(event.relatedTarget as Node|null))show(false);},{signal});
  trigger.addEventListener('click',()=>{pinned=!pinned;show(pinned);},{signal});
  region.addEventListener('keydown',event=>{if(event.key==='Escape'){pinned=false;show(false);event.stopPropagation();}},{signal});
  document.addEventListener('pointerdown',event=>{if(!region.contains(event.target as Node)){pinned=false;show(false);}},{signal});
  signal.addEventListener('abort',()=>{region.removeAttribute('data-ready');copy.inert=false;copy.removeAttribute('aria-hidden');},{once:true});
}
