import {passageSky} from './passage-sky';
import {waitForGraphics} from './graphics-scheduler';

(()=>{
 const root=document.querySelector('[data-meadow]'),slot=root.querySelector('.meadow-viewport'),status=root.querySelector('[role=status]');
 const flight=root.querySelector('[data-flight]'),retry=root.querySelector('[data-retry]');
 let frame=null,visible=false,near=false,failed=false,timeout=0,release=0,raf=0,close=false,yaw=0,progress=null;
 const journey=root.closest('[data-universe]'),oldStage=journey.querySelector('.universe-stage');
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{const t=clamp(n);return t*t*(3-2*t)};
 let arrival=1,lastPose=null,pending=0,geometryDirty=true,stageHeight=1,stageWidth=1,origin=0,pinned=false,lastState='';
 function measure(){
  pinned=!motion.matches && (journey.hasAttribute('data-staged')||journey.dataset.enhanced==='true'||(document.documentElement.classList.contains('meadow-arrival')&&journey.dataset.renderer!=='static'));
  stageWidth=root.clientWidth;stageHeight=pinned?root.offsetHeight:1;origin=journey.getBoundingClientRect().top+scrollY;geometryDirty=false;
 }
 function camera(force=false){
  const d=debug();if(!d?.compositionLayer||!pinned)return;
  const pose=arrival;
  if(!force&&pose===lastPose)return;
  if(close && pose===1)return;
  if(lastPose===1 && pose<1)yaw=d.world.rotation.y;
  if(close){close=false;progress=null;flight.textContent='沿银河，靠近小屋';cancelAnimationFrame(raf)}
  const passage=frame.contentWindow.lightStudio?.passage;
  if(!passage)return;
  const boundary=passage.active!==(pose<1);
  passage.set(pose,skyPose);
  if(pose===1&&lastPose===null){d.rotate(yaw)}
  if((boundary&&pose<1)||force)d.renderer.render(d.scene,d.camera);
  lastPose=pose;
 }
 const detailFrames=[34,32,30,28,26,23,20];
 let drawnPose=null,skyPose=null;
 const detailImages=new Map();
 function prepareArt(){
   if(detailImages.size)return;
   const art=root.querySelector('template[data-passage-art]');
   if(!art)return;
   for(const layer of art.content.querySelectorAll('[data-frame]')){
     detailImages.set(Number(layer.dataset.frame),layer.querySelector('img'));
   }
   art.replaceWith(art.content);drawnPose=null;
 }
 function updateDetail(index,phase){
   const target=detailFrames.find(i=>i<=index);
   const targetImage=detailImages.get(target);
   if(!targetImage){delete root.dataset.detail;return}
   if(targetImage.loading!=='eager')targetImage.loading='eager';
   // A later, already decoded sample is also usable inside the overscan.
   // Avoid magnifying a distant miniature while a close photograph is loading.
   let nearest=null,best=Infinity,bestScale=1;
   for(const [i,img] of detailImages){
     if(!img.complete||!img.naturalWidth)continue;
     const delta=ease(i/34)-phase,scale=1.16*.009**delta;
     if(scale>=1&&scale<1.85&&Math.abs(delta)<best){
       nearest=i;best=Math.abs(delta);bestScale=scale;
     }
   }
   if(nearest===null){delete root.dataset.detail;return}
   root.dataset.detail=String(nearest);
   root.style.setProperty('--detail-scale',String(bestScale));
 }
 root.addEventListener('load',event=>{
   if(event.target instanceof HTMLImageElement&&event.target.closest('.passage-detail')){
     if(event.target===detailImages.get(34))root.dataset.landingReady='true';
     drawnPose=null;schedule();
   }
 },true);
 function draw(){
  pending=0;if(geometryDirty)measure();
  if(!pinned){root.removeAttribute('data-passage');root.inert=false;root.style.pointerEvents='';oldStage.inert=false;return}
  const travel=(scrollY-origin)/stageHeight;
  arrival=clamp((travel-4.9)/2.55);
  const nextNear=travel>3.65&&travel<9.4,nextVisible=arrival>0&&travel<8.9;
  if(travel>2.7&&travel<9.4)prepareArt();
  const state=String(nextNear)+nextVisible;
  if(drawnPose===arrival&&state===lastState)return;
  drawnPose=arrival;
  skyPose=passageSky(stageWidth,stageHeight,arrival);
  const phase=ease(arrival);
  root.toggleAttribute('data-passage',true);

  root.style.setProperty('--planet',String(ease(arrival/.055)));
  root.style.setProperty('--sky',String(skyPose.blend));
  root.style.setProperty('--sky-transform','translate('+100*skyPose.newX+'%,'+100*skyPose.newY+'%) scale('+skyPose.incomingZoom+')');
  if(!root.hasAttribute('data-ready')){
    // Neighbouring fallback samples share the same optical axis. Scale from the
    // nearest overscanned photograph between samples; each frame has one foreground owner.
    const index=Math.round(arrival*34);
    updateDetail(index,phase);
    root.style.setProperty('--tile-x',(-100*(index%7))+'%');
    root.style.setProperty('--tile-y',(-100*Math.floor(index/7))+'%');
    root.style.setProperty('--tile-scale',String(1.16*.009**(ease(index/34)-phase)));
  }
  root.style.setProperty('--copy',String(ease((arrival-.84)/.16)));
  // The opaque meadow already occludes the stopped star field. Keep its compositor
  // layer in place so the last scroll steps need no layer-tree rebuild.
  oldStage.inert=arrival>.14;
  oldStage.style.setProperty('--depart-copy',String(1-ease(arrival/.15)));
  root.inert=arrival<.99;root.style.pointerEvents=root.inert?'none':'auto';
  camera();
  if(state!==lastState){lastState=state;near=nextNear;visible=nextVisible;sync()}
 }
 function schedule(){if(!pending)pending=requestAnimationFrame(draw)}
 function resizeFlight(){geometryDirty=true;lastPose=null;lastState='';schedule()}
 function debug(){
  // A failed navigation can leave a browser-owned error document in this slot.
  try{return frame?.contentWindow?.__integration}catch{return undefined}
 }
 function active(){return visible&&!document.hidden}
 function drop(remember=true){
  const old=frame;if(!old)return;
  clearTimeout(timeout);clearTimeout(release);cancelAnimationFrame(raf);
  const d=debug();if(remember&&d?.ready)yaw=d.world.rotation.y;
  frame=null;drawnPose=null;delete root.dataset.ready;schedule();flight.disabled=true;
  try{d?.dispose()}finally{old.remove()}
 }
 function fail(){
  if(failed)return;failed=true;drop(false);retry.hidden=false;status.textContent='三维场景暂未载入，可重试或继续阅读。';
 }
 let waiting=null;
 function queueStart(){
  if(frame||waiting||failed)return;
  const job=new AbortController();waiting=job;
  waitForGraphics(job.signal).then(()=>{
   if(waiting===job)waiting=null;
   if(!job.signal.aborted)start();
  });
 }
 function start(){
  if(frame||failed||document.hidden||!near)return;
  status.textContent='正在准备星球…';retry.hidden=true;
  frame=document.createElement('iframe');frame.title='暮色草坡，可拖动旋转';frame.src=root.dataset.src;
  frame.addEventListener('load',event=>{
   if(event.currentTarget===frame && !frame.contentDocument)fail();
  },{once:true});
  frame.waitForGraphics=signal=>waitForGraphics(signal,()=>near);
  slot.append(frame);timeout=setTimeout(()=>{
   if(!frame||root.dataset.ready)return;
   status.textContent='星球仍在载入，你可以继续阅读。';retry.hidden=false;
  },60000);
 }
 function ready(){
  const d=debug();if(!d?.ready||!frame.contentWindow.lightStudio)return;
  clearTimeout(timeout);retry.hidden=true;root.dataset.ready='true';flight.disabled=false;
  if(close&&progress!==null)d.compositionLayer.applyJourney(progress,frame.clientWidth,frame.clientHeight);
  d.rotate(yaw);lastPose=null;camera(true);sync();status.textContent='拖动旋转星球';
 }
 function sync(){
  clearTimeout(release);
  debug()?.setChapterVisible?.(active());
  if(!active()){cancelAnimationFrame(raf);raf=0}
  if(near&&!document.hidden){
   prepareArt();
   queueStart();
  }
  if((!near||document.hidden)&&waiting){waiting.abort();waiting=null}
  if(frame&&(!near||document.hidden))release=setTimeout(()=>drop(),8000);
 }
 const nearObserver=new IntersectionObserver(([entry])=>{if(!pinned){near=entry.isIntersecting;sync()}},{rootMargin:'400px 0px'});
 const onScreen=new IntersectionObserver(([entry])=>{if(!pinned){visible=entry.isIntersecting;sync()}});
 new MutationObserver(resizeFlight).observe(journey,{attributeFilter:['data-enhanced','data-renderer','data-staged']});
 new ResizeObserver(resizeFlight).observe(root);
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',resizeFlight);motion.addEventListener('change',resizeFlight);
 journey.querySelector('a[href="#meadow"]').addEventListener('click',event=>{
  if(!pinned||motion.matches||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  if(location.hash!=='#meadow')history.pushState(null,'','#meadow');
  document.querySelector('#meadow').scrollIntoView({behavior:'smooth'});
 });
 draw();nearObserver.observe(root);onScreen.observe(root);
 window.addEventListener('studio-ready',ready);
 window.addEventListener('meadow-failed',()=>{if(frame)fail()});
 document.addEventListener('visibilitychange',sync);
 window.addEventListener('pagehide',()=>{waiting?.abort();waiting=null;drop()});
 window.addEventListener('pageshow',e=>{if(e.persisted)sync()});
 retry.onclick=()=>{drop(false);failed=false;start()};
 flight.onclick=()=>{
  const d=debug();if(!d?.ready)return;cancelAnimationFrame(raf);
  if(close){d.viewTo('default');yaw=0;d.rotate(yaw);close=false;progress=null;flight.textContent='沿银河，靠近小屋';return}
  close=true;flight.textContent='回到星球全景';
  const begin=performance.now(),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:2400;
  function fly(now){if(!active())return;progress=duration?Math.min(1,(now-begin)/duration):1;
   d.compositionLayer.applyJourney(progress,frame.clientWidth,frame.clientHeight);if(progress<1)raf=requestAnimationFrame(fly)}
  raf=requestAnimationFrame(fly);
 };
})();
