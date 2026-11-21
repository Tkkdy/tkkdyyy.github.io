import * as T from 'three';
// A compact content guard covers the original shape, palette and instance rest
// matrices. UUIDs are intentionally excluded so cached desktop/mobile loads agree.
export function fingerprint(geometry,matrix){
 let h=2166136261;
 const add=a=>{if(!a)return;const bytes=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);for(const b of bytes){h^=b;h=Math.imul(h,16777619)}};
 for(const name of ['position','normal','color','uv','stoneWater'])add(geometry.attributes[name]?.array);
 add(geometry.index?.array);add(matrix?.array);return (h>>>0).toString(16);
}
export function decodeBase64(text){
 if(typeof Uint8Array.fromBase64==='function')return Uint8Array.fromBase64(text);
 const raw=atob(text),bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return bytes;
}
const cache=new Map();
export async function loadCandidates(signal,quality){
 if(cache.has(quality))return cache.get(quality);
 const meta=await fetch(new URL('./baked/rocks-'+quality+'.json',import.meta.url),{signal}).then(r=>{if(!r.ok)throw Error('Rock manifest '+r.status);return r.json()});
 const zipped=decodeBase64(meta.gzip);
 const buffer=await new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),v=>v.toString(16).padStart(2,'0')).join('');
 if(hash!==meta.binarySHA256)throw Error('Rock candidate integrity mismatch');
 delete meta.gzip;
 signal.throwIfAborted();
 if(buffer.byteLength!==meta.binaryBytes)throw Error('Rock candidate byte length mismatch');
 const data={meta,buffer};cache.set(quality,data);return data;
}
export function typed(buffer,ref){
 const C={Float32Array,Uint16Array,Uint32Array}[ref.type];if(!C)throw Error('Unsupported rock buffer');
 return new C(buffer.slice(ref.offset,ref.offset+ref.length*C.BYTES_PER_ELEMENT));
}
export function geometryFromData(source,entry,buffer){
 const g=source.clone();
 for(const [name,a]of Object.entries(entry.attributes))g.setAttribute(name,new T.BufferAttribute(typed(buffer,a),a.itemSize));
 if(entry.index)g.setIndex(new T.BufferAttribute(typed(buffer,entry.index),1));
 g.boundingBox=new T.Box3(new T.Vector3(...entry.box.min),new T.Vector3(...entry.box.max));
 g.boundingSphere=new T.Sphere(new T.Vector3(...entry.sphere.center),entry.sphere.radius);
 g.userData={...source.userData,r3Rocks:{revision:'r3-weathered-rocks-2',sourceGeometry:source.uuid}};
 return g;
}

export async function terrainStamp(context){
 const geometry=context.terrain.group.children.find(m=>m.isMesh).geometry;
 const sha=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength))),v=>v.toString(16).padStart(2,'0')).join('');
 const [position,index]=await Promise.all([sha(geometry.attributes.position.array),sha(geometry.index.array)]);
 return context.surface.revision+':'+context.surface.radius+':'+position+':'+index;
}
const seatingCache=new Map();
export async function loadSeating(signal,quality){
 if(seatingCache.has(quality))return seatingCache.get(quality);
 const response=await fetch(new URL('./baked/seating-'+quality+'.json',import.meta.url),{signal});
 if(!response.ok)throw Error('Rock seating manifest '+response.status);
 const data=await response.json();signal.throwIfAborted();seatingCache.set(quality,data);return data;
}
