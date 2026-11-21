import {createGroundMaterial,REVISION,PALETTE} from './materials.js';
const active=new WeakSet();
export function install(context){
 const {terrain,ecology,shore,world,debug,signal,invalidate}=context;signal?.throwIfAborted();
 const lighting=world.userData.r4Lighting;
 if(!lighting?.directions?.key)throw Error('R4 ground requires the selected R4 lighting contract');
 const originals=[],materials=new Map(),previous=debug?.r4Ground;
 let disposed=false,published;
 const refresh=()=>{debug?.refreshShadows?.();invalidate?.()};
 function dispose(){
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);
  for(const r of [...originals].reverse()){
   if(r.mesh.material===r.record.candidate)r.mesh.material=r.original;
   active.delete(r.mesh);
  }
  for(const r of materials.values())r.candidate.dispose();
  if(debug?.r4Ground===published){if(previous===undefined)delete debug.r4Ground;else debug.r4Ground=previous;}
  refresh();
 }
 try{
  const targets=[...terrain.group.children,...ecology.group.children,...shore.group.children].filter(m=>m.isMesh);
  for(const mesh of targets)if(active.has(mesh))throw Error('R4 ground already installed: '+mesh.name);
  for(const mesh of targets){
   signal?.throwIfAborted();
   if(Array.isArray(mesh.material))throw Error('Unexpected ground multimaterial: '+mesh.name);
   const original=mesh.material,kind=original.userData.eGround?.kind;
   if(!kind)throw Error('Missing retained ground material kind: '+mesh.name);
   const key=original.uuid+':'+kind;
   let record=materials.get(key);
   if(!record){
    record={kind,original,candidate:null,sourceCalls:0,compiles:0};
    record.candidate=createGroundMaterial(original,kind,lighting,record);materials.set(key,record);
   }
   originals.push({mesh,original,record});mesh.material=record.candidate;active.add(mesh);
  }
  published={revision:REVISION,lightingRevision:lighting.revision,profile:lighting.profile,palette:PALETTE,
   stats:{materials:materials.size,meshBindings:originals.length,addedObjects:0,addedTextures:0,addedLights:0,addedWindOwners:0,geometryChanges:0,instanceChanges:0},
   materials:[...materials.values()],bindings:originals,dispose,
   limitations:'Retains the C root ownership transition; no new geometry, leaf transmission, AO or screen-space filter.'};
  if(debug)debug.r4Ground=published;signal?.addEventListener('abort',dispose,{once:true});refresh();return {dispose};
 }catch(error){dispose();throw error;}
}
