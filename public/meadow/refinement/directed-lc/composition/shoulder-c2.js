import * as T from 'three';
import {validateContract} from '../../../shared/validate-contract.js';
import {directionFromUV,uvFromDirection,nearest,pathLine,cross,norm,sub,dot} from '../../provider.js';
import {triangleHit} from '../../visual-r9/a-structure/sampler.js';
export const REVISION='directed-c-living-shoulder-2';
const D=[3.6,4.2],R=12;
const clamp=x=>Math.max(0,Math.min(1,x));
function ramp(a,b,x){const t=clamp((x-a)/(b-a));return t*t*(3-2*t);}
function weight(u,v){return ramp(-6,-1,u)*(1-ramp(5,17,u))*ramp(.15,2.5,v)*(1-ramp(8,24,v));}
export function warp(u,v){const w=weight(u,v);return [u+D[0]*w,v+D[1]*w];}
function jac(u,v){const e=.0001,wu=(weight(u+e,v)-weight(u-e,v))/(2*e),wv=(weight(u,v+e)-weight(u,v-e))/(2*e);return [1+D[0]*wu,D[0]*wv,D[1]*wu,1+D[1]*wv];}
export function inverse(u,v){
 // F(q)=q+D*w(q). Its inverse is the scalar bracketed root
 // t-w(z-D*t)=0 on [0,1]; derivative equals positive det(J).
 let lo=0,hi=1,t=weight(u,v);
 for(let i=0;i<48;i++){
  const x=u-D[0]*t,y=v-D[1]*t,f=t-weight(x,y);
  if(Math.abs(f)<1e-11)return [x,y];
  if(f<0)lo=t;else hi=t;
  const j=jac(x,y),derivative=j[0]*j[3]-j[1]*j[2],candidate=t-f/derivative;
  t=Number.isFinite(candidate)&&candidate>lo&&candidate<hi?candidate:(lo+hi)*.5;
 }
 const q=[u-D[0]*t,v-D[1]*t],r=warp(...q);
 if(Math.hypot(r[0]-u,r[1]-v)>1e-7)throw Error('C bracketed inverse failed at '+u+','+v);
 return q;
}
export function jacobian(u,v){const j=jac(u,v);return j[0]*j[3]-j[1]*j[2];}
function topology(g){const a=g.index?.array;let h=2166136261;for(const x of a??[]){h=Math.imul(h^(x&255),16777619);h=Math.imul(h^((x>>>8)&255),16777619);h=Math.imul(h^((x>>>16)&255),16777619);h=Math.imul(h^((x>>>24)&255),16777619);}return {count:a?.length??0,hash:(h>>>0).toString(16),indexed:!!a};}

function chart(p){try{return uvFromDirection(p);}catch{return [37.699,0];}}
function movePoint(p){const [u,v]=chart(p),q=warp(u,v);if(Math.hypot(q[0]-u,q[1]-v)<1e-9)return p.slice();const radius=Math.hypot(...p);return directionFromUV(...q).map(n=>n*radius);}
function mapper(geometry,onlyChanged=true){
 const positions=geometry.attributes.position.array,indices=geometry.index?.array??Uint32Array.from({length:positions.length/3},(_,i)=>i),grid=new Map(),size=.8,uv=[];
 for(let i=0;i<positions.length;i+=3)uv.push(chart([positions[i],positions[i+1],positions[i+2]]));
 const changed=onlyChanged?uv.map(([u,v])=>Math.hypot(...inverse(u,v).map((n,j)=>n-[u,v][j]))>1e-7):null;
 for(let ti=0;ti<indices.length/3;ti++){
  const q=[uv[indices[ti*3]],uv[indices[ti*3+1]],uv[indices[ti*3+2]]];
  if(onlyChanged&&![indices[ti*3],indices[ti*3+1],indices[ti*3+2]].some(i=>changed[i]))continue;
  const minX=Math.min(...q.map(p=>p[0])),maxX=Math.max(...q.map(p=>p[0])),minY=Math.min(...q.map(p=>p[1])),maxY=Math.max(...q.map(p=>p[1]));
  if(maxX-minX>5||maxY-minY>5)continue;
  for(let x=Math.floor(minX/size);x<=Math.floor(maxX/size);x++)for(let y=Math.floor(minY/size);y<=Math.floor(maxY/size);y++){const k=x+','+y;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(ti);}
 }
 return {positions,indices,grid,hit(u,v){const n=directionFromUV(u,v);for(const ti of grid.get(Math.floor(u/size)+','+Math.floor(v/size))??[]){const h=triangleHit(positions,indices,ti,n);if(h)return h;}return null;}};
}
function basis(f){return new T.Matrix4().makeBasis(new T.Vector3(...f.east),new T.Vector3(...f.normal),new T.Vector3(...f.south));}
export async function installShoulder(ctx){
 const {world,terrain,water,ecology,shore,debug,signal}=ctx,oldSurface=ctx.surface,oldHydro=ctx.hydrology;
 signal?.throwIfAborted();world.updateMatrixWorld(true);
 const worldInverse=world.matrixWorld.clone().invert();
 const start=performance.now(),bindings=[],owned=[],materialOwned=[],instanceRecords=[],planesByMesh=new Map(),stats={movedVertices:0,movedInstances:0,changedGeometry:0,minJacobian:Infinity,maxInverseError:0,maxMatrixFloat32Error:0,maxRootNormalOffsetChange:0,worldLocalGeometryChecks:[],waterMeshes:0,shaderChanges:0};
 for(let u=-7;u<=19;u+=.25)for(let v=-1;v<=26;v+=.25){const j=jac(u,v),d=j[0]*j[3]-j[1]*j[2];stats.minJacobian=Math.min(stats.minJacobian,d);const w=warp(u,v),q=inverse(...w);stats.maxInverseError=Math.max(stats.maxInverseError,Math.hypot(q[0]-u,q[1]-v));}
 if(stats.minJacobian<.25)throw Error('C map folds or compresses beyond bound');
 const terrainMesh=terrain.group.children.find(m=>m.isMesh),waterMeshes=[];water.group.traverse(m=>{if(m.isMesh)waterMeshes.push(m);});if(waterMeshes.length!==1)throw Error('C requires unique original water mesh');const waterMesh=waterMeshes[0];stats.waterMeshes=waterMeshes.length;const sourceTopology={terrain:topology(terrainMesh.geometry),water:topology(waterMesh.geometry)};
 let disposed=false,provider;
 function geometry(mesh){
  const local=worldInverse.clone().multiply(mesh.matrixWorld),identity=new T.Matrix4(),error=Math.max(...local.elements.map((v,i)=>Math.abs(v-identity.elements[i])));
  stats.worldLocalGeometryChecks.push({name:mesh.name,maxIdentityError:error});if(error>1e-7)throw Error('C shell is not world-local: '+mesh.name);
  const source=mesh.geometry,g=source.clone(),a=g.attributes.position;let changed=0;
  for(let i=0;i<a.count;i++){const p=[a.getX(i),a.getY(i),a.getZ(i)],q=movePoint(p);if(Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2])>1e-8){a.setXYZ(i,...q);changed++;}}
  if(!changed){g.dispose();return source;}
  g.computeVertexNormals();g.computeBoundingSphere();g.computeBoundingBox();a.needsUpdate=true;bindings.push({mesh,type:'geometry',source,copy:g});owned.push(g);mesh.geometry=g;stats.movedVertices+=changed;stats.changedGeometry++;return g;
 }
 function dispose(){if(disposed)return;disposed=true;for(const b of bindings.reverse()){
  if(b.type==='geometry'&&b.mesh.geometry===b.copy)b.mesh.geometry=b.source;
  if(b.type==='material'&&b.mesh.material===b.copy)b.mesh.material=b.source;
  if(b.type==='matrix'&&b.mesh.instanceMatrix===b.copy){b.mesh.dispose();b.mesh.instanceMatrix=b.source;b.mesh.boundingSphere=b.sphere;b.mesh.boundingBox=b.box;}
 }for(const g of owned)g.dispose();for(const m of materialOwned)m.dispose();ctx.invalidate?.();}
 try{
  const tg=geometry(terrainMesh),wg=geometry(waterMesh),terrainMap=mapper(tg),waterMap=mapper(wg,false);
  const coasts=oldHydro.shoreline.curves.map(line=>line.map(p=>[...warp(p[0],p[1]),...p.slice(2)])),path=pathLine.map(p=>warp(...p));
  const river=oldHydro.river.map((p,i,all)=>{const [u,v]=warp(p.u,p.v),a=all[Math.max(0,i-1)],b=all[Math.min(all.length-1,i+1)],len=Math.hypot(b.u-a.u,b.v-a.v),nx=-(b.v-a.v)/len,ny=(b.u-a.u)/len,edge=warp(p.u+nx*p.halfWidth,p.v+ny*p.halfWidth);return {...p,u,v,halfWidth:Math.hypot(edge[0]-u,edge[1]-v)};});
  const riverLine=river.map(p=>[p.u,p.v]),arcs=[0];for(let i=1;i<river.length;i++)arcs.push(arcs[i-1]+Math.hypot(river[i].u-river[i-1].u,river[i].v-river[i-1].v));
  function hit(u,v){const h=terrainMap.hit(u,v);if(h)return h;const [a,b]=inverse(u,v),old=oldSurface.sample(a,b),n=directionFromUV(u,v);const direct=triangleHit(terrainMap.positions,terrainMap.indices,old.triangle,n);if(direct)return direct;throw Error('C true terrain hit missing '+u+','+v);}
  function waterAt(u,v,ground=hit(u,v)){const h=waterMap.hit(u,v);return h?{...h,depth:h.height-ground.height}:null;}
  // bedHeight is actual deformed triangle height. waterHeight remains the
  // inherited monotone water-stage datum: rendered chord sag is measured below.
  stats.riverHeightAudit={maxBedMetadataChange:0,maxRenderedStageDeviation:0,minRenderedClearance:Infinity,maxRenderedRise:0,samples:[]};
  for(const [i,r]of river.entries()){
   const bed=hit(r.u,r.v),wet=waterAt(r.u,r.v,bed);if(!wet)throw Error('C river centre misses unique water mesh '+i);
   stats.riverHeightAudit.maxBedMetadataChange=Math.max(stats.riverHeightAudit.maxBedMetadataChange,Math.abs(r.bedHeight-bed.height));
   r.bedHeight=bed.height;r.renderedWaterHeight=wet.height;
   const a=stats.riverHeightAudit;a.maxRenderedStageDeviation=Math.max(a.maxRenderedStageDeviation,Math.abs(wet.height-r.waterHeight));a.minRenderedClearance=Math.min(a.minRenderedClearance,wet.depth);if(i)a.maxRenderedRise=Math.max(a.maxRenderedRise,wet.height-river[i-1].renderedWaterHeight);
   a.samples.push({i,u:r.u,v:r.v,bedHeight:r.bedHeight,waterHeight:r.waterHeight,renderedWaterHeight:wet.height,renderedDepth:wet.depth});
  }
  function sample(u,v){const h=hit(u,v),[a,b]=inverse(u,v),old=oldSurface.sample(a,b),w=waterAt(u,v,h),pd=nearest(path,u,v).distance;return {...old,u,v,...h,zones:{...old.zones,wet:!!w&&w.depth>=-1e-5,sea:h.height<oldHydro.seaLevel,river:!!w&&w.height>oldHydro.seaLevel+.003,path:pd<.43,pathDistance:pd,riverDistance:nearest(riverLine,u,v).distance}};}
  function frame(u,v){const h=hit(u,v),s=sample(u,v),dx=sub(directionFromUV(u+.001,v),directionFromUV(u-.001,v)),east=norm(sub(dx,h.normal.map(x=>x*dot(dx,h.normal)))),south=norm(cross(east,h.normal));return {...s,normal:h.normal,east,south};}
  const surface=Object.freeze({...oldSurface,revision:REVISION,sample,frame});
  const hydrology=Object.freeze({...oldHydro,surfaceRevision:REVISION,river,waterAt,shoreline:Object.freeze({status:'FINAL_SAMPLED',curves:coasts,signedDistance:(u,v)=>Math.min(...coasts.map(line=>nearest(line,u,v).distance))*(hit(u,v).height<oldHydro.seaLevel?-1:1)})});
  try{stats.contract=validateContract(surface,hydrology);}catch(error){error.riverHeightAudit=stats.riverHeightAudit;throw error;}
  provider={surface,hydrology};
  // Update spatial water attributes without changing topology, shader or clocks.
  const wa=wg.attributes.chart,wd=wg.attributes.waterData,st=wg.attributes.stageDelta;
  for(let i=0;i<wa.count;i++){const q=warp(wa.getX(i),wa.getY(i));wa.setXY(i,...q);if(st.getX(i)>.001&&wd.getY(i)>0){const near=nearest(riverLine,...q),f=near.t*(river.length-1),j=Math.min(river.length-2,Math.floor(f));wd.setY(i,arcs[j]+(arcs[j+1]-arcs[j])*(f-j));}}
  wa.needsUpdate=wd.needsUpdate=true;
  // Preserve path feature/UV coordinates attached to terrain vertices; coast
  // distance is geometry-dependent and is recomputed against the moved shore.
  const feats=tg.attributes.terrainFeatures,pos=tg.attributes.position;
  for(let i=0;i<pos.count;i++){const q=chart([pos.getX(i),pos.getY(i),pos.getZ(i)]),old=inverse(...q);if(Math.hypot(q[0]-old[0],q[1]-old[1])<1e-6)continue;const d=Math.min(...coasts.map(line=>nearest(line,...q).distance));feats.setX(i,d*(Math.hypot(pos.getX(i),pos.getY(i),pos.getZ(i))-R<oldHydro.seaLevel?-1:1));}feats.needsUpdate=true;
  // Ground shells follow exactly the same deformation. Instances remain rigid;
  // carry their embedded offset through old/new surface frames, no added plants.
  for(const group of [ecology.group,shore.group])group.traverse(mesh=>{if(mesh.isMesh&&!mesh.isInstancedMesh)geometry(mesh);});
  const candidates=[];world.traverse(mesh=>{if(mesh.isInstancedMesh&&!mesh.name.startsWith('R7 auxiliary'))candidates.push(mesh);});
  for(const mesh of candidates){const source=mesh.instanceMatrix,copy=source.clone(),mat=new T.Matrix4(),planes=[];let changed=0;
   for(let i=0;i<mesh.count;i++){mat.fromArray(source.array,i*16);const p=new T.Vector3().setFromMatrixPosition(mat),q=chart(p.toArray()),w=warp(...q);if(Math.hypot(w[0]-q[0],w[1]-q[1])<1e-7)continue;
    const a=oldSurface.frame(...q),b=frame(...w);planes[i]=new T.Vector4(...b.normal,dot(b.normal,b.position));const rotation=basis(b).multiply(basis(a).invert()),offset=p.clone().sub(new T.Vector3(...a.position)).applyMatrix4(rotation),next=new T.Vector3(...b.position).add(offset);
    mat.premultiply(rotation).setPosition(next);mat.toArray(copy.array,i*16);changed++;
    stats.maxMatrixFloat32Error=Math.max(stats.maxMatrixFloat32Error,Math.hypot(...next.toArray().map((v,k)=>v-copy.array[i*16+12+k])));
    const actual=Array.from(copy.array.subarray(i*16+12,i*16+15)),actualFrame=frame(...chart(actual)),oldOffset=dot(a.normal,sub(p.toArray(),a.position)),newOffset=dot(actualFrame.normal,sub(actual,actualFrame.position));
    stats.maxRootNormalOffsetChange=Math.max(stats.maxRootNormalOffsetChange,Math.abs(newOffset-oldOffset));
    instanceRecords.push({mesh:mesh.name,index:i,oldUV:q,newUV:w,oldWet:a.zones.wet,newWet:actualFrame.zones.wet,oldNormalOffset:oldOffset,newNormalOffset:newOffset,normalOffsetChange:newOffset-oldOffset});
   }
   if(changed){bindings.push({mesh,type:'matrix',source,copy,sphere:mesh.boundingSphere,box:mesh.boundingBox});mesh.instanceMatrix=copy;copy.needsUpdate=true;mesh.boundingSphere=null;mesh.boundingBox=null;mesh.computeBoundingSphere();mesh.computeBoundingBox();mesh.boundingSphere.radius+=.15;stats.movedInstances+=changed;planesByMesh.set(mesh,planes);}
  }
  // Only geometry-dependent contact coordinates change. N color, BRDF and
  // lighting shader text remain byte-for-byte inherited; all copies roll back.
  const spatialTargets=[];world.traverse(mesh=>{if(mesh.isMesh&&(mesh===waterMesh||mesh.material?.userData?.eGround))spatialTargets.push(mesh);});
  const copies=new Map();
  for(const mesh of spatialTargets){const source=mesh.material,planeOverrides=planesByMesh.get(mesh),cacheId=planeOverrides?mesh:source;let material=copies.get(cacheId);
   if(!material){material=source.clone();const compile=source.onBeforeCompile,key=source.customProgramCacheKey();
    if(source.userData.ecosystemWind)material.userData.ecosystemWind=source.userData.ecosystemWind;
    if(Object.hasOwn(source,'onBeforeRender'))material.onBeforeRender=source.onBeforeRender;
    material.name=source.name+' / C2 spatial contacts';material.customProgramCacheKey=()=>key+'|c2-spatial-contacts';
    material.onBeforeCompile=(s,r)=>{compile.call(source,s,r);
     for(const name of ['bRockContacts','r6Footprints','r8Rocks'])if(s.uniforms[name])s.uniforms[name]={value:s.uniforms[name].value.map(p=>{const copy=p.clone();if(Math.abs(p.x)<38&&Math.abs(p.y)<38){const q=warp(p.x,p.y);copy.x=q[0];copy.y=q[1];}return copy;})};
     if(planeOverrides&&s.uniforms.r6GroundPlane)s.uniforms.r6GroundPlane={value:s.uniforms.r6GroundPlane.value.map((p,i)=>planeOverrides[i]?.clone()??p.clone())};
    };
    materialOwned.push(material);copies.set(cacheId,material);
   }
   bindings.push({mesh,type:'material',source,copy:material});mesh.material=material;
  }
  stats.contactMaterialCopies=materialOwned.length;
  const roadSamples=path.map(([u,v])=>{const s=sample(u,v);return {u,v,height:s.height,wet:s.zones.wet};});
  stats.roadWetCount=roadSamples.filter(p=>p.wet).length;stats.newWetRoots=instanceRecords.filter(r=>!r.oldWet&&r.newWet).length;stats.elapsedMs=performance.now()-start;
  if(stats.roadWetCount||stats.newWetRoots)throw Error('C moved dry path or roots into water');
  return {...provider,dispose,inspect:()=>({revision:REVISION,stats,deltaUV:D,domain:{protectVMax:.15,uSupport:[-6,17],vSupport:[.15,24]},roadSamples,instanceRecords,coastLoops:coasts.length,riverPoints:river.length,sourceTopology,candidateTopology:{terrain:topology(tg),water:topology(wg)},terrainIndexPreserved:JSON.stringify(sourceTopology.terrain)===JSON.stringify(topology(tg)),waterIndexPreserved:JSON.stringify(sourceTopology.water)===JSON.stringify(topology(wg)),limitations:'Same-topology spherical chart deformation. No new water surface or land bridge. Existing path pigment/UV moves with original faces; local pigment stretches with geometry. Grass/rock instances are rigid, groundcover deforms. Water chart and flow length updated; water shader and clock unchanged.'})};
 }catch(error){dispose();throw error;}
}
