import * as T from 'three';
import {groundMaterial,REVISION} from './materials.js';
const digest=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
 new Uint8Array(a.buffer,a.byteOffset,a.byteLength))),n=>n.toString(16).padStart(2,'0')).join('');
const noise=(u,v)=>.5+.5*Math.sin(u*.81+v*.24)*Math.sin(v*.64-u*.19);
export async function install(context){
 const {terrain,ecology,shore,signal,debug,invalidate}=context;
 signal?.throwIfAborted();
 const originals=[],materials=new Map(),previous=debug?.ground;
 let disposed=false,published;
 function dispose(){
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);
  for(const o of originals){
   // InstancedMesh.dispose releases only its current per-instance GPU buffers.
   // It neither removes the object nor disposes its retained geometry/material.
   if(o.matrix&&o.mesh.instanceMatrix===o.matrixCopy)o.mesh.dispose();
   if(o.mesh.material===o.copy)o.mesh.material=o.material;
   if(o.matrix&&o.mesh.instanceMatrix===o.matrixCopy)o.mesh.instanceMatrix=o.matrix;
   if(o.color&&o.mesh.instanceColor===o.colorCopy)o.mesh.instanceColor=o.color;
   if(o.sphere&&o.mesh.boundingSphere===o.sphereCopy)o.mesh.boundingSphere=o.sphere;
  }
  for(const m of materials.values())m.dispose();
  if(debug?.ground===published){if(previous===undefined)delete debug.ground;else debug.ground=previous;}
  invalidate?.();
 }
 function replace(mesh,kind){
  const material=mesh.material,key=material.uuid+':'+kind;
  let copy=materials.get(key);if(!copy){copy=groundMaterial(material,kind);materials.set(key,copy);}
  const record={mesh,material,copy};originals.push(record);mesh.material=copy;return record;
 }
 try{
  const response=await fetch(new URL('./layout-'+context.quality+'.json',import.meta.url),{signal});
  if(!response.ok)throw Error('E layout unavailable: '+response.status);
  const layout=await response.json();signal?.throwIfAborted();
  if(layout.terrainRevision!==context.surface.revision||layout.quality!==context.quality)throw Error('E layout/provider mismatch');
  const zipped=Uint8Array.from(atob(layout.gzip),c=>c.charCodeAt(0));
  const buffer=await new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const data=new Float32Array(buffer);
  if(buffer.byteLength!==layout.byteLength||await digest(data)!==layout.matrixSHA)throw Error('E layout integrity mismatch');
  const groups=new Map(layout.groups.map(g=>[g.name,g]));
  for(const m of ecology.group.children)if(groups.has(m.name)){
   const g=groups.get(m.name);
   if(m.count!==g.count||await digest(m.instanceMatrix.array)!==g.sourceSHA)throw Error('E source instance mismatch: '+m.name);
  }
  signal?.throwIfAborted();
  for(const mesh of ecology.group.children){
   const kind=mesh.userData.ecosystem?.kind??(mesh.name==='ecosystem-groundcover'?'groundcover':'understory');
   const o=replace(mesh,kind),g=groups.get(mesh.name);
   if(!g)continue;
   o.matrix=mesh.instanceMatrix;o.color=mesh.instanceColor;o.sphere=mesh.boundingSphere;
   o.matrixCopy=new T.InstancedBufferAttribute(data.slice(g.floatOffset,g.floatOffset+g.length),16);
   o.colorCopy=o.color.clone();
   const moved=new Map(g.records.map(p=>[p.i,p]));
   for(const p of mesh.userData.ecosystem.instances){
    const q=moved.get(p.index)??p,n=noise(q.u,q.v),value=o.color.getX(p.index)*(.84+.22*n);
    o.colorCopy.setXYZ(p.index,value*.98,value,value*1.025);
   }
   mesh.instanceMatrix=o.matrixCopy;mesh.instanceColor=o.colorCopy;
   mesh.boundingSphere=null;mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.12;o.sphereCopy=mesh.boundingSphere;
   mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
  }
  for(const mesh of terrain.group.children)if(mesh.isMesh)replace(mesh,'terrain');
  for(const mesh of shore.group.children)if(mesh.isMesh)replace(mesh,mesh.isInstancedMesh?'shore-rock':'sand');
  published={revision:REVISION,stats:{...layout.stats,instances:ecology.group.children.filter(m=>m.isInstancedMesh).reduce((n,m)=>n+m.count,0),
   materialCopies:materials.size,geometryCopies:0,addedObjects:0,addedLights:0,addedWindOwners:0,layoutBytes:buffer.byteLength},
   records:layout.groups.map(g=>({name:g.name,records:g.records})),dispose,
   source:'Frozen r5 geometry/texture/attributes; independent retained-instance transforms and pigment.'};
  if(debug)debug.ground=published;
  signal?.addEventListener('abort',dispose,{once:true});invalidate?.();
  return {dispose};
 }catch(error){dispose();throw error;}
}
