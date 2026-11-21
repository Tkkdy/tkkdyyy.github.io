import {createLook,REVISION} from './material.js';
export {REVISION};
const active=new WeakSet();
export function install(ctx){
 const {water,world,debug,signal,invalidate}=ctx;signal.throwIfAborted();
 const meshes=[];water.group.traverse(o=>{if(o.isMesh)meshes.push(o)});
 if(meshes.length!==1)throw Error('R4 water requires exactly one retained water mesh');
 const mesh=meshes[0],original=mesh.material,lighting=world.userData.r4Lighting;
 if(active.has(mesh))throw Error('R4 water already installed');
 if(!lighting||lighting.profile!=='warm-night')throw Error('R4 water requires the approved warm-night lighting');
 if(debug.waterLook?.material!==original)throw Error('R4 water requires the retained R1 water layer');
 const previous=debug.r4Water,look=createLook(original,ctx),previousRender=mesh.onBeforeRender;
 const render=function(...args){previousRender.apply(this,args);look.sync()};
 let disposed=false,published;
 const dispose=()=>{
  if(disposed)return;disposed=true;signal.removeEventListener('abort',dispose);
  if(mesh.material===look.material)mesh.material=original;
  if(mesh.onBeforeRender===render)mesh.onBeforeRender=previousRender;
  if(debug.r4Water===published){if(previous===undefined)delete debug.r4Water;else debug.r4Water=previous}
  look.material.dispose();active.delete(mesh);invalidate?.();
 };
 try{
  mesh.material=look.material;mesh.onBeforeRender=render;active.add(mesh);
  published={revision:REVISION,lightingRevision:lighting.revision,lightingProfile:lighting.profile,houseLightingRevision:look.houseRevision,emitters:look.emitters,
   mesh,material:look.material,originalMaterial:original,inspect:look.inspect,dispose,
   limitation:'Finite sky artwork and emitter lobes only; no object mirror, refraction, or new water geometry.'};
  debug.r4Water=published;signal.addEventListener('abort',dispose,{once:true});invalidate?.();
  return {dispose};
 }catch(error){dispose();throw error}
}
