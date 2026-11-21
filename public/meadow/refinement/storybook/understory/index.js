import * as T from 'three';
const REVISION='storybook-understory-2';
function geometry(kind){
 const pos=[],colors=[],ix=[];const palette=kind==='oat'?['#84916c','#a4a780','#b9b18b']:kind==='leaf'?['#405a3c','#627849','#7b8b59']:['#60734c','#78875b','#8a9669'];
 function ribbon(a,length,width,bend,y=0,offset=0){const start=pos.length/3;for(let k=0;k<4;k++){const t=k/3,w=Math.sin(Math.PI*t)*width*.5,l=length*(t-.28*t*t*t),z=bend*t*t;const c=new T.Color(palette[Math.min(2,Math.floor(t*2.8))]);for(const side of [-1,1]){pos.push((side*w)*Math.cos(a)+(z+offset)*Math.sin(a),y+l,-side*w*Math.sin(a)+(z+offset)*Math.cos(a));colors.push(c.r,c.g,c.b);}}for(let k=0;k<3;k++){const n=start+k*2;ix.push(n,n+2,n+1,n+1,n+2,n+3);}}
 if(kind==='leaf'){for(let j=0;j<3;j++)ribbon(j*2.1,.075,.070,.10,.012,.015);}
 else if(kind==='oat'){for(let j=0;j<2;j++){const a=j*.5;ribbon(a,.28+j*.04,.008,.075);for(let k=0;k<4;k++)ribbon(a+(k%2?-.7:.7),.035,.022,.025,.16+k*.023,.036+k*.004);}}
 else for(let j=0;j<6;j++)ribbon(j*.37-.7,(kind==='low'?.07:.12)+(j%3)*.023,(kind==='low'?.023:.029),.06+(j%2)*.025);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(ix);g.computeVertexNormals();return g;
}
export async function install(ctx){
 const cache=await(await fetch(new URL('./layout.json',import.meta.url),{signal:ctx.signal})).json();if(cache.surfaceRevision!==ctx.surface.revision)throw Error('Understory surface revision mismatch: rebuild layout');
 for(const a of cache.anchors){const p=ctx.surface.frame(...a.uv).position;if(Math.hypot(...p.map((n,i)=>n-a.position[i]))>1e-5)throw Error('Understory ground fingerprint mismatch: rebuild layout');}
 ctx.signal?.throwIfAborted();const group=new T.Group();group.name='Storybook / connected grass understory';ctx.world.add(group);const geometries=[],materials=[],meshes=[];let disposed=false;
 for(const kind of ['grass','low','leaf','oat']){const records=cache.records.filter(p=>p.kind===kind),g=geometry(kind),m=new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.96,emissive:'#4c5c3c',emissiveIntensity:.24,side:T.DoubleSide}),mesh=new T.InstancedMesh(g,m,records.length);const color=new T.Color();records.forEach((p,i)=>{mesh.setMatrixAt(i,new T.Matrix4().fromArray(p.matrix));color.setRGB(.81+p.pigment*.19,.85+p.pigment*.15,.78+p.pigment*.16);mesh.setColorAt(i,color);});mesh.name='Storybook understory / '+kind;mesh.receiveShadow=true;mesh.castShadow=false;mesh.computeBoundingSphere();group.add(mesh);geometries.push(g);materials.push(m);meshes.push(mesh);}
 const api={group,inspect:()=>({revision:REVISION,disposed,plants:cache.records.length,surfaceRevision:cache.surfaceRevision,frameQueriesAtInstall:cache.anchors.length,drawCalls:meshes.length,triangles:meshes.reduce((n,m)=>n+m.geometry.index.count/3*m.count,0),byKind:Object.fromEntries(meshes.map(m=>[m.name,m.count])),rejected:cache.rejected}),dispose(){if(disposed)return;disposed=true;ctx.signal?.removeEventListener('abort',api.dispose);group.removeFromParent();meshes.forEach(m=>m.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());ctx.invalidate?.();}};ctx.signal?.addEventListener('abort',api.dispose,{once:true});ctx.invalidate?.();return api;
}


