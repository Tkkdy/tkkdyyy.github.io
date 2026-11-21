import {createJourney} from './scroll-journey';
import {paintedEntry} from './painted-entry';
import {waitForGraphics} from './graphics-scheduler';
import { celestialNodes } from './entities';
import { mountNebulaNote } from './nebula-note';
import { mountSkyWhispers } from './sky-whispers';
import type { UniverseScene } from './scene';
/** Full-document routing: dispose on pagehide; rebuild cleanly on BFCache pageshow. */
export function mountAboutUniverse() {
  const root=document.querySelector<HTMLElement>('[data-universe]');
  if(!root)return;
  // Navigation recedes for the entire About document, including static/reduced-motion views.
  const navigationLifetime=new AbortController();
  const header=document.querySelector<HTMLElement>('.site-header');
  const syncHeader=()=>{
    if(!header)return;
    const hidden=scrollY>1;
    if(header.dataset.universeHidden===String(hidden))return;
    if(hidden){
      if(header.querySelector('.glass-nav.is-searching'))header.querySelector<HTMLButtonElement>('[data-search-exit]')?.click();
      const menu=header.querySelector<HTMLDetailsElement>('[data-mobile-menu]');
      if(menu)menu.open=false;
      if(document.activeElement instanceof HTMLElement&&header.contains(document.activeElement))document.activeElement.blur();
    }
    header.inert=hidden;
    header.dataset.universeHidden=String(hidden);
    if(hidden)header.setAttribute('aria-hidden','true');else header.removeAttribute('aria-hidden');
  };
  window.addEventListener('scroll',syncHeader,{passive:true,signal:navigationLifetime.signal});
  syncHeader();
  mountNebulaNote(root,navigationLifetime.signal);
  mountSkyWhispers(root,navigationLifetime.signal);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let controller:AbortController|null=null, scene:UniverseScene|null=null;
  let disposeJourney=()=>{},disposeEntry=()=>{},disposeTween=()=>{},disposePainting=()=>{};
  let approach=0,approachGeneration=0,approachNode:string|undefined;
  let activeDialog:HTMLDialogElement|null=null,returnTarget:HTMLElement|null=null,savedScroll=0;
  const dialogs=[...document.querySelectorAll<HTMLDialogElement>('.universe-dialog')];
  function finishClose(dialog:HTMLDialogElement) {
    // Native close events are queued; finish our exits now so later user scroll wins.
    if(activeDialog!==dialog||dialog.open)return;
    activeDialog=null;document.documentElement.style.overflow='';
    window.scrollTo({top:savedScroll,behavior:'instant'});
    syncHeader();
    returnTarget?.focus({preventScroll:true});returnTarget=null;
    void storyTo(0);
    scene?.suspend(false);
  }
  const close=()=>{
    const dialog=activeDialog;
    if(!dialog)return;
    dialog.close();finishClose(dialog);
  };
  const open=(id:string,trigger:HTMLElement)=>{
    const node=celestialNodes.find(n=>n.id===id);
    if(!node||activeDialog)return;
    const dialog=document.querySelector<HTMLDialogElement>(node.kind==='reading'?'#universe-reading':'#universe-story')!;
    root.dispatchEvent(new Event('universe-dismiss-whispers'));
    returnTarget=trigger;savedScroll=scrollY;activeDialog=dialog;
    document.documentElement.style.overflow='hidden';
    disposeTween();approach=0;approachNode=node.id;scene?.setStory(0,node.id);
    dialog.dataset.approaching=String(Boolean(scene)&&!reduced.matches);
    dialog.showModal();
    scene?.suspend(true);
    void storyTo(1,node.id);
  };
  async function storyTo(value:number,nodeId=approachNode) {
    const currentScene=scene,generation=++approachGeneration;
    if(!currentScene)return;
    const {gsap}=await import('gsap');
    if(scene!==currentScene||generation!==approachGeneration)return;
    disposeTween();
    const state={value:approach};
    const tween=gsap.to(state,{value,duration:reduced.matches?0:value===1?1.3:0.65,ease:value===1?'power2.inOut':'power2.out',
      onUpdate:()=>{approach=state.value;currentScene.setStory(approach,nodeId);},
      onComplete:()=>{if(value===1&&activeDialog)activeDialog.dataset.approaching='false';},
    });
    disposeTween=()=>tween.kill();
  }
  root.querySelectorAll<HTMLButtonElement>('[data-node]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.node!,button)));
  dialogs.forEach(dialog=>{
    dialog.querySelector('[data-dialog-close]')?.addEventListener('click',close);
    dialog.querySelector<HTMLAnchorElement>('a[href="#about-music"]')?.addEventListener('click',event=>{
      event.preventDefault();close();
      const player=document.querySelector('#about-music');
      player?.scrollIntoView({behavior:reduced.matches?'instant':'smooth'});
      player?.querySelector<HTMLButtonElement>('.music-play')?.focus({preventScroll:true});
    });
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('close',()=>finishClose(dialog));
  });
  const motion=root.querySelector<HTMLButtonElement>('[data-motion-toggle]')!;
  motion.addEventListener('click',()=>{
    const paused=motion.getAttribute('aria-pressed')!=='true';
    motion.setAttribute('aria-pressed',String(paused));motion.textContent=paused?'让星空流动':'暂停星空';
    scene?.setAmbient(!paused);
  });
  function dispose() {
    controller?.abort();controller=null;
    approachGeneration++;approach=0;
    dialogs.forEach(dialog=>dialog.dataset.approaching='false');
    root!.removeAttribute('data-planet-zoom');
    disposePainting();disposeEntry();disposeJourney();disposeTween();scene?.destroy();scene=null;
    root!.removeAttribute('data-enhanced');root!.removeAttribute('data-staged');motion.hidden=true;
    root!.querySelectorAll<HTMLButtonElement>('[data-node]').forEach(button=>{button.hidden=false;button.style.removeProperty('left');button.style.removeProperty('top');button.style.removeProperty('--node-caption');delete button.dataset.distant;});
  }
  async function start(restored=false) {
    if(controller||scene)dispose();
    if(reduced.matches){
      root!.removeAttribute('data-staged');
      document.documentElement.classList.remove('universe-boot');root!.dataset.entry='complete';root!.dataset.renderer='static';return;
    }
    controller=new AbortController();const current=controller;
    try{
      root!.setAttribute('data-staged','');
      if(current.signal.aborted)return;
      const preview=paintedEntry(root!);disposePainting=preview.dispose;
      let pose:[number,number,number]=[0,0,0],covered=false;
      disposeJourney=createJourney(root!,{
        setProgress(p,depth=0,exit=0){pose=[p,depth,exit];if(scene)scene.setProgress(...pose);else preview.update(...pose)},
        suspend(value){covered=value;scene?.suspend(value)}
      });
      const visible=()=>!covered&&root!.getBoundingClientRect().bottom>0;
      const quiet=()=>waitForGraphics(current.signal,visible);
      // A visitor can pass the entire star field before its first GPU frame.
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      await waitForGraphics(current.signal,visible,650);
      if(current.signal.aborted)return;
      const [{createScene},{enterUniverse}]=await Promise.all([import('./scene'),import('./entry-timeline')]);
      await quiet();if(current.signal.aborted)return;
      const created=await createScene(root!,current.signal,quiet);
      if(current.signal.aborted){created.destroy();return;}
      scene=created;scene.setProgress(...pose);scene.suspend(covered);
      root!.dataset.enhanced='true';root!.removeAttribute('data-staged');
      disposeEntry=enterUniverse(root!,scene,restored||scrollY>30);
      if(activeDialog){
        approach=1;approachNode=activeDialog.id==='universe-reading'?'little-note':'quiet-orbit';
        scene.suspend(true);scene.setStory(1,approachNode);
      }
      motion.hidden=false;
      const paused=root!.dataset.ambient!=='true';
      motion.setAttribute('aria-pressed',String(paused));motion.textContent=paused?'让星空流动':'暂停星空';
    }catch(error){
      if(current.signal.aborted)return;
      dispose();root!.dataset.renderer='static';root!.dataset.entry='complete';
      document.documentElement.classList.remove('universe-boot');
      console.warn('[about-universe] Static artwork fallback.',error);
    }
  }
  window.addEventListener('pagehide',()=>{close();dispose();});
  window.addEventListener('pageshow',event=>{syncHeader();if(event.persisted)void start(true);});
  reduced.addEventListener('change',()=>void start(true));
  // A direct landing on the meadow can defer the earlier Pixi chapter until the reader returns.
  let entryObserver:IntersectionObserver|null=null;
  if(document.documentElement.classList.contains('meadow-arrival')&&!reduced.matches){
    document.querySelector('#meadow')?.scrollIntoView({behavior:'instant'});
    entryObserver=new IntersectionObserver(([entry])=>{
      if(!entry.isIntersecting)return;
      entryObserver?.disconnect();entryObserver=null;void start(true);
    },{rootMargin:'180px 0px'});
    entryObserver.observe(root.querySelector('[data-earlier-worlds]')!);
  }else void start();
  if(import.meta.hot)import.meta.hot.dispose(()=>{
    entryObserver?.disconnect();dispose();navigationLifetime.abort();
    if(header){header.inert=false;header.removeAttribute('data-universe-hidden');header.removeAttribute('aria-hidden');}
  });
}
