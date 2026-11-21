import {createLook,REVISION} from './material.js';
export {REVISION};
const active=new WeakSet();

export function install(ctx){
 const {water,debug,signal,invalidate}=ctx;
 signal?.throwIfAborted();
 const meshes=[];water.group.traverse(o=>{if(o.isMesh)meshes.push(o)});
 if(meshes.length!==1)throw Error('R8 D requires the retained unique water mesh');
 const mesh=meshes[0],source=mesh.material;
 if(active.has(mesh))throw Error('R8 D already installed');
 if(debug.r6Water?.material!==source)throw Error('R8 D requires the current R6 water chain');
 if(ctx.surface.revision!==ctx.hydrology.surfaceRevision)throw Error('R8 D surface and hydrology differ');
 for(const name of ['position','normal','chart','waterData','stageDelta'])if(!mesh.geometry.getAttribute(name))throw Error('R8 D missing retained '+name);
 const previous=debug.r8D,look=createLook(source,ctx);let disposed=false,published;
 function dispose(){
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);
  if(mesh.material===look.material)mesh.material=source;
  if(debug.r8D===published){if(previous===undefined)delete debug.r8D;else debug.r8D=previous;}
  look.material.dispose();active.delete(mesh);invalidate?.();
 }
 try{
  mesh.material=look.material;active.add(mesh);
  published={revision:REVISION,mesh,material:look.material,sourceMaterial:source,
   surfaceRevision:ctx.surface.revision,hydrologyRevision:ctx.hydrology.surfaceRevision,
   inspect:look.inspect,palette:look.palette,contacts:look.contacts,dispose,
   stats:{materials:1,geometryChanges:0,addedObjects:0,addedTextures:0,addedLights:0,addedClocks:0,contactUniforms:look.contacts.length},
   limitations:'Procedural optical body, finite inherited sky reflection and approximate rock footprint wash. No scene mirror, refraction, fluid solver, geometry displacement or new water surface.'};
  debug.r8D=published;signal?.addEventListener('abort',dispose,{once:true});signal?.throwIfAborted();invalidate?.();return {dispose};
 }catch(e){dispose();throw e;}
}
