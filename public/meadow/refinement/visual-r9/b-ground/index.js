import {collectField,REVISION} from './field.js';
import {createMaterial} from './materials.js';
import {createDetails} from './details.js';
const active=new WeakSet();
export function install(ctx){
 const {debug,signal,invalidate}=ctx;signal?.throwIfAborted();if(!debug.r6Ground)throw Error('R7 B requires complete R6 ground');
 const targets=[...ctx.terrain.group.children,...ctx.ecology.group.children,...ctx.shore.group.children].filter(m=>m.isMesh&&['terrain','groundcover','rock','shore-rock'].includes(m.material?.userData.eGround?.kind));
 if(targets.length<3)throw Error('R9 B expected terrain, groundcover and retained stones');
 for(const m of targets)if(active.has(m))throw Error('R7 B duplicate install');
 const previous=debug.r7B,previousR8=debug.r8B,bindings=[],records=new Map();let disposed=false,published,details;
 function dispose(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);
  for(const b of [...bindings].reverse()){if(b.mesh.material===b.record.material)b.mesh.material=b.original;active.delete(b.mesh);}
  details?.dispose();for(const r of records.values())r.material.dispose();if(debug.r7B===published){if(previous===undefined)delete debug.r7B;else debug.r7B=previous;}if(debug.r8B===published){if(previousR8===undefined)delete debug.r8B;else debug.r8B=previousR8;}debug.refreshShadows?.();invalidate?.();
 }
 try{const field=collectField(ctx);
  for(const mesh of targets){const original=mesh.material,kind=original.userData.eGround.kind;
   let r=records.get(original);if(!r){r={kind,original,material:null,compiles:0,sourceCalls:0};r.material=createMaterial(original,kind,field,r);records.set(original,r);}
   bindings.push({mesh,original,record:r});mesh.material=r.material;active.add(mesh);
  }
  details=createDetails(ctx);
  published={...field,details,revision:REVISION,bindings,records:[...records.values()],dispose,
   stats:{materials:records.size,meshBindings:bindings.length,geometryChanges:0,instanceChanges:0,addedObjects:1,addedInstances:details.records.length,addedTriangles:details.records.length*80,addedLights:0,addedTextures:0,addedWindOwners:0},
   limitations:'R9 structured meadow, worn soil and grass shoulders, 0.2-0.6m meadow clumps in pigment/shallow normal, 12 measured rock contacts and retained sparse road grains; no terrain displacement, AO, lights or physical compaction. Main root footprint comes from retained lower wood vertices.'};
  debug.r7B=published;debug.r8B=published;signal?.addEventListener('abort',dispose,{once:true});debug.refreshShadows?.();invalidate?.();return {dispose};
 }catch(e){dispose();throw e;}
}
