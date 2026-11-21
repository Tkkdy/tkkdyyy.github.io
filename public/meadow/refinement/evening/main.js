import * as T from 'three';
import {setDetail} from '../storybook/detail.js';
import {applyReviewView} from '../visual-r4/review-views.js';
import {surface,hydrology,primeCachedSurface} from '../provider.js';
import * as originalRig from '../../shared/reference-rig.js';
import * as candidateRig from '../visual-r1/a-composition/rig.js';
const selected=new Set((new URLSearchParams(location.search).get('modules')??'a,b,c,d,e').split(',').filter(Boolean));
const {REFERENCE,applyView,addLights}=selected.has('a')?candidateRig:originalRig;
import {validateContract} from '../../shared/validate-contract.js';
import {attachToSurface} from '../../shared/placement.js';
import {sites} from '../../shared/fixture.js';
import {loadCache,createCachedScene} from '../cached-scene.js';
import {placeCelestials,celestialProjection} from '../visual-r1/celestial-layout.js';
import {attachJourney} from '../storybook/journey-controller.js';
import {createModule as createCosmic} from '../../modules/cosmic-background/index.js';
import {loadApprovedAssets} from '../../prototype-astra-world/planet-study/assets.js';

const r8Selection=new Set((new URLSearchParams(location.search).get('r8')??'a,b,c,d,e').split(',').filter(Boolean)),r8Installed=[];
const serialStartup=new URLSearchParams(location.search).get('startup')==='serial';
const importCache=new Map();
function importModule(path){if(!importCache.has(path)){const pending=import(path);pending.catch(()=>{});importCache.set(path,pending);}return importCache.get(path);}
function primeImports(ctx){
 if(serialStartup)return;
 const q=new URLSearchParams(location.search),set=(name,fallback)=>new Set((q.get(name)??fallback).split(',').filter(Boolean));
 for(const [id,path]of [['b','b-house'],['c','c-garden'],['d','d-water'],['e','e-ground']])if(selected.has(id))importModule('../visual-r1/'+path+'/index.js');
 for(const [round,fallback]of [['r3','terrain,rocks'],['r4','lighting,house,garden,ground,water'],['r5','lighting,house,garden,color'],['r6','water,ground,garden']])for(const id of set(round,fallback)){const path=round==='r3'&&id==='terrain'?'../visual-r9/performance/r3-terrain.js':'../visual-'+round+'/'+id+'/index.js';const pending=importModule(path);if(round==='r3'&&id==='terrain')pending.then(m=>m.preload({quality:ctx.quality,signal:ctx.signal})).catch(()=>{});}
 for(const [id,path]of [['a','a-structure'],['b','b-ground'],['c','c-ecology']])if(set('r7','a,b,c').has(id)){
  const pending=importModule((r8Selection.has(id)?'../visual-r9/':'../visual-r7/')+path+'/index.js');
  if(id==='a'&&r8Selection.has('a'))pending.then(m=>m.preload?.({quality:ctx.quality,signal:ctx.signal})).catch(()=>{});
 }
 for(const [id,path]of [['d','d-water'],['e','e-lighting']])if(r8Selection.has(id))importModule('../visual-r9/'+path+'/index.js');
}
const visualModules=[];
const debug=window.__integration={version:"Evening cove",baseline:"0123dce",ready:false,error:null,frames:0,updates:0,stats:{},frameTimes:[],cpuTimes:[],startup:{},view:'default'};
const abort=new AbortController(),motionTargets=new Map(),owned=[],canvas=document.querySelector('canvas');
const state=document.querySelector('#state'),metrics=document.querySelector('#metrics'),motion=document.querySelector('#motion');
const media=matchMedia('(prefers-reduced-motion: reduce)');
let renderer,scene,camera,world,water,ecology,shore,cosmic,assets,visible=true,dirty=true,shadowDirty=true,disposed=false;
let eveningLight;
let cleanupJourney=()=>{}, observer,lightingLayer,compositionLayer,landingLayer;
const query=new URLSearchParams(location.search),candidate='AE';
const layers=new Set((query.get('layers')??'meadow,littoral,homestead,understory,wildflowers,atmosphere,framing').split(','));
const additions=[];debug.art={};
const compositionEntries={current:'index',c1:'camera-c1',c2:'camera-c2',c3:'camera-c3',c4:'camera-c4',c5:'camera-c5-pre-sun'},compositionVersion=query.get('compositionVersion')??'current';
const lightingEntries={current:'index',l2:'index-l2',l3:'index-l3-rejected'},lightingVersion=query.get('lightingVersion')??'current';
if(!Object.hasOwn(compositionEntries,compositionVersion)||!Object.hasOwn(lightingEntries,lightingVersion))throw Error('Unknown archived experiment');
if(!['N','L','C','LC','H','B','A','AB','D','AD','E','AE'].includes(candidate))throw Error('Unknown candidate');
let motionOverride=false,elapsed=0,last=0,drag=null,frameHandle=0;
motion.checked=!media.matches;
const invalidate=()=>{dirty=true;scheduleFrame()};
function registerMotion(target,kind){if(!target?.isObject3D||motionTargets.has(target.uuid))throw Error('Invalid or duplicate motion target');motionTargets.set(target.uuid,{target,kind});return()=>motionTargets.delete(target.uuid)}
let sliceStart=performance.now();
async function graphicsTurn(){
 abort.signal.throwIfAborted();
 if(performance.now()-sliceStart>=10){
  if(globalThis.scheduler?.yield)await scheduler.yield();
  else await new Promise(resolve=>setTimeout(resolve,0));
  sliceStart=performance.now();
 }
 await window.frameElement?.waitForGraphics?.(abort.signal);
 abort.signal.throwIfAborted();
}
const phase=async text=>{state.textContent=text;await graphicsTurn()};
function cameraView(name){debug.view=name;if(compositionLayer)compositionLayer.applyView(name,innerWidth,innerHeight);else applyView(camera,world,name,innerWidth,innerHeight);invalidate()}
function inspect(name){
 debug.view=name;world.rotation.set(0,0,0);
 const currentHydrology=debug.hydrology??hydrology;
 const p=name==='source'?currentHydrology.river[0]:name==='mouth'?currentHydrology.river.at(-1):{u:-5,v:5};
 const top=name==='top',distance=top?32:name==='shore'?13:9;
 const target=new T.Vector3(...currentHydrology.radialPoint(top?-1:p.u,top?3:p.v,top?0:(p.waterHeight??currentHydrology.seaLevel)));
 camera.position.copy(target).add(new T.Vector3(.24,Math.sin(top?1.45:.82),Math.cos(top?1.45:.82)).normalize().multiplyScalar(distance));
 camera.lookAt(target);camera.updateProjectionMatrix();invalidate();
}
function resize(){
 renderer.setPixelRatio(innerWidth<650?Math.min(devicePixelRatio,1.5):Math.min(Math.max(devicePixelRatio,1.5),1.75));
 placeCelestials(cosmic,innerWidth<650,selected.has('a'));renderer.setSize(innerWidth,innerHeight);cameraView(['default','close','rotate'].includes(debug.view)?debug.view:'default');debug.syncJourney?.();
}
const lastShadowWorld=new T.Matrix4();
let chapterVisible=true;
function scheduleFrame(){
 if(!frameHandle&&debug.ready&&!disposed&&chapterVisible&&visible&&!document.hidden)frameHandle=requestAnimationFrame(tick);
}
function syncFrames(){
 cancelAnimationFrame(frameHandle);frameHandle=0;last=0;
 scheduleFrame();
}
debug.setChapterVisible=v=>{if(v!==chapterVisible){chapterVisible=v;syncFrames()}};
document.addEventListener('visibilitychange',syncFrames,{signal:abort.signal});
function tick(now){
 frameHandle=0;
 if(disposed||!chapterVisible||document.hidden||!visible)return;
 const rawDelta=last?(now-last)/1000:0,delta=Math.min(.05,rawDelta);last=now;
 if(visible&&!document.hidden){
  if(debug.ready&&(eveningLight?.updateLighting()||lightingLayer?.updateLighting?.())){shadowDirty=true;dirty=true;}
  if(debug.ready&&motion.checked){elapsed+=delta;let changed=false;for(const m of [water,ecology,cosmic,...visualModules])if((!m.group||m.group.visible)&&m.update)changed=m.update({elapsed,delta,reducedMotion:false})||changed;if(changed){debug.updates++;dirty=true}}
  if(debug.ready&&dirty){
   const before=performance.now();
   // A rigid world rotation also rotates its lights. Keep cached light-space
   // depth, but refresh its world-to-shadow matrix before camera projection.
   if(!shadowDirty){world.updateWorldMatrix(true,false);if(!lastShadowWorld.equals(world.matrixWorld)){world.traverse(o=>{if(o.isLight&&o.castShadow){o.updateWorldMatrix(true,false);o.shadow.updateMatrices(o)}})}}
   renderer.shadowMap.needsUpdate=shadowDirty;shadowDirty=false;
   renderer.render(scene,camera);lastShadowWorld.copy(world.matrixWorld);dirty=false;debug.frames++;
   const cpu=performance.now()-before;debug.cpuTimes.push(cpu);if(debug.cpuTimes.length>300)debug.cpuTimes.shift();
   debug.stats={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,cpuSubmissionMs:cpu,dpr:renderer.getPixelRatio()};

  }
  if(debug.ready&&delta>0){debug.frameTimes.push(rawDelta*1000);if(debug.frameTimes.length>300)debug.frameTimes.shift()}
 }
 if(dirty||motion.checked)scheduleFrame();
}
function releaseAssets(){if(assets){const geometries=new Set(),materials=new Set(),textures=new Set();for(const object of [assets.cottage,assets.tree,...assets.rocks])object.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value)}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();} assets=null;}
function dispose(){
 if(disposed)return;disposed=true;window.lightStudio?.passage?.dispose();debug.ready=false;cancelAnimationFrame(frameHandle);cleanupJourney();observer?.disconnect();
 // Restore stacked candidate references before releasing their source owners.
 for(const m of [...owned].reverse())m.dispose();abort.abort();renderer?.dispose();renderer?.forceContextLoss();
 // Release only this host's loader instance; never source files or another preview's resources.
 releaseAssets();
 debug.disposed=true;debug.remainingMotionTargets=motionTargets.size;
}
debug.dispose=dispose;addEventListener('pagehide',dispose,{once:true,signal:abort.signal});
try{
 const start=performance.now();
 renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=REFERENCE.exposure;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
 scene=new T.Scene();world=new T.Group();scene.add(world);addLights(world);camera=new T.PerspectiveCamera(41,1,.1,100);
 const ctx={surface,hydrology,signal:abort.signal,seed:4141,quality:innerWidth<650?'mobile':'desktop',invalidate,registerMotion,motionTargets};

 if(surface.revision!=='terrain-20261114-r5')throw Error('Frozen terrain revision mismatch');
 const loadStart=performance.now();
 // All requests start together; immediately observe failures and dispose late assets.
 primeImports(ctx);
 import('../arrival-study/bake/runtime.js').then(m=>m.preloadCoast(ctx.quality,ctx.signal)).catch(()=>{});
 const cachePromise=loadCache(ctx.quality,abort.signal);
 const cosmicPromise=createCosmic({...ctx,registerMotion:undefined});
 const assetPromise=loadApprovedAssets().then(value=>{assets=value;if(disposed){releaseAssets();throw new DOMException('Aborted','AbortError')}return value});
 const pending=Promise.all([cachePromise,cosmicPromise,assetPromise]);pending.catch(()=>{});
 await phase('正在准备地表、草甸与原有模型…');
 const [data,loadedCosmic]=await pending;abort.signal.throwIfAborted();
 await graphicsTurn();
 debug.startup.resourcesMs=performance.now()-loadStart;debug.startup.cache=data.timing;
 primeCachedSurface(data);debug.contract=validateContract(surface,hydrology);
 const assembly=performance.now();const cached=await createCachedScene(ctx,data,{baselinePigment:new URLSearchParams(location.search).has('baselinePigment')});
 for(const m of Object.values(cached)){owned.push(m);world.add(m.group)}
 const {terrain}=cached;water=cached.water;ecology=cached.ecology;shore=cached.shore;
 debug.startup.assemblyMs=performance.now()-assembly;
 cosmic=loadedCosmic;owned.push(cosmic);scene.add(cosmic.group);cosmic.exports.setMotionEnabled(false);
 attachToSurface(assets.cottage,{id:'House',...sites.cottage,offset:-.025},world,surface);
 attachToSurface(assets.tree,{id:'FlowerTree',...sites.tree,offset:0},world,surface);
 const rawPaintMaterials=new Map();for(const group of [assets.cottage,assets.tree])group.traverse(o=>{if(o.isMesh)rawPaintMaterials.set(o,o.material)});
 const visualContext={rawPaintMaterials,...ctx,scene,world,camera,renderer,terrain,water,ecology,shore,cosmic,assets,invalidate,debug};
 for(const [id,path]of [['b','b-house'],['c','c-garden'],['d','d-water'],['e','e-ground']])if(selected.has(id)){
  const moduleStart=performance.now();const module=await importModule('../visual-r1/'+path+'/index.js');const result=await module.install(visualContext);
  (debug.startup.visualModulesMs??={})[id]=performance.now()-moduleStart;
  if(result){result.moduleId=id;visualModules.push(result);owned.push(result)}
 }
 const r3Selection=new Set((new URLSearchParams(location.search).get('r3')??'terrain,rocks').split(',').filter(Boolean));
 for(const id of ['terrain','rocks'])if(r3Selection.has(id)){
  const start=performance.now(),{install}=await importModule(!serialStartup&&id==='terrain'?'../visual-r9/performance/r3-terrain.js':'../visual-r3/'+id+'/index.js');
  await graphicsTurn();const result=await install(visualContext);if(result){result.moduleId='r3-'+id;visualModules.push(result);owned.push(result);if(result.surface)visualContext.surface=result.surface;if(result.hydrology)visualContext.hydrology=result.hydrology;}
  (debug.startup.r3ModulesMs??={})[id]=performance.now()-start;
 }
 const r7Selection=new Set((new URLSearchParams(location.search).get('r7')??'a,b,c').split(',').filter(Boolean));
 const r7Installed=[];
 async function addR7(id,path){if(!r7Selection.has(id))return;if(['b','c'].includes(id)&&!debug.r6Ground){(debug.r7Skipped??=[]).push({id,reason:'R6 ground explicitly disabled'});return;}const started=performance.now(),{install}=await importModule((r8Selection.has(id)?'../visual-r9/':'../visual-r7/')+path+'/index.js');await graphicsTurn();const result=await install(visualContext);if(result){result.moduleId='r7-'+id;r7Installed.push(id);if(r8Selection.has(id))r8Installed.push(id);visualModules.push(result);owned.push(result);if(result.surface)visualContext.surface=result.surface;if(result.hydrology)visualContext.hydrology=result.hydrology;} (debug.startup.r7ModulesMs??={})[id]=performance.now()-started;}
 await addR7('a','a-structure');
 const r5Selection=new Set((new URLSearchParams(location.search).get('r5')??'lighting,house,garden,color').split(',').filter(Boolean));
 async function addR5(id){if(!r5Selection.has(id))return;const start=performance.now(),{install}=await importModule('../visual-r5/'+id+'/index.js');await graphicsTurn();const result=await install(visualContext);if(result){result.moduleId='r5-'+id;visualModules.push(result);owned.push(result);} (debug.startup.r5ModulesMs??={})[id]=performance.now()-start;}
 const r4Selection=new Set((new URLSearchParams(location.search).get('r4')??'lighting,house,garden,ground,water').split(',').filter(Boolean));
 for(const id of ['lighting','house','garden','ground','water'])if(r4Selection.has(id)){
  const started=performance.now(),{install}=await importModule('../visual-r4/'+id+'/index.js');
  await graphicsTurn();const result=await install(visualContext);if(result){result.moduleId='r4-'+id;visualModules.push(result);owned.push(result);}
  (debug.startup.r4ModulesMs??={})[id]=performance.now()-started;
  if(['lighting','house','garden'].includes(id))await addR5(id);
 }
 await addR5('color');debug.r5Modules=[...r5Selection];
 const r6Selection=new Set((new URLSearchParams(location.search).get('r6')??'water,ground,garden').split(',').filter(Boolean));
 for(const id of ['water','ground','garden'])if(r6Selection.has(id)){const started=performance.now(),{install}=await importModule('../visual-r6/'+id+'/index.js');await graphicsTurn();const result=await install(visualContext);if(result){result.moduleId='r6-'+id;visualModules.push(result);owned.push(result);} (debug.startup.r6ModulesMs??={})[id]=performance.now()-started;}debug.r6Modules=[...r6Selection];
 await addR7('b','b-ground');await addR7('c','c-ecology');debug.r7Modules=r7Installed;
 for(const [id,path]of [['d','d-water'],['e','e-lighting']])if(r8Selection.has(id)){if(id==='d'&&!debug.r6Water){(debug.r8Skipped??=[]).push({id,reason:'R6 water explicitly disabled'});continue;}const started=performance.now(),{install}=await importModule('../visual-r9/'+path+'/index.js');await graphicsTurn();const result=await install(visualContext);if(result){result.moduleId='r8-'+id;visualModules.push(result);owned.push(result);r8Installed.push(id);}(debug.startup.r8ModulesMs??={})[id]=performance.now()-started;}debug.r8Modules=r8Installed;

 const fusionSnapshot=()=>({exposure:renderer.toneMappingExposure,fog:scene.fog?{color:scene.fog.color.getHex(),near:scene.fog.near,far:scene.fog.far}:null,lights:(()=>{const ls=[];world.traverse(o=>{if(o.isLight)ls.push({name:o.name,color:o.color.getHex(),groundColor:o.groundColor?.getHex(),intensity:o.intensity,position:o.position.toArray(),target:o.target?.position.toArray(),shadowIntensity:o.shadow?.intensity})});return ls})(),subjects:[assets.cottage,assets.tree].flatMap(g=>{const result=[];g.traverse(o=>{if(o.isMesh)result.push({name:o.name,geometry:o.geometry.uuid,material:o.material.uuid,matrix:o.matrix.toArray()})});return result}),camera:{position:camera.position.toArray(),projection:camera.projectionMatrix.toArray()}});
 const beforeFusion=fusionSnapshot();
 if(new URLSearchParams(location.search).get('fusion')!=='off')for(const path of ['../fusion-ab/ground.js','../fusion-ab/water.js']){const {install}=await import(path);await graphicsTurn();const result=await install(visualContext);if(result){result.moduleId='fusion-'+path;visualModules.push(result);owned.push(result);}}
 const afterFusion=fusionSnapshot();debug.detailLayerPreservation={pass:JSON.stringify(beforeFusion)===JSON.stringify(afterFusion),before:beforeFusion,after:afterFusion};
 if(new URLSearchParams(location.search).get('light')!=='off'){const {install}=await import('../light-transfer/lighting.js');await graphicsTurn();const result=await install(visualContext);if(result){result.moduleId='light-transfer';visualModules.push(result);owned.push(result);}}
 debug.r4Modules=[...r4Selection];
 debug.contract=validateContract(visualContext.surface,visualContext.hydrology);
 debug.r3Modules=[...r3Selection];debug.surface=visualContext.surface;debug.hydrology=visualContext.hydrology;
 debug.visualModules=[...selected];debug.assets=assets;debug.ecology=ecology;debug.terrain=terrain;
 debug.reviewView=name=>{debug.view='review:'+name;if(compositionLayer)compositionLayer.applyView(name,innerWidth,innerHeight);else applyReviewView(camera,world,name,visualContext.surface,innerWidth,innerHeight);invalidate()};
 debug.referenceView=name=>{camera.near=.1;camera.far=100;originalRig.applyView(camera,world,name,innerWidth,innerHeight);invalidate()};
 resize();
 const baselineSurface=visualContext.surface,baselineHydrology=visualContext.hydrology;
 debug.candidate=candidate;debug.compositionVersion=compositionVersion;debug.lightingVersion=lightingVersion;
 visualContext.baked=query.get('baked')!=='0';
 const coastMode = ['D','AD','E','AE'].includes(candidate) ? 'D' : candidate === 'H' ? 'H' : ['B','AB'].includes(candidate) ? 'B' : null;
 if (!['N','L'].includes(candidate)) {
  const source=layers.has('framing')?'../storybook/framing.js':'../arrival-study/coast/landing/index.js';
  const coastStarted = performance.now();
  await graphicsTurn();compositionLayer = await (await import(source)).install({...visualContext,coastMode});
  debug.startup.coastMs=performance.now()-coastStarted;
  owned.push(compositionLayer);if(compositionLayer.surface){visualContext.surface=compositionLayer.surface;debug.surface=compositionLayer.surface}if(compositionLayer.hydrology){visualContext.hydrology=compositionLayer.hydrology;debug.hydrology=compositionLayer.hydrology}compositionLayer.applyView('default',innerWidth,innerHeight);debug.compositionLayer=compositionLayer;}
 if (candidate==='E'||candidate==='AE') {
  await graphicsTurn();landingLayer=await (await import('../arrival-study/coast/clear-landing.js')).install(visualContext);
  owned.push(landingLayer);debug.landingLayer=landingLayer;
 }
 debug.houseFrame=()=>{
  debug.reviewView('house');
  camera.position.add(new T.Vector3(0,1,0).applyQuaternion(camera.quaternion).multiplyScalar(1.1));
  camera.fov=48;camera.updateProjectionMatrix();debug.view='house-frame';invalidate();
 };
 debug.contract=validateContract(visualContext.surface,visualContext.hydrology);
 if (['L','LC','A','AB','AD','AE'].includes(candidate)) {
  const source = candidate.startsWith('A') ? '../arrival-study/house/index.js' : './lighting/'+lightingEntries[lightingVersion]+'.js';
  await graphicsTurn();lightingLayer=await(await import(source)).install(visualContext);owned.push(lightingLayer);lightingLayer.updateLighting?.();debug.lightingLayer=lightingLayer;}
 for(const name of ['littoral','meadow','homestead','understory','wildflowers','atmosphere']){
  if(!layers.has(name))continue;
  const mod=await import('../storybook/'+name+'/index.js');
  const start=performance.now();
  await graphicsTurn();const part=await mod.install(visualContext);
  additions.push(part);owned.push(part);if(part.update)visualModules.push(part);
  debug.art[name]=part; (debug.startup.artModulesMs??={})[name]=performance.now()-start;
 }
 const eveningSelection=new Set((query.get('evening')??'light,eaves,air').split(','));
 for(const name of ['light','eaves','air']){
  if(!eveningSelection.has(name))continue;
  const started=performance.now(),part=await (await import('./'+name+'/index.js')).install(visualContext);
  if(name==='light')eveningLight=part;
  additions.push(part);owned.push(part);debug.art[name]=part;
  debug.startup.artModulesMs[name]=performance.now()-started;
 }
 const key=world.getObjectByName('R1 twilight key'),keyOriginal={intensity:key.intensity,position:key.position.clone(),target:key.target.position.clone()};
 debug.setKey=mode=>{if(!['normal','off','turned'].includes(mode))throw Error('Unknown light state');if(eveningLight){eveningLight.setKey(mode);shadowDirty=true;invalidate();debug.keyState=mode;return;}key.intensity=mode==='off'?0:keyOriginal.intensity;key.position.copy(keyOriginal.position);key.target.position.copy(keyOriginal.target);if(mode==='turned')key.position.set(20,19,7);lightingLayer?.updateLighting?.();shadowDirty=true;invalidate();debug.keyState=mode;};debug.keyState='normal';
 debug.resetCandidate=()=>{debug.setKey('normal');for(const part of additions.splice(0).reverse()){const i=visualModules.indexOf(part);if(i>=0)visualModules.splice(i,1);part.dispose();}debug.art={};eveningLight=undefined;lightingLayer?.dispose();landingLayer?.dispose();landingLayer=debug.landingLayer=undefined;compositionLayer?.dispose();lightingLayer=compositionLayer=undefined;debug.lightingLayer=debug.compositionLayer=undefined;visualContext.surface=baselineSurface;visualContext.hydrology=baselineHydrology;debug.surface=baselineSurface;debug.hydrology=baselineHydrology;debug.candidate='N';cleanupJourney();if(document.body.classList.contains('journey'))cleanupJourney=attachJourney({camera,world,cosmic,invalidate,signal:abort.signal,debug});cameraView('default');shadowDirty=true;invalidate();};
 if(document.body.classList.contains('journey'))cleanupJourney=attachJourney({camera,world,cosmic,invalidate,signal:abort.signal,debug,compositionLayer});
 await phase('正在准备水纹、微风与光影…');
 // The frozen drawing contains superseded, hidden development layers. Only
 // compile drawables that can be presented. Keep the real scene as lighting target.
 const drawables=[];
 scene.traverseVisible(o=>{if(o.material)drawables.push(o)});
 const compileList=new T.Scene();
 compileList.traverse=visit=>drawables.forEach(visit);
 const compileStart=performance.now();await renderer.compileAsync(compileList,camera,scene);abort.signal.throwIfAborted();
 debug.startup.compileMs=performance.now()-compileStart;
 // compileAsync does not compile shadow depth variants. Warm them explicitly.
 const depthStart=performance.now(),casters=[];
 scene.traverseVisible(o=>{if(o.isMesh&&o.castShadow){const depth=new T.MeshDepthMaterial({side:o.material.side===T.DoubleSide?T.DoubleSide:T.BackSide});o.customDepthMaterial=depth;casters.push([o,o.material,depth]);}});
 owned.push({dispose(){for(const [o,,m]of casters){o.customDepthMaterial=undefined;m.dispose()}}});
 for(const [o,,m]of casters)o.material=m;
 try{await renderer.compileAsync(compileList,camera,scene)}finally{for(const [o,m]of casters)o.material=m}
 abort.signal.throwIfAborted();debug.startup.shadowCompileMs=performance.now()-depthStart;
 await phase('正在准备着色器首用…');
 const warmStart=performance.now();
 // Three 0.187 program objects: pre-resolve uniforms in bounded tasks, with shader diagnostics enabled.
 let warmSliceStart=performance.now(),warmYields=0;
 for(const program of renderer.info.programs){
  abort.signal.throwIfAborted();program.getUniforms();
  // Timers are clamped after nested yields. Yield for actual work budgets,
  // rather than paying a timer turn for every already-ready program.
  if(performance.now()-warmSliceStart>=8){await new Promise(resolve=>setTimeout(resolve,0));warmYields++;warmSliceStart=performance.now();}
 }
 debug.startup.programWarmYields=warmYields;
 debug.startup.programWarmMs=performance.now()-warmStart;
 await phase('正在呈现星球…');
 renderer.shadowMap.needsUpdate=true;const first=performance.now();renderer.render(scene,camera);
 debug.startup.firstSubmitMs=performance.now()-first;shadowDirty=false;dirty=false;debug.frames++;
 debug.stats={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,cpuSubmissionMs:debug.startup.firstSubmitMs,dpr:renderer.getPixelRatio()};
 metrics.textContent=debug.stats.calls+' calls · '+debug.stats.triangles.toLocaleString()+' 提交三角面';
 // A ready label is only emitted after the first actual frame, not after JS construction.
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));abort.signal.throwIfAborted();
 debug.startup.readyMs=performance.now()-start;debug.startup.firstFrameFromNavigationMs=performance.now();debug.ready=true;
 state.textContent=document.body.classList.contains('journey')?'向下滚动，靠近星球':'可拖动旋转星球，或查看河口与岸线';
 debug.modules={terrain:terrain.group.userData,water:water.group.userData,ecology:ecology.group.userData,shore:shore.stats,cosmic:cosmic.exports.artwork};
 debug.motionTargets=[...motionTargets.values()].map(x=>({kind:x.kind,windOwner:x.target.userData.ecosystem?.windOwner}));
 debug.viewTo=cameraView;debug.inspection=inspect;debug.rotate=y=>{world.rotation.y=y;invalidate()};
 debug.bookView=name=>setDetail(debug,name,innerWidth,innerHeight);
 debug.layer=(id,show)=>{
  ({water,plants:ecology,shore,cosmic}[id]).group.visible=show;
  if(id==='plants'){
   for(const m of visualModules)if(['c','r7-a'].includes(m.moduleId)&&m.group)m.group.visible=show;
   for(const name of ['meadow','understory','wildflowers'])if(debug.art[name]?.group)debug.art[name].group.visible=show;
  }
  if(id==='shore'){const group=world.getObjectByName('storybook-littoral');if(group)group.visible=show;}
  shadowDirty=true;invalidate();
 };
 debug.cosmic=cosmic;debug.shore=shore;debug.world=world;debug.camera=camera;debug.water=water;debug.scene=scene;
 debug.dispose=dispose;debug.invalidate=invalidate;debug.renderer=renderer;debug.celestials=()=>celestialProjection(cosmic,camera,innerWidth,innerHeight);debug.refreshShadows=()=>{shadowDirty=true;invalidate()};
 syncFrames();
}catch(error){dispose();if(error.name!=='AbortError'){debug.error=String(error);if(parent!==window)parent.dispatchEvent(new Event('meadow-failed'));state.textContent='载入失败，请刷新重试：'+error.message;console.error(error)}}
document.querySelectorAll('[data-book-view]').forEach(b=>b.onclick=()=>debug.ready&&debug.bookView(b.dataset.bookView));
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>debug.ready&&cameraView(b.dataset.view));
document.querySelectorAll('[data-inspect]').forEach(b=>b.onclick=()=>debug.ready&&inspect(b.dataset.inspect));
for(const id of ['water','plants','shore','cosmic'])document.querySelector('#'+id).onchange=e=>debug.ready&&debug.layer(id,e.target.checked);
motion.onchange=()=>{motionOverride=true;invalidate()};media.addEventListener('change',()=>{if(!motionOverride){motion.checked=!media.matches;invalidate()}},{signal:abort.signal});
canvas.onpointerdown=e=>{if(!debug.ready||document.body.classList.contains('journey'))return;drag={x:e.clientX,yaw:world.rotation.y};canvas.setPointerCapture(e.pointerId)};
canvas.onpointermove=e=>{if(drag)debug.rotate(drag.yaw+(e.clientX-drag.x)*.006)};
canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
addEventListener('resize',()=>debug.ready&&resize(),{signal:abort.signal});
addEventListener('keydown',e=>{if(!debug.ready)return;if(e.key==='Home')cameraView('default');if(e.key==='ArrowLeft')debug.rotate(world.rotation.y-.12);if(e.key==='ArrowRight')debug.rotate(world.rotation.y+.12)},{signal:abort.signal});
if(!disposed){observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;syncFrames()});observer.observe(canvas)}

document.querySelectorAll('[data-r3-view]').forEach(b=>b.onclick=()=>debug.ready&&debug.reviewView(b.dataset.r3View));


document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=async()=>{if(!debug.ready)return;const {inspectDetail}=await importModule('../visual-r9/review-views.js');debug.view='detail:'+b.dataset.detail;if(compositionLayer)compositionLayer.applyView(b.dataset.detail,innerWidth,innerHeight);else inspectDetail(debug,b.dataset.detail,innerWidth,innerHeight);});
