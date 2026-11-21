import {createLook,REVISION} from './material.js';
export {REVISION};
const active=new WeakSet();
export function install(ctx){
 const {water,debug,signal,invalidate}=ctx;signal.throwIfAborted();
 const meshes=[];water.group.traverse(o=>{if(o.isMesh)meshes.push(o)});
 if(meshes.length!==1)throw Error('R6 water requires the retained unique mesh');
 const mesh=meshes[0],source=mesh.material;
 if(active.has(mesh))throw Error('R6 water already installed');
 if(!debug.r5Color?.bindings.some(([m,,candidate])=>m===mesh&&candidate===source))throw Error('R6 water requires current R5 pigment');
 for(const name of ['position','normal','chart','waterData','stageDelta'])if(!mesh.geometry.getAttribute(name))throw Error('Missing retained '+name);
 const previous=debug.r6Water,look=createLook(source,ctx);let disposed=false,published;
 function dispose(){if(disposed)return;disposed=true;signal.removeEventListener('abort',dispose);
  if(mesh.material===look.material)mesh.material=source;
  if(debug.r6Water===published){if(previous===undefined)delete debug.r6Water;else debug.r6Water=previous;}
  look.material.dispose();active.delete(mesh);invalidate();
 }
 try{mesh.material=look.material;active.add(mesh);
  published={revision:REVISION,mesh,material:look.material,sourceMaterial:source,inspect:look.inspect,mouth:look.mouth,palette:look.palette,
   hydrologyRevision:ctx.hydrology.surfaceRevision,sourceRevision:debug.r5Color.revision,dispose};
  debug.r6Water=published;signal.addEventListener('abort',dispose,{once:true});invalidate();return {dispose};
 }catch(error){dispose();throw error;}
}
