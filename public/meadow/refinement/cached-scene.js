import * as T from 'three';
import {createTerrainMaterial} from './terrain-material.js';
import {createTerrainMaterial as baselineTerrainMaterial} from '../modules/planet-terrain/material.js';
import {createWaterMaterial} from '../modules/water-system/material.js';
import {WATER} from '../modules/water-system/config.js';
import {createWind} from '../modules/ground-ecosystem/wind.js';
import {rockMaterial,dressGround} from './shore-adapter.js';
const types={Float32Array,Uint32Array,Uint16Array,Uint8Array,Int32Array};
export async function loadCache(quality,signal){
 const worker=new Worker(new URL('./cache-worker.js',import.meta.url));
 const {cache,bytes,timing}=await new Promise((resolve,reject)=>{
  const cleanup=()=>{signal.removeEventListener('abort',cancel);worker.terminate()};
  const cancel=()=>{cleanup();reject(new DOMException('Aborted','AbortError'))};
  worker.onmessage=({data})=>{cleanup();data.error?reject(Error(data.error)):resolve(data)};
  worker.onerror=e=>{cleanup();reject(Error(e.message))};
  if(signal.aborted){cancel();return}signal.addEventListener('abort',cancel,{once:true});
  worker.postMessage({url:new URL('./cache/'+quality+'.json',import.meta.url).href});
 });
 signal.throwIfAborted();
 if(cache.schema!==1||cache.quality!==quality||cache.seed!==4141||cache.terrainRevision!=='terrain-20261114-r5')throw Error('派生缓存版本不匹配');
 const array=d=>{if(!types[d.type])throw Error('Unknown cached attribute');return new types[d.type](bytes,d.offset,d.length)};
 const attribute=d=>new (d.instanced?T.InstancedBufferAttribute:T.BufferAttribute)(array(d.array),d.itemSize,d.normalized);
 const sphere=d=>d?new T.Sphere(new T.Vector3(...d.center),d.radius):null;
 function geometry(d){const g=new T.BufferGeometry();for(const [k,v]of Object.entries(d.attributes))g.setAttribute(k,attribute(v));if(d.index)g.setIndex(attribute(d.index));g.userData=d.userData;g.boundingSphere=sphere(d.boundingSphere);return g}
 return {cache,array,attribute,sphere,geometry,timing};
}
export async function createCachedScene(context,data,{baselinePigment=false}={}){
 const {cache,array,attribute,sphere,geometry}=data,wind=createWind(),clock={value:0},resources=new Set(),unregister=[];
 let disposed=false,lastWater=-1;
 const own=r=>(resources.add(r),r),materials=new Map();
 function texture(name){const d=cache.textures[name],t=own(new T.DataTexture(array(d.data),d.width,d.height,T.RGBAFormat));t.colorSpace=d.colorSpace;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t}
 const stone=texture('stone'),bump=texture('bump'),moss=texture('moss');
 function material(id,o){
  const key=id+':'+(id==='ecology'?o.userData.ecosystem?.kind??o.name:id==='shore'?(o.count!==null?'rock':'sand'):'shared');
  if(materials.has(key))return materials.get(key);
  let m;
  if(id==='terrain')m=baselinePigment?baselineTerrainMaterial():createTerrainMaterial();
  if(id==='water')m=createWaterMaterial(WATER,clock);
  if(id==='ecology'){
   const kind=o.userData.ecosystem?.kind;
   m=new T.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:kind==='rock'||o.name==='ecosystem-groundcover'?T.FrontSide:T.DoubleSide});
   if(kind==='rock'){m.map=stone;m.bumpMap=bump;m.bumpScale=.035}
   else if(['grass','fern','flowers'].includes(kind))wind.bind(m,kind);
   else if(o.name==='ecosystem-groundcover'){m.map=moss;m.transparent=true;m.depthWrite=false;m.alphaTest=.004;}
  }
  if(id==='shore'){
   if(o.count!==null)m=rockMaterial();
   else {m=new T.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,toneMapped:false,transparent:true,depthWrite:false,alphaTest:.006,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});dressGround(m);const original=m.onBeforeCompile;m.onBeforeCompile=s=>{original(s);s.fragmentShader=s.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a *= .58*smoothstep(0.,.72,vShore.x);\n#include <alphatest_fragment>')};m.customProgramCacheKey=()=> 'shore-v2-r5-feathered-dry-sediment';}
  }
  materials.set(key,own(m));return m;
 }
 const result={};
 // Yield between resource groups; no partial-ready signal or second render loop.
 const yieldTask=()=>new Promise(r=>setTimeout(r,0));
 try{
  for(const [id,d] of Object.entries(cache.groups)){
   context.signal.throwIfAborted();const group=new T.Group();group.name=d.name;group.userData=d.userData;
   for(const o of d.meshes){
    const g=own(geometry(o.geometry)),m=material(id,o),mesh=o.count!==null?new T.InstancedMesh(g,m,o.count):new T.Mesh(g,m);
    mesh.name=o.name;mesh.userData=o.userData;mesh.castShadow=o.castShadow;mesh.receiveShadow=o.receiveShadow;
    if(o.count!==null){mesh.instanceMatrix=attribute(o.instanceMatrix);mesh.instanceColor=o.instanceColor?attribute(o.instanceColor):null;mesh.boundingSphere=sphere(o.boundingSphere);own(mesh);}
    if(mesh.userData.ecosystem?.windOwner==='ground-ecosystem')unregister.push(context.registerMotion(mesh,'ecosystem:'+mesh.userData.ecosystem.kind));
    group.add(mesh);
   }
   result[id]={id,group,dispose:()=>dispose(),update:id==='ecology'?f=>!disposed&&wind.update(f):id==='water'?({elapsed,reducedMotion})=>{if(disposed||reducedMotion)return false;const tick=Math.floor(elapsed*WATER.motionHz);if(tick===lastWater)return false;lastWater=tick;clock.value=tick/WATER.motionHz;return true}:undefined};
   await yieldTask();
  }
  Object.assign(result.shore,cache.shore);
  context.signal.throwIfAborted();context.signal.addEventListener('abort',dispose,{once:true});
  return result;
 }catch(error){dispose();throw error}
 function dispose(){if(disposed)return;disposed=true;context.signal.removeEventListener('abort',dispose);for(const off of unregister)off();for(const r of resources)r.dispose();resources.clear();for(const m of Object.values(result)){m.group.clear();m.group.removeFromParent()}}
}
