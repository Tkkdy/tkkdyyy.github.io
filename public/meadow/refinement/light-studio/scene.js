import {sceneRecipe} from './studio-model.js';
import {createPassage} from './passage.js';
import {setLight} from './engine.js';
const root=document.body;
let initial;
try{initial=sceneRecipe();}catch{
 document.querySelector('#state').textContent='定稿参数有误，请从调光台重新生成。';
 throw Error('Invalid final lighting recipe');
}
setLight(initial.light);
function boot(){
 const d=window.__integration;
 if(d?.error)return;
 if(!d?.ready||!d.renderer){requestAnimationFrame(boot);return;}
 const r=d.renderer,originalExposure=r.toneMappingExposure;
 let view=initial.view;
 function light(p){setLight(p);r.toneMappingExposure=originalExposure*2**p.exposure;if(d.eveningLight.apply())d.refreshShadows();else d.invalidate();}
 function camera(name,yaw=0){
  view=name;
  if(name==='house')d.houseFrame();else d.viewTo(name);
  d.rotate(yaw);d.refreshShadows();
 }
 function png(){
  const w=innerWidth,h=innerHeight,old=r.getPixelRatio();
  const dst=document.createElement('canvas');
  try{
   r.setPixelRatio(Math.min(1920/Math.max(w,h),r.capabilities.maxTextureSize/Math.max(w,h)));
   d.eveningLight.updateLighting();r.shadowMap.needsUpdate=true;r.render(d.scene,d.camera);
   dst.width=r.domElement.width;dst.height=r.domElement.height;
   dst.getContext('2d').drawImage(r.domElement,0,0);
  }finally{r.setPixelRatio(old);d.refreshShadows();}
  return new Promise((resolve,reject)=>dst.toBlob(blob=>blob?resolve(blob):reject(Error('图像导出失败')),'image/png'));
 }
 function pose(){return {view,yaw:d.world.rotation.y};}
 const air=percent=>d.art.air.setAir?.(percent);
 const passage=parent!==window?createPassage(d):null;
 window.lightStudio={light,camera,pose,png,air,passage,scene:initial.scene};air(initial.air);
 camera(initial.view,initial.yaw);light(initial.light);root.classList.add('ready');
 if(parent!==window){
  const report=()=>parent.dispatchEvent(new Event('studio-pose'));
  document.querySelector('canvas').addEventListener('pointerup',report);
  addEventListener('keyup',e=>{if(e.key==='Home')view='default';report()});
  parent.dispatchEvent(new Event('studio-ready'));
 }else{
  const link=document.createElement('a');link.textContent='继续调光';link.style.cssText='position:fixed;right:4vw;bottom:24px;z-index:2';link.href='./index.html'+location.hash;link.onclick=()=>{link.href='./index.html#'+encodeURIComponent(JSON.stringify({...initial,...pose()}));};document.body.append(link);
 }
 let pending=0;
 addEventListener('resize',()=>{const yaw=d.world.rotation.y;cancelAnimationFrame(pending);pending=requestAnimationFrame(()=>{if(passage?.active)passage.resize();else camera(view,yaw)})});
}
if(parent!==window){
 document.querySelector('canvas').addEventListener('webglcontextlost',()=>{if(!window.__integration?.disposed)parent.dispatchEvent(new Event('meadow-failed'))},{once:true});
}
boot();
