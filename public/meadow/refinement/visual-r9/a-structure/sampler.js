import {CONFIG as C} from '../../../modules/planet-terrain/config.js';
import {directionFromUV,uvFromDirection,designFeatures,waterStage,channelWidth,nearest,dot,sub,cross,norm} from '../../provider.js';
export const REVISION='terrain-r9-open-coast-1';
const R=12,S=C.mesh.sectors;
export function triangleHit(positions,indices,ti,n){
 const a=indices[ti*3]*3,b=indices[ti*3+1]*3,c=indices[ti*3+2]*3;
 const A=[positions[a],positions[a+1],positions[a+2]],B=[positions[b],positions[b+1],positions[b+2]],D=[positions[c],positions[c+1],positions[c+2]];
 const ab=sub(B,A),ac=sub(D,A),N=cross(ab,ac),den=dot(N,n);
 if(Math.abs(den)<1e-12)return null;
 const radius=dot(N,A)/den,q=n.map(x=>x*radius),v=sub(q,A),aa=dot(ab,ab),bb=dot(ac,ac),cc=dot(ab,ac),det=aa*bb-cc*cc;
 const x=(dot(v,ab)*bb-dot(v,ac)*cc)/det,y=(dot(v,ac)*aa-dot(v,ab)*cc)/det;
 if(!Number.isFinite(x)||x< -1e-7||y< -1e-7||x+y>1+1e-7)return null;
 return {height:radius-R,position:q,normal:norm(N),triangle:ti,direction:n};
}
export function createProvider(data,coasts=[],river=[]){
 const rings=[0],{fineRings:F,outerRings:O,fineRadius:D}=C.mesh;
 for(let i=1;i<=F;i++)rings.push(D*i/F);
 for(let i=1;i<O;i++)rings.push(D+(Math.PI*R-D)*i/O);rings.push(Math.PI*R);
 function hit(u,v){
  const d=Math.hypot(u,v);if(!Number.isFinite(d)||d>=Math.PI*R-.1)throw RangeError('Outside surface v1 north chart');
  const n=directionFromUV(u,v),a=(Math.atan2(v,u)+Math.PI*2)%(Math.PI*2),j=Math.floor(a/(Math.PI*2)*S);
  let lo=0,hi=rings.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(rings[m]<=d)lo=m;else hi=m}
  for(const k of [lo,lo-1,lo+1])if(k>=0&&k<rings.length-1)for(const dj of [0,-1,1]){
   const jj=(j+dj+S)%S,base=k===0?jj:S+(k-1)*S*2+jj*(k===rings.length-2?1:2);
   for(let t=0;t<(k===0||k===rings.length-2?1:2);t++){
    const lo=data.cellOffsets?data.cellOffsets[base+t]:base+t,hi=data.cellOffsets?data.cellOffsets[base+t+1]:base+t+1;
    for(let ti=lo;ti<hi;ti++){const h=triangleHit(data.positions,data.indices,ti,n);if(h)return h;}
   }
  }throw Error('Candidate mesh intersection missing '+u+','+v);
 }
 function waterAt(u,v,ground=hit(u,v)){
  if(!data.water)return null;
  const w=data.water,lo=w.offsets[ground.triangle],hi=w.offsets[ground.triangle+1];
  for(let ti=lo;ti<hi;ti++){const h=triangleHit(w.positions,w.indices,ti,ground.direction);if(h)return {...h,depth:h.height-ground.height};}
  return null;
 }
 function sample(u,v){
  const h=hit(u,v),f=designFeatures(u,v),w=waterAt(u,v,h);
  return {u,v,height:h.height,position:h.position,direction:h.direction,triangle:h.triangle,
   zones:{wet:!!w&&w.depth>=-1e-5,sea:h.height<C.seaLevel,river:!!w&&w.height>C.seaLevel+.003,
    path:f.path.distance<.43,protectedHouse:Math.abs(u-C.house.u)<C.house.halfWidth&&Math.abs(v-C.house.v)<C.house.halfDepth,
    protectedTree:Math.hypot(u-C.tree.u,v-C.tree.v)<C.tree.radius,riverDistance:f.river.distance,pathDistance:f.path.distance}};
 }
 function frame(u,v){
  const h=hit(u,v),s=sample(u,v),dx=sub(directionFromUV(u+.001,v),directionFromUV(u-.001,v));
  const east=norm(sub(dx,h.normal.map(x=>x*dot(dx,h.normal)))),south=norm(cross(east,h.normal));
  return {...s,normal:h.normal,east,south};
 }
 const surface=Object.freeze({version:1,revision:REVISION,radius:R,directionFromUV,uvFromDirection,sample,frame});
 const hydrology=Object.freeze({version:1,surfaceRevision:REVISION,seaLevel:C.seaLevel,river,
  radialPoint:(u,v,h)=>directionFromUV(u,v).map(x=>x*(R+h)),waterAt,
  shoreline:Object.freeze({status:'FINAL_SAMPLED',curves:coasts,signedDistance:(u,v)=>{
   const d=Math.min(...coasts.map(line=>nearest(line,u,v).distance));return hit(u,v).height<C.seaLevel?-d:d;
  }})});
 return {surface,hydrology,hit};
}
export function deriveCoasts(positions,indices){
 const points=new Map(),adj=new Map(),seaRadius=12+C.seaLevel;
 const p=i=>Array.from(positions.subarray(i*3,i*3+3));
 const edge=(a,b)=>{
  const key=a<b?a+':'+b:b+':'+a;if(points.has(key))return key;
  let A=p(a),B=p(b),wet=Math.hypot(...A)<seaRadius;
  for(let n=0;n<40;n++){const m=A.map((x,k)=>(x+B[k])/2);if((Math.hypot(...m)<seaRadius)===wet)A=m;else B=m;}
  const q=A.map((x,k)=>(x+B[k])/2);points.set(key,[...uvFromDirection(q),Math.hypot(...q)-12]);return key;
 };
 const link=(a,b)=>{if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b)};
 for(let i=0;i<indices.length;i+=3){
  const ids=Array.from(indices.subarray(i,i+3)),keys=[];
  for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3];if((Math.hypot(...p(a))<seaRadius)!==(Math.hypot(...p(b))<seaRadius))keys.push(edge(a,b));}
  if(keys.length===2){link(keys[0],keys[1]);link(keys[1],keys[0]);}
 }
 const visited=new Set(),loops=[];
 for(const start of adj.keys()){
  if(visited.has(start))continue;const loop=[];let prev=null,current=start;
  do{if(adj.get(current)?.length!==2)throw Error('Nonmanifold candidate coast');
   visited.add(current);loop.push(points.get(current));const next=adj.get(current).find(x=>x!==prev);prev=current;current=next;
  }while(current!==start&&!visited.has(current));
  if(current!==start)throw Error('Open candidate coast');loop.push(loop[0]);loops.push(loop);
 }return loops.sort((a,b)=>b.length-a.length);
}
