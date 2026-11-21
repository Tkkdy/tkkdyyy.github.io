// Enable only after the director freezes the exact A/B inputs and bake.mjs exports both qualities.
export const CACHE_ENABLED=true;
export const digest=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength))),x=>x.toString(16).padStart(2,'0')).join('');
export function contextKey(ctx){
 const a=ctx.debug.r7A,b=ctx.debug.r7B,aux=a?.auxiliaryTree;
 return JSON.stringify({quality:ctx.quality,surface:ctx.surface.revision,a:a?.fingerprint??null,aRevision:a?.revision??null,
  auxiliary:aux?{u:aux.u,v:aux.v,rootRadius:aux.rootRadius,canopyRadius:aux.canopyRadius}:null,
  b:b?{revision:b.revision,road:{center:b.road.centerHalfWidth,edge:b.road.edgeHalfWidth,edgeFunction:b.road.edgeHalfWidthAt?.toString()},clearance:b.clearanceAt?.toString(),rootRegions:b.rootRegions,groundPalette:b.groundPalette}:null});
}
export async function loadBaked(ctx,targets,revision){
 if(ctx.forceLiveC||new URLSearchParams(location.search).has('cLive'))return {used:false,reason:'explicit-live'};
 if(!CACHE_ENABLED)return {used:false,reason:'not-yet-baked'};
 const response=await fetch(new URL('./layout-'+ctx.quality+'.json',import.meta.url),{signal:ctx.signal});
 if(!response.ok)throw Error('C layout cache unavailable: '+response.status);
 const cache=await response.json();ctx.signal?.throwIfAborted();
 if(cache.schema!==1||cache.revision!==revision||cache.context!==contextKey(ctx))return {used:false,reason:'context-mismatch'};
 if(cache.groups.length!==targets.length)return {used:false,reason:'group-mismatch'};
 for(const g of cache.groups){const m=targets.find(m=>m.name===g.name);if(!m||m.count!==g.count||await digest(m.instanceMatrix.array)!==g.sourceSHA)return {used:false,reason:'source-matrix-mismatch'};}
 const zipped=Uint8Array.from(atob(cache.gzip),x=>x.charCodeAt(0)),buffer=await new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),data=new Float32Array(buffer);
 if(buffer.byteLength!==cache.byteLength||await digest(data)!==cache.sha256)throw Error('C layout cache digest mismatch');
 ctx.signal?.throwIfAborted();
 return {used:true,reason:'exact-source-match',bytes:cache.byteLength,gzipBytes:zipped.byteLength,
  apply(mesh){const g=cache.groups.find(g=>g.name===mesh.name),copy=mesh.instanceMatrix.clone();for(let n=0;n<g.indices.length;n++)copy.array.set(data.subarray(g.offset+n*16,g.offset+(n+1)*16),g.indices[n]*16);copy.needsUpdate=true;return {copy,records:g.records,unresolved:g.unresolved};}};
}
