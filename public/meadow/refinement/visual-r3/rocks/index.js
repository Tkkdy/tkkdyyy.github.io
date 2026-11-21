import * as T from 'three';
import {loadCandidates,geometryFromData,typed,fingerprint,terrainStamp,loadSeating} from './data.js';
import {seatRock} from './placement.js';

export const REVISION='r3-weathered-rocks-2';
const active=new WeakSet();
export async function install(context){
 const start=performance.now(),{shore,ecology,surface,hydrology,signal,debug,invalidate}=context;
 signal.throwIfAborted();
 const quality=context.quality??(innerWidth<650?'mobile':'desktop');
 const [{meta,buffer},seating]=await Promise.all([loadCandidates(signal,quality),context.debug.r3Terrain&&!context.forceLiveRocks?loadSeating(signal,quality):Promise.resolve({profiles:[]})]);
 const stamp=seating.profiles.length?await terrainStamp(context):null;
 const profile=seating.profiles.find(p=>p.revision===REVISION&&p.shapeSHA256===meta.binarySHA256&&p.terrainStamp===stamp&&p.surfaceRevision===surface.revision);
 signal.throwIfAborted();
 if(meta.revision!==REVISION)throw Error('Rock baked revision mismatch');
 const loadMs=performance.now()-start,previous=debug.r3Rocks,records=[],contact=[],qualities=[];
 const queries={sample:0,frame:0};
 const measuredSurface={...surface,
  sample(...uv){queries.sample++;return surface.sample(...uv)},
  frame(...uv){queries.frame++;return surface.frame(...uv)},
 };
 let disposed=false,published,bakedPlacements=0,terrainBakedPlacements=0;
 function dispose(){
  if(disposed)return;disposed=true;signal.removeEventListener('abort',dispose);
  for(const r of records){
   if(r.mesh.instanceMatrix===r.copyMatrix)r.mesh.dispose();
   if(r.mesh.geometry===r.copy)r.mesh.geometry=r.geometry;
   if(r.mesh.instanceMatrix===r.copyMatrix)r.mesh.instanceMatrix=r.matrix;
   if(r.mesh.instanceColor===r.copyColor)r.mesh.instanceColor=r.color;
   if(r.mesh.boundingSphere===r.copySphere)r.mesh.boundingSphere=r.sphere;
   if(r.mesh.boundingBox===r.copyBox)r.mesh.boundingBox=r.box;
   r.copy.dispose();active.delete(r.mesh);
  }
  if(debug.r3Rocks===published){if(previous===undefined)delete debug.r3Rocks;else debug.r3Rocks=previous}
  debug.refreshShadows?.();invalidate?.();
 }
 try{
  const targets=[
   ...shore.group.children.filter(m=>/^fractured-shore-stones-[012]$/.test(m.name)).map(mesh=>({mesh,shore:true})),
   ...ecology.group.children.filter(m=>m.userData.ecosystem?.kind==='rock').map(mesh=>({mesh,shore:false})),
  ];
  if(targets.length!==meta.meshes.length)throw Error('Rock batch count mismatch');
  for(const {mesh}of targets)if(active.has(mesh))throw Error('R3 rocks already installed');
  for(const {mesh,shore:isShore}of targets){
   signal.throwIfAborted();
   const entry=meta.meshes.find(e=>e.name===mesh.name);
   if(!entry||entry.count!==mesh.count||entry.sourceGeometry!==fingerprint(mesh.geometry))throw Error('Rock baked source mismatch: '+mesh.name);
   const copy=geometryFromData(mesh.geometry,entry,buffer);
   const r={mesh,geometry:mesh.geometry,matrix:mesh.instanceMatrix,color:mesh.instanceColor,sphere:mesh.boundingSphere,box:mesh.boundingBox,
    copy,copyMatrix:mesh.instanceMatrix.clone(),copyColor:mesh.instanceColor?.clone()??null};
   records.push(r);qualities.push(entry.quality);
   // Only the byte-identical frozen r5 surface/rest poses may reuse baked seating.
   // A candidate surface or E's moved rest matrices always triggers live fitting.
   const rest=fingerprint(mesh.geometry,mesh.instanceMatrix),profileMesh=profile?.meshes.find(p=>p.name===mesh.name&&p.source===rest&&p.count===mesh.count);
   const baked=!context.forceLiveRocks&&surface.revision===meta.surfaceRevision&&rest===entry.source;
   if(profileMesh){
    if(profileMesh.matrices.length!==r.copyMatrix.array.length||!profileMesh.matrices.every(Number.isFinite))throw Error('Rock seating matrix payload mismatch');
    r.copyMatrix.array.set(profileMesh.matrices);
    const fitted=profile.contact.filter(c=>c.name===mesh.name);contact.push(...fitted.map(c=>({...c,placement:'baked-terrain'})));bakedPlacements+=fitted.length;terrainBakedPlacements+=fitted.length;
   }else if(baked){
    r.copyMatrix.array.set(typed(buffer,entry.matrices));
    const fitted=meta.contact.filter(c=>c.name===mesh.name);contact.push(...fitted.map(c=>({...c,placement:'baked-r5'})));bakedPlacements+=fitted.length;
   }else{
    const points=entry.support.map(p=>new T.Vector3(...p));
    for(let i=0;i<mesh.count;i++){
     const item=mesh.userData.ecosystem?.instances?.find(p=>p.index===i);
     if(!isShore&&item?.detail!=='near')continue;
     const matrix=new T.Matrix4().fromArray(r.matrix.array,i*16),size=new T.Vector3().setFromMatrixScale(matrix).length()/Math.sqrt(3);
     const fit=seatRock(matrix,copy,measuredSurface,{embed:Math.max(.010,Math.min(.035,size*.045)),points,diagnostics:false});
     matrix.toArray(r.copyMatrix.array,i*16);contact.push({name:mesh.name,index:i,kind:isShore?'shore':'ecology',placement:'live-surface',...fit});
    }
   }
   mesh.geometry=copy;mesh.instanceMatrix=r.copyMatrix;mesh.instanceColor=r.copyColor;
   mesh.boundingSphere=null;mesh.boundingBox=null;mesh.computeBoundingSphere();mesh.computeBoundingBox();
   r.copySphere=mesh.boundingSphere;r.copyBox=mesh.boundingBox;
   mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;active.add(mesh);
  }
  published={revision:REVISION,surfaceRevision:surface.revision,hydrologyRevision:hydrology.surfaceRevision,
   geometry:qualities,contact,counts:records.map(r=>({name:r.mesh.name,instances:r.mesh.count})),
   timing:{loadMs,installMs:performance.now()-start,assemblyMs:performance.now()-start-loadMs},
   queries,bakedPlacements,terrainBakedPlacements,terrainStamp:stamp,livePlacements:contact.length-bakedPlacements,bakedBytes:meta.binaryBytes,
   records:records.map(r=>({mesh:r.mesh,originalGeometry:r.geometry,originalMatrix:r.matrix,originalColor:r.color,candidateGeometry:r.copy,candidateMatrix:r.copyMatrix})),
   dispose};
  debug.r3Rocks=published;signal.addEventListener('abort',dispose,{once:true});debug.refreshShadows?.();invalidate?.();
  return {dispose};
 }catch(error){dispose();throw error}
}
