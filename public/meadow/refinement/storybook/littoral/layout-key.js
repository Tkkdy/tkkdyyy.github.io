// Cheap dependency fingerprint: final ground chart, protected transforms, original rock instances.
export function layoutKey(ctx,source){
 const {world,surface,hydrology,debug}=ctx,data=[source,layoutKey.toString(),ctx.quality,surface.revision,hydrology.revision,hydrology.seaLevel];
 for(const [u,v]of [[-6,2],[-3,5],[0,1],[0,5],[3,3],[3,7],[6,8]]){const f=surface.frame(u,v);data.push(f.position,f.normal,f.zones);}
 for(const o of [ctx.assets.cottage,ctx.assets.tree])data.push(o.matrix.toArray(),o.parent.matrix.toArray());
 world.traverse(o=>{if(o.isInstancedMesh&&(/fractured-shore-stones/.test(o.name)||o.userData.ecosystem?.kind?.includes('rock')))data.push(o.name,Array.from(o.instanceMatrix.array),o.geometry.attributes.position.count);});
 const b=debug.r7B,a=debug.r7A?.auxiliaryTree;data.push(b?.rootRegions,b?.rootRadiusAt?.toString(),b?.road?.edgeHalfWidthAt?.toString(),a?.u,a?.v,a?.rootRadius);
 const text=JSON.stringify(data);let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,'0');
}

