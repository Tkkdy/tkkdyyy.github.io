import * as T from 'three';
import {seatRock} from '../../visual-r3/rocks/placement.js';
export const REVISION='arrival-e-clear-one-shore-rock-1';
export function install(ctx){
 const {world,surface,hydrology,debug,signal}=ctx;signal?.throwIfAborted();
 const mesh=world.getObjectByName('fractured-shore-stones-0'),index=1;if(!mesh?.isInstancedMesh)throw Error('E target rock missing');
 const source=mesh.instanceMatrix,copy=source.clone(),matrix=new T.Matrix4().fromArray(source.array,index*16),before=matrix.toArray(),oldPosition=new T.Vector3().setFromMatrixPosition(matrix),oldUV=surface.uvFromDirection(oldPosition.toArray());
 if(Math.hypot(oldUV[0]+.121046,oldUV[1]-7.178473)>.08)throw Error('E only accepts final D2 rock anchor');
 const nextUV=[-.65,6.15],f=surface.frame(...nextUV);if(f.zones.wet||f.zones.pathDistance<.70)throw Error('E proposed rock anchor not clear dry shoulder');
 const position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3();matrix.decompose(position,rotation,scale);matrix.setPosition(new T.Vector3(...f.position));
 const seated=seatRock(matrix,mesh.geometry,surface,{embed:.035,align:true});if(seated.afterP90>.003||seated.visibleTop<.12)throw Error('E seating failed');
 const finalPosition=new T.Vector3().setFromMatrixPosition(matrix),finalUV=surface.uvFromDirection(finalPosition.toArray()),frame=surface.frame(...finalUV),plane=new T.Vector4(...frame.normal,new T.Vector3(...frame.normal).dot(new T.Vector3(...frame.position)));
 if(frame.zones.wet)throw Error('E seated rock root became wet');
 const groundIndex=debug.r6Ground.contacts.findIndex(c=>c.mesh===mesh.name&&c.index===index),waterIndex=debug.r8D.contacts.findIndex(c=>c.name===mesh.name&&c.instance===index);if(groundIndex<0||waterIndex<0)throw Error('E exact contact ownership missing');
 matrix.toArray(copy.array,index*16);const sphere=mesh.boundingSphere,box=mesh.boundingBox;mesh.instanceMatrix=copy;copy.needsUpdate=true;mesh.boundingSphere=null;mesh.boundingBox=null;mesh.computeBoundingSphere();mesh.computeBoundingBox();

 const points=mesh.geometry.attributes.position,us=[],vs=[],p=new T.Vector3();for(let i=0;i<points.count;i++){p.fromBufferAttribute(points,i).applyMatrix4(matrix);const uv=surface.uvFromDirection(p.toArray());us.push(uv[0]);vs.push(uv[1]);}
 const footprint=new T.Vector4((Math.min(...us)+Math.max(...us))/2,(Math.min(...vs)+Math.max(...vs))/2,(Math.max(...us)-Math.min(...us))/2,(Math.max(...vs)-Math.min(...vs))/2);
 const bindings=[],materials=[],compiles=[];let disposed=false;
 world.traverse(o=>{if(!o.isMesh||Array.isArray(o.material))return;const src=o.material;if(!src?.userData?.eGround&&o!==debug.r8D.mesh)return;const mat=src.clone(),compile=src.onBeforeCompile,key=src.customProgramCacheKey();if(Object.hasOwn(src,'onBeforeRender'))mat.onBeforeRender=src.onBeforeRender;if(src.userData.ecosystemWind)mat.userData.ecosystemWind=src.userData.ecosystemWind;
 mat.customProgramCacheKey=()=>key+'|'+REVISION+(o===mesh?'|target':'');mat.onBeforeCompile=(s,r)=>{compile.call(src,s,r);const changed=[];for(const name of ['bRockContacts','r6Footprints'])if(s.uniforms[name]?.value[groundIndex]){const values=s.uniforms[name].value.map(p=>p.clone());values[groundIndex].x=finalUV[0];values[groundIndex].y=finalUV[1];s.uniforms[name]={value:values};changed.push(name);}
 if(s.uniforms.r8Rocks?.value[waterIndex]){const values=s.uniforms.r8Rocks.value.map(p=>p.clone());values[waterIndex]=footprint.clone();s.uniforms.r8Rocks={value:values};changed.push('r8Rocks');}
 if(o===mesh&&s.uniforms.r6GroundPlane){const values=s.uniforms.r6GroundPlane.value.map(p=>p.clone());values[index]=plane.clone();s.uniforms.r6GroundPlane={value:values};changed.push('r6GroundPlane');}compiles.push({mesh:o.name,changed});};bindings.push({o,src,mat});materials.push(mat);o.material=mat;});
 const record={revision:REVISION,mesh:mesh.name,index,oldUV,newUV:finalUV,before,after:matrix.toArray(),scale:scale.toArray(),seated,groundIndex,waterIndex,groundPlane:plane.toArray(),waterFootprint:footprint.toArray(),newWet:frame.zones.wet,pathDistance:frame.zones.pathDistance,changedInstances:1,addedInstances:0};
 function dispose(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);for(const {o,src,mat}of bindings)if(o.material===mat)o.material=src;for(const mat of materials)mat.dispose();if(mesh.instanceMatrix===copy){mesh.dispose();mesh.instanceMatrix=source;mesh.boundingSphere=sphere;mesh.boundingBox=box;}ctx.invalidate?.();}
 signal?.addEventListener('abort',dispose,{once:true});ctx.invalidate?.();return {dispose,inspect:()=>({...record,disposed,compiles})};
}
