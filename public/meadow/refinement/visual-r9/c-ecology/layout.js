import * as T from 'three';
// Interrupted shoulders, asymmetric shore pockets and foreground flower islands.
// Existing instances are redistributed; no plant is removed or regenerated.
export const BEDS=[
 {u:-1.08,v:1.0,rx:.28,rz:.16,angle:.25,zone:'road'},
 {u:1.06,v:.65,rx:.30,rz:.25,angle:.5,zone:'road'},
 {u:1.24,v:1.36,rx:.20,rz:.17,angle:-.3,zone:'road'},
 {u:1.45,v:-.78,rx:.60,rz:.26,angle:-.1,zone:'tree'},
 {u:-6.25,v:.4,rx:1.1,rz:.45,angle:-.5,zone:'water'},
 {u:-7.6,v:2.1,rx:.9,rz:.52,angle:-.6,zone:'water'},
 {u:3.8,v:2.8,rx:1.15,rz:.50,angle:-.25,zone:'water'},
 {u:4.65,v:5.35,rx:1.05,rz:.72,angle:.35,zone:'meadow'},
 {u:5.75,v:7.85,rx:1.2,rz:.65,angle:-.4,zone:'meadow'},
 {u:7.55,v:4.9,rx:.95,rz:.75,angle:.7,zone:'meadow'},
 {u:1.2,v:-5.5,rx:1.15,rz:.4,angle:.15,zone:'tree'},
 {u:-5.75,v:-5.8,rx:1.35,rz:.65,angle:.3,zone:'meadow'},
 {u:7.3,v:-5.6,rx:1.15,rz:.6,angle:.2,zone:'meadow'}
];
export const random=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const V=a=>new T.Vector3(...a);
export function clearance(ctx,u,v,radius,rootGarden=false,providedFrame){
 const {surface,hydrology,debug}=ctx;
 const tree=debug.r7A?.auxiliaryTree;
 if(tree&&Math.hypot(u-tree.u,v-tree.v)<(tree.rootRadius??.6)+radius+.08)return false;
 if(!rootGarden&&Math.hypot(u-1.4,v+2.7)<1.40+radius)return false;
 if(rootGarden&&(Math.hypot(u-1.4,v+2.7)<.62+radius||Math.hypot(u-1.4,v+2.7)>1.35-radius))return false;
 const b=debug.r7B;
 if(typeof b?.clearanceAt==='function'){const result=b.clearanceAt(u,v,radius);if(result===false||result?.allowed===false)return false;}
 const f=providedFrame??surface.frame(u,v);
 if(f.normal.reduce((n,x,i)=>n+x*f.direction[i],0)<.80)return false;
 for(let k=0;k<9;k++){
  const a=k*Math.PI/4,r=k===8?0:radius;
  const p=f.position.map((n,i)=>n+f.east[i]*Math.cos(a)*r+f.south[i]*Math.sin(a)*r),uv=surface.uvFromDirection(p);
  const s=surface.sample(...uv),z=s.zones;
  if(z.wet||z.sea||z.river||z.protectedHouse||(!rootGarden&&z.protectedTree)||z.pathDistance<(b?.road?.edgeHalfWidthAt?.(...uv)??b?.road?.edgeHalfWidth??.48)||s.height<hydrology.seaLevel+.08)return false;
 }
 return f;
}
export function rockObstacles(ctx){
 const result=[],matrix=new T.Matrix4(),pos=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();
 for(const mesh of [...ctx.ecology.group.children,...ctx.shore.group.children]){
  if(!mesh.isInstancedMesh||(!mesh.userData.ecosystem?.kind?.includes('rock')&&!ctx.shore.group.children.includes(mesh)))continue;
  const p=mesh.geometry.attributes.position;let radius=0;for(let j=0;j<p.count;j++)radius=Math.max(radius,Math.hypot(p.getX(j),p.getZ(j)));
  for(let i=0;i<mesh.count;i++){matrix.fromArray(mesh.instanceMatrix.array,i*16);matrix.decompose(pos,q,scale);const uv=ctx.surface.uvFromDirection(pos.toArray()),meta=mesh.userData.ecosystem?.instances?.[i];result.push({u:uv[0],v:uv[1],footprint:Math.max(meta?.footprint??0,radius*Math.max(scale.x,scale.z))+.035});}
 }return result;
}
export function redistribute(ctx,mesh,kind,occupied,rocks){
 const original=mesh.instanceMatrix,copy=original.clone(),rng=random(7911+mesh.count+kind.length),records=[];
 const transform=new T.Matrix4(),turn=new T.Matrix4(),scale=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),size=new T.Vector3();
 const sourceMeta=mesh.userData.ecosystem?.instances??[];
 const gp=mesh.geometry.attributes.position;let horizontal=0,height=0;
 for(let i=0;i<gp.count;i++){horizontal=Math.max(horizontal,Math.hypot(gp.getX(i),gp.getZ(i)));height=Math.max(height,gp.getY(i));}
 const unresolved=[];
 for(let i=0;i<mesh.count;i++){
  transform.fromArray(original.array,i*16);transform.decompose(position,rotation,size);
  const uv=ctx.surface.uvFromDirection(position.toArray()),meta=sourceMeta[i],s=meta?.size??size.x;
  if(Math.hypot(...uv)>13.5)continue;
  const z=ctx.surface.sample(...uv).zones,aux=ctx.debug.r7A?.auxiliaryTree;
  const required=z.wet||z.sea||z.river||(aux&&Math.hypot(uv[0]-aux.u,uv[1]-aux.v)<aux.rootRadius+s*horizontal+.08);
  if(!required&&((!mesh.name.endsWith('-near')&&rng()>.18)||(kind==='grass'&&rng()>.45)||(kind==='fern'&&rng()>.55)))continue;
  const closest=BEDS.map((b,j)=>({...b,j,d:Math.hypot(b.u-uv[0],b.v-uv[1])})).sort((a,b)=>a.d-b.d).slice(0,3);
  if(!required&&closest[0].d>3.8)continue;
  let placed=false;
  for(let attempt=0;attempt<18;attempt++){
   const bed=closest[Math.min(2,Math.floor(rng()*(attempt<9?2:3)))],angle=rng()*Math.PI*2,r=Math.sqrt(rng()),spread=kind==='grass'?1.3:kind==='fern'?1.1:.88;
   const x=Math.cos(angle)*r*bed.rx*spread,z=Math.sin(angle)*r*bed.rz*spread;
   let u=bed.u+x*Math.cos(bed.angle)-z*Math.sin(bed.angle),v=bed.v+x*Math.sin(bed.angle)+z*Math.cos(bed.angle);
   if(kind==='grass'&&['road','tree'].includes(bed.zone)&&rng()<.76){const companions=occupied.filter(p=>p.kind==='flowers'&&p.bed===bed.j);if(companions.length){const flower=companions[Math.floor(rng()*companions.length)],a=rng()*Math.PI*2,d=.16+rng()*.29;u=flower.u+Math.cos(a)*d;v=flower.v+Math.sin(a)*d;}}
   const underAux=ctx.debug.r7A?.auxiliaryTree;
   const canopyScale=underAux&&Math.hypot(u-underAux.u,v-underAux.v)<underAux.canopyRadius?.68:1;
   const factor=(kind==='flowers'?({road:.50,tree:.75,water:.88,meadow:.94}[bed.zone]):kind==='grass'?({road:.52,tree:.76,water:1,meadow:1}[bed.zone]):({road:.50,tree:.76,water:1,meadow:1}[bed.zone]))*canopyScale;
   const finalSize=s*factor,f=ctx.surface.frame(u,v),cos=f.normal.reduce((n,x,i)=>n+x*f.direction[i],0);
   const footprint=finalSize*(horizontal+height*Math.sqrt(Math.max(0,1-cos*cos)))+.04;
   if(rocks.some(p=>Math.hypot(u-p.u,v-p.v)<p.footprint+footprint*.55))continue;
   const separation=finalSize*({grass:.19,flowers:.36,fern:.62}[kind]);
   if(occupied.some(p=>p.kind===kind&&Math.hypot(u-p.u,v-p.v)<separation))continue;
   if(!clearance(ctx,u,v,footprint,false,f))continue;
   const pos=V(f.position).addScaledVector(V(f.normal),-.025*finalSize);
   transform.makeBasis(V(f.east),V(f.normal),V(f.south)).setPosition(pos).multiply(turn.makeRotationY(meta?.heading??rng()*Math.PI*2)).multiply(scale.makeScale(finalSize,finalSize,finalSize));
   copy.array.set(transform.elements,i*16);occupied.push({u,v,kind,bed:bed.j});records.push({i,u,v,footprint,zone:bed.zone,bed:bed.j,size:finalSize,originalSize:s,scaleFactor:factor,required});placed=true;break;
  }
  if(required&&!placed)unresolved.push({i,u:uv[0],v:uv[1],reason:'new wet or auxiliary root exclusion'});
 }
 copy.needsUpdate=true;return {copy,records,unresolved};
}

export function rootGardenLayout(ctx,mesh){
 const copy=mesh.instanceMatrix.clone(),matrix=new T.Matrix4(),turn=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3(),records=[],unresolved=[];
 const meta=ctx.debug.garden.stats.records.filter(p=>p.kind==='flowers'),gp=mesh.geometry.attributes.position;let horizontal=0;for(let k=0;k<gp.count;k++)horizontal=Math.max(horizontal,Math.hypot(gp.getX(k),gp.getZ(k)));
 for(let i=0;i<mesh.count;i++){
  matrix.fromArray(copy.array,i*16);matrix.decompose(position,rotation,scale);
  const original=ctx.surface.uvFromDirection(position.toArray()),factor=.84;scale.multiplyScalar(factor);
  const footprint=horizontal*scale.x+.018,radial=Math.atan2(original[1]+2.7,original[0]-1.4);let uv=original,f=clearance(ctx,...uv,footprint,true);
  // Keep each established pocket; repair only flower/root intersections exposed by B's measured root outline.
  if(!f)for(let attempt=0;attempt<30;attempt++){
   const ring=1+Math.floor(attempt/6),angle=radial+[0,.65,-.65,1.25,-1.25,Math.PI][attempt%6],q=[original[0]+Math.cos(angle)*.035*ring,original[1]+Math.sin(angle)*.035*ring];
   const frame=clearance(ctx,...q,footprint,true);if(frame){uv=q;f=frame;break;}
  }
  if(!f){f=ctx.surface.frame(...original);uv=original;unresolved.push({i,u:uv[0],v:uv[1],reason:'measured main-root footprint'});}
  position.copy(V(f.position)).addScaledVector(V(f.normal),-.012);
  matrix.makeBasis(V(f.east),V(f.normal),V(f.south)).setPosition(position).multiply(turn.makeRotationY(meta[i].heading)).scale(scale);
  copy.array.set(matrix.elements,i*16);records.push({i,u:uv[0],v:uv[1],oldU:original[0],oldV:original[1],size:scale.x,footprint,scaleFactor:factor,zone:'root-garden'});
 }copy.needsUpdate=true;return {copy,records,unresolved};
}
