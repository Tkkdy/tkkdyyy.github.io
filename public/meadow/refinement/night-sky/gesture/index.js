import * as T from 'three';

// No timer or RAF: the owning host calls update from its existing motion tick.
export function install(ctx) {
  const {camera, renderer, world, cosmic, invalidate = () => {}} = ctx;
  const stars = cosmic.exports.nodes.stars, canvas = renderer.domElement;
  const centers = stars.geometry.getAttribute('aCenter');
  const sizes = stars.geometry.getAttribute('aSize'), tints = stars.geometry.getAttribute('aTint');
  const painted = stars.geometry.getAttribute('aPainted');
  const baseSizes = sizes.array.slice(), baseTints = tints.array.slice();
  const levels = new Float32Array(centers.count);
  const abort = new AbortController(), options = {signal: abort.signal, passive: true};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');
  const motion = document.querySelector('#motion');
  const raycaster = new T.Raycaster(), ndc = new T.Vector2(), p = new T.Vector3();
  let disposed = false, pressed = false, armed = false, focused = true;
  let x = -1e5, y = -1e5, lastMove = -Infinity, lastUpdate = performance.now();
  let selected = [], projected = [], projectionKey = '', pendingMove = false, lastInputCheck = -Infinity;
  const occluders=[];
  world.traverse(o=>{if(o.isMesh)occluders.push(o);});
  const skyCache=new Map(),samples=[],meshWorldKeys=new WeakMap();
  let worldKey='';
  const cpu={pointerEvents:0,inputChecks:0,raycasts:0,updates:0,totalMs:0,maxMs:0};
  // This shift is part of the frozen atmosphere shader, not the source attribute.
  const shiftMatch = stars.material.vertexShader.match(/aPainted\s*\*\s*\.14\s*\*\s*([\d.]+)/);
  const paintedShift = shiftMatch ? .14 * Number(shiftMatch[1]) : 0;
  const visible = object => {for(let o=object;o;o=o.parent)if(!o.visible)return false;return true;};
  function enabled() {return !disposed && focused && !document.hidden && !reduce.matches && !coarse.matches && (!motion || motion.checked) && !ctx.isPaused?.() && visible(stars);}
  function apply(id, value) {
    levels[id] = value;
    sizes.setX(id, baseSizes[id] * (1 + .22 * value));
    for(let k=0;k<3;k++)tints.array[id*3+k]=baseTints[id*3+k]*(1+.65*value);
  }
  function clear() {
    armed=false;pendingMove=false;lastMove=-Infinity;selected=[];
    let changed=false;
    for(let i=0;i<levels.length;i++)if(levels[i]){apply(i,0);changed=true;}
    if(changed){sizes.needsUpdate=tints.needsUpdate=true;invalidate();}
    return changed;
  }
  // Raycast only real visible foreground meshes; sky shells do not obscure stars.
  function skyAt(px, py, rect, cacheId) {
    if(document.elementFromPoint(px,py)!==canvas)return false;
    const now=performance.now(),cached=skyCache.get(cacheId);
    if(cached && cached.key===projectionKey && now-cached.at<250 && Math.hypot(px-cached.x,py-cached.y)<5)return cached.sky;
    cpu.raycasts++;
    ndc.set((px-rect.left)/rect.width*2-1,1-(py-rect.top)/rect.height*2);
    raycaster.setFromCamera(ndc,camera);
    let blocked=false;
    for(const o of occluders){
      if(!o.parent || !visible(o))continue;
      const mats=Array.isArray(o.material)?o.material:[o.material];
      if(!mats.some(m=>m.visible && m.opacity>.05 && m.depthWrite))continue;
      // The renderer owns ordinary animated transforms. Refresh an ancestor
      // chain only after the root moved, not once per mesh on every ray.
      if(meshWorldKeys.get(o)!==worldKey){o.updateWorldMatrix(true,false);meshWorldKeys.set(o,worldKey);}
      if(raycaster.intersectObject(o,false).length){blocked=true;break;}
    }
    skyCache.set(cacheId,{key:projectionKey,at:now,x:px,y:py,sky:!blocked});
    return !blocked;
  }
  function project() {
    const r=canvas.getBoundingClientRect();
    if(!r.width || !r.height)return [];
    camera.updateWorldMatrix(true,false);stars.updateWorldMatrix(true,false);world.updateWorldMatrix(true,false);
    worldKey=world.matrixWorld.elements.join(',');
    const key=[...camera.matrixWorld.elements,...camera.projectionMatrix.elements,...stars.matrixWorld.elements,...world.matrixWorld.elements,r.left,r.top,r.width,r.height].join(',');
    if(key===projectionKey)return projected;
    projectionKey=key;projected=[];
    for(let i=0;i<centers.count;i++){
      p.fromBufferAttribute(centers,i);p.y+=painted.getX(i)*paintedShift;p.applyMatrix4(stars.matrixWorld).project(camera);
      if(p.z < -1 || p.z > 1 || Math.abs(p.x)>.98 || Math.abs(p.y)>.98)continue;
      const sx=r.left+(p.x+1)*r.width/2,sy=r.top+(1-p.y)*r.height/2;
      projected.push({id:i,x:sx,y:sy,painted:painted.getX(i)>.5});
    }
    return projected;
  }
  function onMove(e) {
    if(e.pointerType!=='mouse')return;
    cpu.pointerEvents++;
    if(e.buttons || pressed || !enabled()){clear();return;}
    if(e.clientX===x && e.clientY===y)return;
    x=e.clientX;y=e.clientY;
    pendingMove=true;
  }
  function processMove(now) {
    pendingMove=false;lastInputCheck=now;cpu.inputChecks++;
    const candidates=project().map(s=>({...s,d:Math.hypot(s.x-x,s.y-y)})).filter(s=>s.d<92).sort((a,b)=>a.d-b.d);
    // Empty background and UI movement must not traverse or raycast the planet.
    const rect=canvas.getBoundingClientRect();
    if(!candidates.length || !skyAt(x,y,rect,'pointer')){armed=false;return;}
    armed=true;lastMove=now;
    // Retiring stars retain their slot until faded: never light more than three.
    selected=selected.filter(id=>levels[id]>.002 || candidates.some(s=>s.id===id));
    let checked=0;
    for(const s of candidates){if(selected.length>=3 || checked>=3)break;if(!selected.includes(s.id)){checked++;if(skyAt(s.x,s.y,rect,s.id))selected.push(s.id);}}
  }
  function advance({delta}={}) {
    const now=performance.now(),dt=Math.min(.08,Math.max(0,delta??(now-lastUpdate)/1000));lastUpdate=now;
    if(!enabled() || pressed)return clear();
    // Pointer event rates can exceed refresh rate; at most 30 input checks/s.
    if(pendingMove && now-lastInputCheck>=33)processMove(now);
    if(!selected.length)return false;
    const points=project(),age=now-lastMove;
    const strength=armed?Math.max(0,1-Math.max(0,age-160)/1500):0;
    let changed=false;
    for(const id of selected){
      const s=points.find(s=>s.id===id),distance=s?Math.hypot(s.x-x,s.y-y):Infinity;
      const proximity=Math.max(0,1-distance/92);
      const target=strength*proximity*proximity;
      let value=levels[id]+(target-levels[id])*(1-Math.exp(-dt/(target > levels[id] ? .24 : .58)));
      if(value<.002 && target===0)value=0;
      if(Math.abs(value-levels[id])>1e-6){apply(id,value);changed=true;}
    }
    selected=selected.filter(id=>levels[id]>0 || strength>0);
    if(changed)sizes.needsUpdate=tints.needsUpdate=true;
    return changed;
  }
  function update(frame){
    if(!pendingMove && !selected.length)return false;
    const start=performance.now(),changed=advance(frame),ms=performance.now()-start;
    cpu.updates++;cpu.totalMs+=ms;cpu.maxMs=Math.max(cpu.maxMs,ms);samples.push(ms);if(samples.length>600)samples.shift();
    return changed;
  }
  canvas.addEventListener('pointermove',onMove,options);
  canvas.addEventListener('pointerleave',()=>{armed=false;pendingMove=false;},options);
  window.addEventListener('pointerdown',()=>{pressed=true;clear();},options);
  const release=()=>{pressed=false;clear();};
  window.addEventListener('pointerup',release,options);
  window.addEventListener('pointercancel',release,options);
  window.addEventListener('blur',()=>{focused=false;pressed=false;clear();},options);
  window.addEventListener('focus',()=>{focused=true;},options);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pressed=false;clear();}},options);
  motion?.addEventListener('change',clear,options);
  reduce.addEventListener('change',clear,options);coarse.addEventListener('change',clear,options);
  const api={update,inspect({includeStars=true}={}){
    const rect=canvas.getBoundingClientRect();
    const sorted=samples.slice().sort((a,b)=>a-b);
    return {enabled:enabled(),pressed,armed,disposed,affected:Array.from(levels).filter(v=>v>.002).length,maxResponse:Math.max(...levels),paintedShift,
      cpu:{...cpu,meanMs:cpu.totalMs/Math.max(1,cpu.updates),p95Ms:sorted[Math.floor(sorted.length*.95)]??0,occluders:occluders.length},
      visibleStars:includeStars?project().filter(s=>skyAt(s.x,s.y,rect,s.id)).map(s=>({...s,response:levels[s.id],baseSize:baseSizes[s.id],size:sizes.getX(s.id),brightnessGain:1+.65*levels[s.id]})):[]};
  },dispose(){if(disposed)return;clear();disposed=true;abort.abort();invalidate();}};
  ctx.signal?.addEventListener('abort',api.dispose,{once:true});
  return api;
}
