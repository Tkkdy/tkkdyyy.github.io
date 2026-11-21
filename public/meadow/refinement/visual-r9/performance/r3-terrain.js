import * as T from 'three';
import {createProvider,REVISION} from '../../visual-r3/terrain/sampler.js';
const types={Float32Array,Uint32Array,Uint16Array,Uint8Array};
const digest=async array=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(array.buffer,array.byteOffset,array.byteLength))),x=>x.toString(16).padStart(2,'0')).join('');
// A prepared payload belongs to the host AbortSignal, never to a global scene.
// The install consumes it; an abort or failed read drops it without mutation.
const preparedBySignal=new WeakMap();
function forgetPrepared(signal,quality,entry){
 if(!signal)return;
 const entries=preparedBySignal.get(signal);
 if(entries?.get(quality)!==entry)return;
 entries.delete(quality);signal.removeEventListener('abort',entry.onAbort);
 if(!entries.size)preparedBySignal.delete(signal);
}
function prepare({quality,signal}){
 signal?.throwIfAborted();
 let entries=signal?preparedBySignal.get(signal):null;
 if(entries?.has(quality))return entries.get(quality);
 const entry={onAbort:null,promise:null};
 entry.promise=(async()=>{
  const started=performance.now();
  const base=new URL('../../visual-r3/terrain/baked-'+quality,import.meta.url);
  const [response,payload]=await Promise.all([fetch(base.href+'.json',{signal}),fetch(base.href+'.bin',{signal})]);
  if(!response.ok||!payload.ok)throw Error('地形数据加载失败');
  const transferBytes=Number(payload.headers.get('content-length'))||0;
  const [manifest,buffer]=await Promise.all([response.json(),new Response(payload.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()]);
  signal?.throwIfAborted();
  if(manifest.schema!==1||manifest.revision!==REVISION||manifest.quality!==quality||buffer.byteLength!==manifest.byteLength||await digest(new Uint8Array(buffer))!==manifest.sha256)throw Error('R8 preloaded R3 terrain bake integrity mismatch');
  signal?.throwIfAborted();
  return {manifest,buffer,loadMs:performance.now()-started,transferBytes};
 })();
 if(signal){
  if(!entries){entries=new Map();preparedBySignal.set(signal,entries);}
  entries.set(quality,entry);entry.onAbort=()=>forgetPrepared(signal,quality,entry);
  signal.addEventListener('abort',entry.onAbort,{once:true});
 }
 entry.promise.catch(()=>forgetPrepared(signal,quality,entry));
 return entry;
}
export async function preload({quality,signal}){
 const {manifest,loadMs,transferBytes}=await prepare({quality,signal}).promise;
 return {quality,revision:manifest.revision,loadMs,transferBytes,decodedBytes:manifest.byteLength};
}
export async function install(context){
 const {signal,debug,invalidate}=context;signal?.throwIfAborted();
 const originals=[],owned=[],previous=debug?.r3Terrain;let disposed=false,published;
 const getMesh=p=>context[p.group].group.children.find(m=>m.name===p.name);
 function dispose(){
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);
  for(const o of [...originals].reverse()){
   if(o.kind==='matrix'){
    if(o.mesh.instanceMatrix===o.copy){o.mesh.dispose();o.mesh.instanceMatrix=o.original;o.mesh.boundingSphere=o.sphere;}
   }else if(o.mesh.geometry===o.copy)o.mesh.geometry=o.original;
  }
  for(const g of owned)g.dispose();
  if(debug?.r3Terrain===published){if(previous===undefined)delete debug.r3Terrain;else debug.r3Terrain=previous;}
  debug?.refreshShadows?.();invalidate?.();
 }
 try{
  const start=performance.now(),quality=context.quality;
  const entry=prepare({quality,signal});let loaded;
  try{loaded=await entry.promise;}finally{forgetPrepared(signal,quality,entry);}
  const {manifest,buffer,loadMs}=loaded;
  signal?.throwIfAborted();
  if(manifest.sourceRevision!==context.surface.revision)throw Error('R8 preloaded R3 source revision mismatch');
  const array=d=>{const r=manifest.buffers[d.id];if(!types[d.type])throw Error('R3 attribute type');return new types[d.type](buffer,r.offset,d.length)};
  // Validate every touched input before making the first scene mutation.
  for(const p of manifest.sourceChecks){
   const mesh=getMesh(p);if(!mesh)throw Error('R3 source mesh missing '+p.name);
   const a=p.kind==='matrix'?mesh.instanceMatrix.array:mesh.geometry.getAttribute('position').array;
   if(await digest(a)!==p.sha)throw Error('R3 source differs '+p.name+'/'+p.kind);
  }
  signal?.throwIfAborted();
  for(const p of manifest.patches){
   const mesh=getMesh(p);
   if(p.kind==='matrix'){
    if(mesh.count!==p.count)throw Error('R3 instance count mismatch');
    const copy=mesh.instanceMatrix.clone(),rows=array(p.rows),values=array(p.array);for(let i=0;i<rows.length;i++)copy.array.set(values.subarray(i*16,i*16+16),rows[i]*16);
    const o={kind:'matrix',mesh,original:mesh.instanceMatrix,copy,sphere:mesh.boundingSphere};originals.push(o);
    mesh.instanceMatrix=copy;mesh.boundingSphere=null;mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.12;copy.needsUpdate=true;
   }else{
    const copy=p.full?new T.BufferGeometry():mesh.geometry.clone();owned.push(copy);
    for(const [k,v]of Object.entries(p.attributes)){
     if(!v.rows)copy.setAttribute(k,new T.BufferAttribute(array(v.array),v.itemSize,v.normalized));
     else {let a=copy.getAttribute(k);if(v.count!==a.count){const expanded=new Float32Array(v.count*v.itemSize);expanded.set(a.array);a=new T.BufferAttribute(expanded,v.itemSize,v.normalized);copy.setAttribute(k,a);}const rows=array(v.rows),values=array(v.array);for(let i=0;i<rows.length;i++)a.array.set(values.subarray(i*v.itemSize,(i+1)*v.itemSize),rows[i]*v.itemSize);a.needsUpdate=true;}
    }
    if(p.index)copy.setIndex(new T.BufferAttribute(array(p.index),1));if(p.full)copy.userData=p.userData;
    copy.computeBoundingSphere();copy.computeBoundingBox();
    originals.push({kind:'geometry',mesh,original:mesh.geometry,copy});mesh.geometry=copy;
   }
  }
  const terrain=context.terrain.group.children.find(m=>m.isMesh).geometry,water=context.water.group.children.find(m=>m.isMesh).geometry;
  const data={positions:terrain.getAttribute('position').array,indices:terrain.index.array,cellOffsets:array(manifest.terrainCellOffsets),water:{positions:water.getAttribute('position').array,indices:water.index.array,offsets:array(manifest.waterOffsets)}};
  const provider=createProvider(data,manifest.coasts,manifest.river);
  published={revision:REVISION,fingerprint:manifest.fingerprint,stats:{...manifest.stats,installMs:performance.now()-start,preparationMs:loadMs,payloadBytes:manifest.gzipBytes},surface:provider.surface,hydrology:provider.hydrology,
   data,boundary:array(manifest.waterBoundary),roots:manifest.roots,dispose,originals};
  if(debug)debug.r3Terrain=published;
  signal?.addEventListener('abort',dispose,{once:true});signal?.throwIfAborted();debug?.refreshShadows?.();invalidate?.();
  return {dispose,surface:provider.surface,hydrology:provider.hydrology};
 }catch(error){dispose();throw error;}
}
