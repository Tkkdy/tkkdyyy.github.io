import {REVISION,createWaterLook} from './material.js';
const activeMeshes=new WeakSet();

export function install(context) {
  const {water,signal,debug,invalidate}=context;
  signal.throwIfAborted();
  const records=[],previousDebug=debug.waterLook;
  let disposed=false,published;
  const dispose=()=>{
    if(disposed)return;disposed=true;signal.removeEventListener('abort',dispose);
    for(const {mesh,original,look,previousRender,render} of records){
      if(mesh.material===look.material)mesh.material=original;
      if(mesh.onBeforeRender===render)mesh.onBeforeRender=previousRender;
      look.material.dispose();activeMeshes.delete(mesh);
    }
    if(debug.waterLook===published){
      if(previousDebug===undefined)delete debug.waterLook;else debug.waterLook=previousDebug;
    }
    invalidate?.();
  };
  try{
    const meshes=[];water.group.traverse(o=>{if(o.isMesh)meshes.push(o)});
    if(meshes.length!==1)throw Error('D water requires the unique frozen water mesh');
    const mesh=meshes[0],original=mesh.material,previousRender=mesh.onBeforeRender;
    for(const key of ['chart','waterData','stageDelta'])if(!mesh.geometry.attributes[key])throw Error('Missing r5 water attribute: '+key);
    if(activeMeshes.has(mesh))throw Error('D water is already installed on this mesh');
    const look=createWaterLook(original,context);
    const render=function(...args){previousRender.apply(this,args);look.sync()};
    records.push({mesh,original,look,previousRender,render});
    mesh.material=look.material;mesh.onBeforeRender=render;activeMeshes.add(mesh);
    published={
      revision:REVISION,houseLightingRevision:debug.houseLighting?.revision??null,
      reflection:'analytic distant sky + finite galaxy-art plane ray projection + source-position specular lobes',
      limitations:'No scene mirror, refraction, or detailed reflected-object occlusion. Finite sky art falls back to a low-frequency field.',
      uniqueWaterMeshes:1,geometryUnchanged:true,sharedClock:true,newRenderTargets:0,newTextures:0,
      material:look.material,originalMaterial:original,mesh,
      time:()=>look.inspect().clock,
      inspect:look.inspect,
      lampWorldPositions:()=>look.uniforms.dLampPosition.value.map(v=>v.toArray()),
      skyInverse:()=>look.uniforms.dSkyInverse.value.toArray(),
      dispose,
    };
    debug.waterLook=published;
    signal.addEventListener('abort',dispose,{once:true});invalidate?.();
    return {dispose};
  }catch(error){dispose();throw error}
}
