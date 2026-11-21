import * as T from 'three';
export const REFERENCE={radius:12,seed:4141,exposure:1.05,near:.1,far:100,
 default:{target:[-5.3,9,0],distance:36,fov:41,yaw:0,elevation:.38},
 close:{target:[-1,13,0],distance:22,fov:41,yaw:0,elevation:.38},
 rotate:{target:[-5.3,9,0],distance:36,fov:41,yaw:.75,elevation:.38}};
export function applyView(camera,world,name,width,height){
 const v=REFERENCE[name]; if(!v)throw Error('Unknown reference view');
 const mobile=width<650, target=new T.Vector3(...(mobile&&name!=='close'?[0,9,0]:v.target));
 const distance=mobile&&name!=='close'?46:v.distance;
 world.rotation.set(0,v.yaw,0);camera.position.copy(target).add(new T.Vector3(
 Math.sin(.32)*Math.cos(v.elevation),Math.sin(v.elevation),Math.cos(.32)*Math.cos(v.elevation)).multiplyScalar(distance));
 camera.lookAt(target);camera.aspect=width/height;camera.fov=mobile?43:v.fov;camera.updateProjectionMatrix();
}
export function addLights(world){
 world.add(new T.HemisphereLight('#b8c4df','#525b65',1.6));
 const key=new T.DirectionalLight('#ffdbb7',2);key.position.set(-9,24,12);key.target.position.set(0,7,0);
 key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-17,right:17,top:17,bottom:-17,near:1,far:65});
 Object.assign(key.shadow,{bias:-.00015,normalBias:.035,radius:3,intensity:.48});world.add(key,key.target);
 const fill=new T.DirectionalLight('#a3b9e3',.65);fill.position.set(6,15,-10);world.add(fill);
}
