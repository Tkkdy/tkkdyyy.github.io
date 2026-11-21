import * as T from 'three';
import {random,rockObstacles} from '../visual-r9/c-ecology/layout.js';

// Each clump opens from a common root. The folded cross-section catches
// two different sky directions even when a blade is edge-on to the camera.
function tussock(short){
 const p=[],colors=[],indices=[];
 const foot=new T.Color('#697357'),leaf=new T.Color(short?'#919473':'#8a9570'),tip=new T.Color(short?'#bab68e':'#c4bf92');
 const blades=short?5:8;
 for(let i=0;i<blades;i++){
  const a=i*2.39996+(short?.45:0),ca=Math.cos(a),sa=Math.sin(a);
  const h=(short?.120:.196)*(.77+.46*(.5+.5*Math.sin(i*7.1)));
  const reach=h*(.28+.56*(i%3)/2),w=(short?.015:.019)*(1+.2*Math.cos(i*1.8));
  const offset=short?.016:.025,start=p.length/3;
  for(const t of [0,.38,.76,1]){
   const center=offset+reach*t*t, curl=.028*t*t*Math.sin(i*1.6);
   const half=w*(1-t)*(.65+.95*Math.sin(t*Math.PI));
   for(const side of [-1,0,1]){
    const along=center+(side===0?.010*(1-t):0),across=side*half+curl;
    p.push(ca*across+sa*along,h*t*(1.-.18*t*t)-.008,-sa*across+ca*along);
    const c=foot.clone().lerp(leaf,Math.min(1,t*2.1)).lerp(tip,Math.max(0,(t-.35)/.65)*(.72+.17*Math.cos(i)));
    colors.push(c.r,c.g,c.b);
   }
  }
  for(let k=0;k<3;k++)for(let j=0;j<2;j++){const n=start+k*3+j;indices.push(n,n+3,n+1);if(k<2)indices.push(n+1,n+3,n+4);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}

function shoulderGrass(ctx,geometry,material){
 const {surface,debug}=ctx,rng=random(182733),rocks=rockObstacles(ctx);
 const parent=debug.art.understory.group;
 const main=parent.getObjectByName('Storybook understory / grass'),low=parent.getObjectByName('Storybook understory / low');
 const occupied=new Set(),cell=(u,v)=>Math.floor(u/.092)+','+Math.floor(v/.092);
 const v3=a=>new T.Vector3(...a),matrix=new T.Matrix4();
 for(const mesh of [main,low])for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,matrix);const uv=surface.uvFromDirection(new T.Vector3().setFromMatrixPosition(matrix).toArray());occupied.add(cell(...uv));
 }
 const records=[];
 const cottageInverse=new T.Matrix4().copy(ctx.assets.cottage.matrixWorld).invert().multiply(ctx.world.matrixWorld);
 for(let i=0;i<2600;i++){
  const u=-5.05+4.85*rng(),v=.18+2.04*rng();
  // Loosely drawn stripes across the slope, interrupted by open ground.
  const islands=.50+.26*Math.sin(3.7*u+6*v+.8*Math.sin(2.4*u))+.17*Math.cos(3.6*v-1.9*u);
  if(rng()>islands*.80||occupied.has(cell(u,v)))continue;
  const s=surface.sample(u,v),z=s.zones,b=debug.r7B;
  if(z.protectedHouse||z.protectedTree||z.wet||z.sea||z.river||z.pathDistance<(b?.road?.edgeHalfWidthAt?.(u,v)??.48)+.095)continue;
  if(rocks.some(q=>Math.hypot(u-q.u,v-q.v)<q.footprint+.04))continue;
  if((b?.rootRegions??[]).some(q=>Math.hypot(u-q.u,v-q.v)<(q.kind==='main'?b.rootRadiusAt(u,v):q.radius)+.06))continue;
  const aux=debug.r7A?.auxiliaryTree;if(aux&&Math.hypot(u-aux.u,v-aux.v)<(aux.rootRadius??.6)+.08)continue;
  const f=surface.frame(u,v),n=v3(f.normal),point=v3(f.position),hp=point.clone().applyMatrix4(cottageInverse);
  if(n.dot(v3(f.direction))<.52||(Math.abs(hp.x)<2.95&&hp.z>1.02&&hp.z<2.55))continue;
  const size=.72+.50*rng()+.48*islands;
  matrix.makeBasis(v3(f.east),n,v3(f.south)).setPosition(point.addScaledVector(n,-.003));
  matrix.multiply(new T.Matrix4().makeRotationY(.35+.85*Math.sin(u*1.1+v*.7)+(rng()-.5)*1.8));
  matrix.scale(new T.Vector3(size,size*.93,size));records.push(matrix.clone());occupied.add(cell(u,v));
 }
 const mesh=new T.InstancedMesh(geometry,material,records.length);
 mesh.name='Velvet dusk / shoulder grass';records.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;
 mesh.receiveShadow=true;mesh.computeBoundingSphere();parent.add(mesh);return mesh;
}

export function installGrass(ctx){
 const bindings=[];
 for(const kind of ['grass','low']){
  const mesh=ctx.world.getObjectByName('Storybook understory / '+kind);
  const original=mesh.geometry,geometry=tussock(kind==='low'),bounds=mesh.boundingSphere?.clone();
  mesh.geometry=geometry;mesh.computeBoundingSphere();bindings.push({mesh,original,geometry,bounds});
 }
 const shoulder=shoulderGrass(ctx,bindings[1].geometry,bindings[1].mesh.material);
 return {clumps:bindings.reduce((n,b)=>n+b.mesh.count,shoulder.count),shoulder:shoulder.count,dispose(){shoulder.removeFromParent();shoulder.dispose();for(const b of bindings){b.mesh.geometry=b.original;b.mesh.boundingSphere=b.bounds;b.geometry.dispose();}}};
}
