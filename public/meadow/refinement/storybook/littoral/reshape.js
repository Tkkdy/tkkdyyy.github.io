import * as T from 'three';
import {seatRock,contactGaps,supportPoints} from '../../visual-r3/rocks/placement.js';
// Two deliberately lowered forebay outcrops; final triangles still own all seating.
export function reshape(ctx,cached){
 const {world,surface,debug}=ctx,mesh=world.getObjectByName('fractured-shore-stones-0');
 if(!mesh?.isInstancedMesh)throw Error('Littoral forebay batch missing');
 const source=mesh.instanceMatrix,copy=source.clone(),sphere=mesh.boundingSphere,box=mesh.boundingBox,records=[],bindings=[];
 if(cached){for(const r of cached){const record={...r,plane:new T.Vector4().fromArray(r.plane),footprint:new T.Vector4().fromArray(r.footprint)};copy.array.set(r.after,r.index*16);records.push(record);}}else{
 for(const index of [0,1]){
  const matrix=new T.Matrix4().fromArray(source.array,index*16),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();matrix.decompose(p,q,s);const before=matrix.toArray();
  const groundUV=surface.uvFromDirection(p.toArray()),ground=surface.frame(...groundUV),up=new T.Vector3(...ground.normal);
  for(let col=0;col<3;col++){const axis=new T.Vector3().setFromMatrixColumn(matrix,col),height=axis.dot(up);axis.multiplyScalar(1.08).addScaledVector(up,height*(.42-1.08));matrix.elements[col*4]=axis.x;matrix.elements[col*4+1]=axis.y;matrix.elements[col*4+2]=axis.z;}
  const fit=seatRock(matrix,mesh.geometry,surface,{embed:.045,align:false,diagnostics:true});
  if(fit.maxBaseGap>.006){const sink=fit.maxBaseGap+.008,radial=new T.Vector3(...surface.directionFromUV(...groundUV)),position=new T.Vector3().setFromMatrixPosition(matrix).addScaledVector(radial,-sink);matrix.setPosition(position);const gaps=contactGaps(supportPoints(mesh.geometry),matrix,surface).sort((a,b)=>a-b);fit.afterP90=gaps[Math.floor((gaps.length-1)*.9)];fit.maxBaseGap=gaps.at(-1);fit.minBaseGap=gaps[0];fit.radialShift-=sink;fit.visibleTop-=sink;}
  matrix.toArray(copy.array,index*16);p.setFromMatrixPosition(matrix);const uv=surface.uvFromDirection(p.toArray()),f=surface.frame(...uv),plane=new T.Vector4(...f.normal,new T.Vector3(...f.normal).dot(new T.Vector3(...f.position)));
  const points=mesh.geometry.attributes.position,us=[],vs=[],v=new T.Vector3();for(let j=0;j<points.count;j++){v.fromBufferAttribute(points,j).applyMatrix4(matrix);const a=surface.uvFromDirection(v.toArray());us.push(a[0]);vs.push(a[1]);}
  const footprint=new T.Vector4((Math.min(...us)+Math.max(...us))*.5,(Math.min(...vs)+Math.max(...vs))*.5,(Math.max(...us)-Math.min(...us))*.5,(Math.max(...vs)-Math.min(...vs))*.5);
  records.push({index,before,after:matrix.toArray(),fit,uv,plane,footprint,groundIndex:debug.r6Ground.contacts.findIndex(c=>c.mesh===mesh.name&&c.index===index),waterIndex:debug.r8D.contacts.findIndex(c=>c.name===mesh.name&&c.instance===index)});
 }
 }
 mesh.instanceMatrix=copy;copy.needsUpdate=true;mesh.boundingSphere=null;mesh.boundingBox=null;mesh.computeBoundingSphere();mesh.computeBoundingBox();
 world.traverse(o=>{if(!o.isMesh||Array.isArray(o.material)||(!o.material?.userData.eGround&&o!==debug.r8D.mesh))return;const src=o.material,m=src.clone(),compile=src.onBeforeCompile,key=src.customProgramCacheKey();if(Object.hasOwn(src,'onBeforeRender'))m.onBeforeRender=src.onBeforeRender;if(src.userData.ecosystemWind)m.userData.ecosystemWind=src.userData.ecosystemWind;
 m.customProgramCacheKey=()=>key+'|storybook-outcrop-contact-2';m.onBeforeCompile=(shader,r)=>{compile.call(src,shader,r);for(const rec of records){for(const name of ['bRockContacts','r6Footprints'])if(shader.uniforms[name]?.value[rec.groundIndex]){const a=shader.uniforms[name].value.map(v=>v.clone());a[rec.groundIndex]=rec.footprint.clone();shader.uniforms[name]={value:a};}if(shader.uniforms.r8Rocks?.value[rec.waterIndex]){const a=shader.uniforms.r8Rocks.value.map(v=>v.clone());a[rec.waterIndex]=rec.footprint.clone();shader.uniforms.r8Rocks={value:a};}if(o===mesh&&shader.uniforms.r6GroundPlane?.value[rec.index]){const a=shader.uniforms.r6GroundPlane.value.map(v=>v.clone());a[rec.index]=rec.plane.clone();shader.uniforms.r6GroundPlane={value:a};}}};o.material=m;bindings.push({o,src,m});});
 let disposed=false;return {records,dispose(){if(disposed)return;disposed=true;for(const {o,src,m}of bindings){if(o.material===m)o.material=src;m.dispose();}if(mesh.instanceMatrix===copy){mesh.dispose();mesh.instanceMatrix=source;mesh.boundingSphere=sphere;mesh.boundingBox=box;}},inspect:()=>records.map(r=>({...r,plane:r.plane.toArray(),footprint:r.footprint.toArray()}))};
}


