import * as T from 'three';
export function arrayRecord(a){return {type:a.constructor.name,data:Array.from(a)};}
export function arrayRestore(r){return new globalThis[r.type](r.data);}
export function geometryRecord(g,source){return Object.fromEntries(Object.entries(g.attributes).filter(([k,a])=>!source?.attributes[k]||a.array.some((v,i)=>v!==source.attributes[k].array[i])).map(([k,a])=>[k,{...arrayRecord(a.array),itemSize:a.itemSize,normalized:a.normalized}]))}
export function geometryRestore(source,r){const g=source.clone();for(const [k,a]of Object.entries(r))g.setAttribute(k,new T.BufferAttribute(arrayRestore(a),a.itemSize,a.normalized));g.computeBoundingBox();g.computeBoundingSphere();return g;}
export function fingerprint(world){world.updateMatrixWorld(true);let h=2166136261;const add=a=>{const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);for(let i=0;i<b.length;i++)h=Math.imul(h^b[i],16777619)};world.traverse(m=>{if(!m.isMesh)return;add(new Float64Array(m.matrix.elements));add(new TextEncoder().encode(m.name));if(m.isInstancedMesh)add(new Uint32Array([m.count]));for(const [,a]of Object.entries(m.geometry.attributes).sort())add(a.array);if(m.geometry.index)add(m.geometry.index.array);if(m.isInstancedMesh)add(m.instanceMatrix.array)});return (h>>>0).toString(16)}
export async function prepare(ctx,id){const start=performance.now(),capture=new URLSearchParams(location.search).has('bakeCapture'),input=fingerprint(ctx.world);const quality=ctx.quality??(innerWidth<650?"mobile":"desktop"),asset=id.variant+"-"+quality;let data;
if(capture)data={schema:1,id,input,maps:[],geometry:[],instances:[]};else {const loaded=await preloadCoast(quality,ctx.signal);coastLoads.delete(ctx.signal);data=loaded.data;const binary=loaded.binary;function hydrate(v){if(!v||typeof v!=='object')return;if(v.type&&Number.isInteger(v.offset)){v.data=new globalThis[v.type](binary,v.offset,v.length);return;}for(const x of Object.values(v))hydrate(x)}hydrate(data);if(JSON.stringify(data.id)!==JSON.stringify(id)||data.input!==input)throw Error('Offline bake stale: regenerate for current source/input');}
return {capture,data,mapIndex:0,geometryIndex:0,instanceIndex:0,start};}

const coastLoads=new WeakMap();
export function preloadCoast(quality,signal){
 if(coastLoads.has(signal))return coastLoads.get(signal);
 const base=new URL('./D-'+quality,import.meta.url);
 const job=Promise.all([fetch(base.href+'.json',{signal}),fetch(base.href+'.bin',{signal})]).then(async([meta,payload])=>{
  if(!meta.ok||!payload.ok)throw Error('海岸资源加载失败');
  const [data,binary]=await Promise.all([meta.json(),new Response(payload.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()]);
  return {data,binary};
 });
 coastLoads.set(signal,job);job.catch(()=>coastLoads.delete(signal));return job;
}
