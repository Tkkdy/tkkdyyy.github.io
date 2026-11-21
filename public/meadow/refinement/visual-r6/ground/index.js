import {collectContext} from './context.js';
import {createMaterial,REVISION} from './materials.js';
const active=new WeakSet();
export function install(ctx){
 const {debug,signal,invalidate}=ctx;signal?.throwIfAborted();
 if(!debug.r5Color||!debug.r5Lighting)throw Error('R6 ground installs after R5 lighting and color');
 const targets=[...ctx.terrain.group.children,...ctx.ecology.group.children,...ctx.shore.group.children].filter(m=>m.isMesh);
 for(const m of targets)if(active.has(m))throw Error('R6 ground already installed');
 const previous=debug.r6Ground,bindings=[],records=new Map();let disposed=false,published;
 const refresh=()=>{debug.refreshShadows?.();invalidate?.()};
 function dispose(){
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);
  for(const b of [...bindings].reverse()){if(b.mesh.material===b.record.candidate)b.mesh.material=b.original;active.delete(b.mesh);}
  for(const r of records.values())r.candidate.dispose();
  if(debug.r6Ground===published){if(previous===undefined)delete debug.r6Ground;else debug.r6Ground=previous;}
  refresh();
 }
 try{
  const field=collectContext(ctx);
  for(const mesh of targets){
   signal?.throwIfAborted();
   const original=mesh.material,kind=original.userData.eGround?.kind;
   if(Array.isArray(original)||!kind)throw Error('Missing retained R5 ground material kind: '+mesh.name);
   // Rocks need private terrain-plane uniforms. Species retain near/far aliases.
   const key=original.uuid+(field.planes.has(mesh)?'|'+mesh.uuid:'');
   let record=records.get(key);
   if(!record){record={kind,original,candidate:null,compiles:0,sourceCalls:0};
    record.candidate=createMaterial(original,kind,field,field.planes.get(mesh),record);records.set(key,record);}
   bindings.push({mesh,original,record});mesh.material=record.candidate;active.add(mesh);
  }
  published={revision:REVISION,bindings,materials:[...records.values()],
   sourceLighting:field.lightingRevision,sourceHouse:field.houseRevision,
   contacts:field.contacts,windowSurfaces:field.emitters.length,contactPlanes:[...field.planes].map(([m,p])=>({mesh:m.name,count:p.length})),
   stats:{materials:records.size,meshBindings:bindings.length,addedTextures:0,addedObjects:0,addedLights:0,addedWindOwners:0,geometryChanges:0,instanceChanges:0},
   limits:field.limits,dispose};
  debug.r6Ground=published;signal?.addEventListener('abort',dispose,{once:true});refresh();return {dispose};
 }catch(e){dispose();throw e;}
}
