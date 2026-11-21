import {materialFor,REVISION,PALETTE} from './materials.js';
import {redistribute,rootGardenLayout,rockObstacles} from './layout.js';
import {loadBaked} from './cache.js';
const active=new WeakSet(),pending=new WeakSet();
export async function install(ctx){
 const {debug,signal,invalidate}=ctx;signal?.throwIfAborted();
 if(!debug.r6Ground)throw Error('C requires complete retained R6 ground chain');
 const garden=ctx.world.getObjectByName('C garden / root pockets');
 if(!garden)throw Error('C requires retained independent root garden');
 const targets=ctx.ecology.group.children.filter(m=>['grass','fern','flowers'].includes(m.userData.ecosystem?.kind));
 const flowers=garden.getObjectByName('C garden / small blossoms');
 if(flowers)targets.push(flowers);
 if(targets.some(m=>active.has(m)||pending.has(m)))throw Error('C already installed');
 for(const mesh of targets)pending.add(mesh);
 const previous=debug.r7C,bindings=[],materials=new Map(),occupied=[];let disposed=false,published;
 const refresh=()=>{debug.refreshShadows?.();invalidate?.()};
 function dispose(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);
  for(const b of [...bindings].reverse()){
   if(b.matrix&&b.mesh.instanceMatrix===b.copy){b.mesh.dispose();b.mesh.instanceMatrix=b.matrix;b.mesh.boundingSphere=b.sphere;b.mesh.boundingBox=b.box;}
   if(b.mesh.material===b.material.candidate)b.mesh.material=b.source;active.delete(b.mesh);
  }
  for(const r of materials.values())r.candidate.dispose();
  if(debug.r7C===published){if(previous===undefined)delete debug.r7C;else debug.r7C=previous;}refresh();
 }
 try{
  const started=performance.now(),cached=await loadBaked(ctx,targets,REVISION);signal?.throwIfAborted();
  const rocks=cached.used?null:rockObstacles(ctx);
  // Flowers establish the pockets before companion grass and fern placement.
  const sorted=[...targets].sort((a,b)=>['flowers','fern','grass'].indexOf(a.userData.ecosystem?.kind??'flowers')-['flowers','fern','grass'].indexOf(b.userData.ecosystem?.kind??'flowers'));
  for(const mesh of sorted){
   signal?.throwIfAborted();const isGarden=mesh===flowers,kind=isGarden?'flowers':mesh.userData.ecosystem.kind,source=mesh.material;
   const key=source.uuid+'|'+kind+'|'+isGarden;let material=materials.get(key);
   if(!material){material={kind,garden:isGarden,source,candidate:null,compiles:0,sourceCalls:0};material.candidate=materialFor(source,kind,material,isGarden,debug.r7B?.groundPalette);materials.set(key,material);}
   const b={mesh,source,material};bindings.push(b);mesh.material=material.candidate;active.add(mesh);
   {const layout=cached.used?cached.apply(mesh):isGarden?rootGardenLayout(ctx,mesh):redistribute(ctx,mesh,kind,occupied,rocks);b.matrix=mesh.instanceMatrix;b.sphere=mesh.boundingSphere;b.box=mesh.boundingBox;b.copy=layout.copy;b.records=layout.records;b.unresolved=layout.unresolved;mesh.instanceMatrix=layout.copy;mesh.boundingSphere=null;mesh.boundingBox=null;mesh.computeBoundingSphere();mesh.computeBoundingBox();mesh.boundingSphere.radius+=.12;}
  }
  published={revision:REVISION,palette:PALETTE,bindings,materials:[...materials.values()],sourceSurface:ctx.surface.revision,
   stats:{layoutMode:cached.used?'baked':'live',cacheReason:cached.reason,cacheBytes:cached.bytes??0,cacheGzipBytes:cached.gzipBytes??0,instances:targets.reduce((s,m)=>s+m.count,0),moved:bindings.reduce((s,b)=>s+(b.records?.length??0),0),unresolved:bindings.flatMap(b=>(b.unresolved??[]).map(p=>({mesh:b.mesh.name,...p}))),byMesh:bindings.map(b=>({name:b.mesh.name,kind:b.material.kind,count:b.mesh.count,moved:b.records?.length??0})),materialCopies:materials.size,addedInstances:0,addedGeometry:0,addedTextures:0,addedWindOwners:0,installMs:performance.now()-started},
   dispose,limits:['Retained leaf and flower geometry silhouettes','No global lighting or crown changes']};
  debug.r7C=published;signal?.addEventListener('abort',dispose,{once:true});refresh();return {dispose};
 }catch(error){dispose();throw error;}finally{for(const mesh of targets)pending.delete(mesh);}
}
