import * as T from 'three';
import {clearance,rockObstacles,random} from '../visual-r9/c-ecology/layout.js';

const REVISION='fusion-a-detail-placement-3';
const V=a=>new T.Vector3(...a);
const triangles=g=>(g.index?.count??g.attributes.position.count)/3;
function dimensions(geometry){
 const p=geometry.attributes.position;let radius=0,minY=Infinity,maxY=-Infinity;
 for(let i=0;i<p.count;i++){radius=Math.max(radius,Math.hypot(p.getX(i),p.getZ(i)));minY=Math.min(minY,p.getY(i));maxY=Math.max(maxY,p.getY(i));}
 return {radius,minY,maxY};
}

// New detail only. Source species geometry, full R9/E material and the single
// ecology clock are shared; existing source instance matrices remain untouched.
export function createMeadow(ctx){
 const {surface,hydrology,ecology,world,debug}=ctx;
 const grass=ecology.group.getObjectByName('ecosystem-grass-near');
 const flowers=ecology.group.getObjectByName('ecosystem-flowers-near');
 if(!grass?.isInstancedMesh||!grass.material.userData.ecosystemWind?.time)throw Error('Fusion details require A final grass and shared clock');
 const rocks=rockObstacles(ctx),rng=random(170531),records=[],meshes=[];
 const sources=new Map(),mat=new T.Matrix4(),turn=new T.Matrix4();
 const edgeAt=(u,v)=>debug.r7B.road.edgeHalfWidthAt(u,v);
 const rejected={};const reject=why=>{rejected[why]=(rejected[why]??0)+1;return false;};
 function safe(u,v,radius,shortGrass=false){
  const s=surface.sample(u,v),z=s.zones??{};
  if(z.wet||z.sea||z.river)return reject('wet-centre');
  if(z.protectedHouse)return reject('house-centre');
  if(z.protectedTree)return reject('tree-centre');
  const water=hydrology.waterAt?.(u,v);if(water?.depth>.001)return reject('water-centre');
  if(rocks.some(r=>Math.hypot(r.u-u,r.v-v)<r.footprint+radius*.65))return reject('rock');
  if(!shortGrass)return clearance(ctx,u,v,radius)||reject('flower-clearance');
  const f=surface.frame(u,v),slope=f.normal.reduce((n,x,i)=>n+x*f.direction[i],0);
  // The generic A clearance is for tall grass and ferns (36.9 degree limit).
  // Short tufts follow the real slope; reject only >56.6 degrees and actual
  // root-plane discontinuities rather than excluding the whole front meadow.
  if(slope<.55)return reject('steep-slope');
  const roots=debug.r7B.rootRegions??[];
  if(roots.some(r=>Math.hypot(u-r.u,v-r.v)<(r.kind==='main'?debug.r7B.rootRadiusAt(u,v):r.radius)+radius+.025))return reject('measured-root');
  if(z.pathDistance<edgeAt(u,v)+.014)return reject('root-on-path');
  for(let k=0;k<8;k++){
   const a=k*Math.PI/4,p=f.position.map((n,i)=>n+f.east[i]*Math.cos(a)*radius+f.south[i]*Math.sin(a)*radius),uv=surface.uvFromDirection(p);
   const rim=surface.sample(...uv),rz=rim.zones;
   if(rz.wet||rz.sea||rz.river||rim.height<hydrology.seaLevel+.035)return reject('wet-footprint');
   if(rz.protectedHouse||rz.protectedTree)return reject('protected-footprint');
   // Leaf tips may interrupt the painted edge by <=4.5 cm; the walked centre
   // remains clear. Root centres never enter the existing path boundary.
   if(rz.pathDistance<Math.max(.19,edgeAt(...uv)-.045))return reject('walked-centre');
   const rootR=Math.min(.018,radius),rp=f.position.map((n,i)=>n+f.east[i]*Math.cos(a)*rootR+f.south[i]*Math.sin(a)*rootR),ruv=surface.uvFromDirection(rp),ground=surface.sample(...ruv);
   const rootGap=ground.position.reduce((n,x,i)=>n+(x-rp[i])*f.normal[i],0);
   if(Math.abs(rootGap)>.012)return reject('root-plane-gap');
  }
  return f;
 }
 function add(kind,source,u,v,size,frame,zone='path-meadow'){
  const d=dimensionsCache.get(source),verticalScale=kind==='grass'?.66:1,pos=V(frame.position).addScaledVector(V(frame.normal),-d.minY*size*verticalScale-.003);
  mat.makeBasis(V(frame.east),V(frame.normal),V(frame.south)).setPosition(pos).multiply(turn.makeRotationY(rng()*Math.PI*2)).scale(new T.Vector3(size,size*verticalScale,size));
  records.push({kind,zone,u,v,size,verticalScale,rootSpacing:kind==='grass'?.075+size*.05:0,footprint:d.radius*size,rootEmbed:.003,matrix:mat.clone()});sources.set(kind,source);
 }
 const dimensionsCache=new Map([[grass,dimensions(grass.geometry)]]);
 if(flowers)dimensionsCache.set(flowers,dimensions(flowers.geometry));
 const grassTarget=ctx.quality==='mobile'?200:320;
 const attempted={meadow:0,coast:0};
 const rootSpacing=size=>.075+size*.05;
 for(let attempt=0;attempt<60000&&records.length<Math.floor(grassTarget*.85);attempt++){
  attempted.meadow++;
  // Once a few valid roots exist, grow small neighbouring pockets instead of
  // repeatedly spending the sample budget in sea, buildings or rock footprints.
  const seeded=records.length>12&&rng()<.65;
  let u,v;
  if(seeded){const c=records[Math.floor(rng()*records.length)],a=rng()*Math.PI*2,d=.085+rng()*.23;u=c.u+Math.cos(a)*d;v=c.v+Math.sin(a)*d;}
  else{u=-5.8+rng()*8.2;v=.18+rng()*3.7;}
  const s=surface.sample(u,v),z=s.zones??{},pd=z.pathDistance;
  if(!Number.isFinite(pd)||z.wet||z.sea||z.river||z.protectedHouse||z.protectedTree)continue;
  const gap=pd-edgeAt(u,v);
  // Broken grass shoulders and selected meadow pockets, never a continuous
  // gold needle belt. Density falls off away from a lived-in path or flower bed.
  if(gap<.018||gap>2.5){reject('outside-meadow-band');continue;}
  const patch=.5+.24*Math.sin(u*2.4+Math.sin(v*2.2))+.23*Math.sin(v*3.1-u*1.1);
  if(patch<.43||rng()>(seeded?.85:gap<.38?.80:.45)){reject('patch-density');continue;}
  const size=.16+rng()*.10,d=dimensionsCache.get(grass),radius=d.radius*size+.008;
  if(records.some(r=>Math.hypot(r.u-u,r.v-v)<Math.max(rootSpacing(size),r.rootSpacing??.08))){reject('root-spacing');continue;}
  const f=safe(u,v,radius,true);if(!f)continue;
  add('grass',grass,u,v,size,f);
 }
 // Current A coast samples guide dry bank pockets; no B shoreline positions.
 const coastPoints=(hydrology.shoreline.curves??[]).flat().filter(p=>p[0]>-8&&p[0]<5.5&&p[1]>.3&&p[1]<6.5);
 for(let attempt=0;attempt<16000&&records.length<grassTarget&&coastPoints.length;attempt++){
  attempted.coast++;
  const c=coastPoints[Math.floor(rng()*coastPoints.length)],a=rng()*Math.PI*2,distance=.14+rng()*.48;
  const u=c[0]+Math.cos(a)*distance,v=c[1]+Math.sin(a)*distance;
  if(Math.sin(u*2.5+v*1.7)<.15)continue;
  const size=.15+rng()*.10,radius=dimensionsCache.get(grass).radius*size+.008;
  if(records.some(r=>Math.hypot(r.u-u,r.v-v)<Math.max(rootSpacing(size),r.rootSpacing??.08))){reject('root-spacing');continue;}
  const f=safe(u,v,radius,true);if(!f)continue;
  add('grass',grass,u,v,size,f,'dry-coast');
 }
 if(flowers){
  const candidates=[],p=new T.Vector3();
  for(let i=0;i<flowers.count;i++){flowers.getMatrixAt(i,mat);p.setFromMatrixPosition(mat);const [u,v]=surface.uvFromDirection(p.toArray());if(u>-6.8&&u<4.7&&v>-.7&&v<4.5)candidates.push({u,v});}
  const count=ctx.quality==='mobile'?10:18;
  for(let attempt=0,placed=0;attempt<count*35&&placed<count&&candidates.length;attempt++){
   const c=candidates[Math.floor(rng()*candidates.length)],a=rng()*Math.PI*2,spread=.16+rng()*.22,u=c.u+Math.cos(a)*spread,v=c.v+Math.sin(a)*spread;
   const size=.30+rng()*.16,radius=dimensionsCache.get(flowers).radius*size+.025;
   if(records.some(r=>Math.hypot(r.u-u,r.v-v)<radius+r.footprint+.035))continue;
   const f=safe(u,v,radius);if(!f)continue;
   add('flowers',flowers,u,v,size,f);placed++;
  }
 }
 for(const [kind,source]of sources){
  const subset=records.filter(r=>r.kind===kind),mesh=new T.InstancedMesh(source.geometry,source.material,subset.length);
  mesh.name='Fusion A+B / '+(kind==='grass'?'soft short meadow':'flower pocket companions');
  subset.forEach((r,i)=>mesh.setMatrixAt(i,r.matrix));mesh.instanceMatrix.needsUpdate=true;
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.10;
  mesh.userData.fusion={revision:REVISION,kind,surfaceRevision:surface.revision,materialOwner:'retained A R9/E',clockOwner:'ground-ecosystem'};
  ecology.group.add(mesh);meshes.push(mesh);
 }
 // A's existing pale, embedded path stones are the material/shape reference.
 const stoneSource=debug.r7B?.details?.mesh,stoneRecords=[];
 if(stoneSource){
  const old=debug.r7B.details.records??[];
  for(let attempt=0;attempt<4000&&stoneRecords.length<22;attempt++){
   const u=-2.8+rng()*4.0,v=-.75+rng()*3.7,s=surface.sample(u,v),z=s.zones??{},pd=z.pathDistance,gap=pd-edgeAt(u,v);
   if(z.wet||z.sea||z.river||z.protectedHouse||z.protectedTree||gap<-.105||gap>-.018||pd<.16)continue;
   if(old.some(r=>Math.hypot(r.u-u,r.v-v)<.075)||stoneRecords.some(r=>Math.hypot(r.u-u,r.v-v)<.11))continue;
   if(rocks.some(r=>Math.hypot(r.u-u,r.v-v)<r.footprint+.035))continue;
   if(Math.sin(u*6+v*2)<.25)continue;
   const f=surface.frame(u,v),r=.009+rng()*.012,h=.003+rng()*.005;
   mat.makeBasis(V(f.east),V(f.normal),V(f.south)).setPosition(V(f.position).addScaledVector(V(f.normal),-.0015)).multiply(turn.makeRotationY(rng()*Math.PI*2)).scale(new T.Vector3(r,h,r*(.65+rng()*.25)));
   stoneRecords.push({u,v,radius:r,height:h,matrix:mat.clone()});
  }
  const mesh=new T.InstancedMesh(stoneSource.geometry,stoneSource.material,stoneRecords.length),color=new T.Color();
  mesh.name='Fusion A+B / embedded shoulder grit';stoneRecords.forEach((r,i)=>{mesh.setMatrixAt(i,r.matrix);if(stoneSource.instanceColor){stoneSource.getColorAt(i%stoneSource.count,color);mesh.setColorAt(i,color);}});
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.receiveShadow=true;mesh.castShadow=false;mesh.computeBoundingSphere();world.add(mesh);meshes.push(mesh);
 }
 let disposed=false;
 return {meshes,records:records.map(({matrix,...r})=>r),stoneRecords:stoneRecords.map(({matrix,...r})=>r),
  stats:{attempted,rejected,grassTarget,grass:records.filter(r=>r.kind==='grass').length,coastGrass:records.filter(r=>r.zone==='dry-coast').length,flowers:records.filter(r=>r.kind==='flowers').length,stones:stoneRecords.length,drawCalls:meshes.length,submittedTriangles:meshes.reduce((n,m)=>n+triangles(m.geometry)*m.count,0),newGeometryBuffers:0,newMaterials:0,newClocks:0},
  dispose(){if(disposed)return;disposed=true;for(const m of meshes){m.removeFromParent();m.dispose();}/* Shared geometry/materials remain owned by A. */}};
}
