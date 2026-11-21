import * as T from 'three';
import {applyView} from '../visual-r1/a-composition/rig.js';
// All targets come from the preserved r5 reference surface: identical cameras
// compare changed silhouettes instead of following the candidate geometry.
export function applyReviewView(camera,world,name,surface,width,height){
 if(['default','close','rotate'].includes(name))return applyView(camera,world,name,width,height);
 const presets={mouth:{uv:[-1,3.6],offset:[2.8,5.3,8.3],fov:40},shoreline:{uv:[-6.2,4],offset:[-3.6,4.2,6.8],fov:39},rocks:{uv:[-2.8,1.92],offset:[2.2,2.5,5.5],fov:37},house:{uv:[-1.9,-.45],offset:[2.4,3.1,6.4],fov:39}};
 const p=presets[name];if(!p)throw Error('Unknown R3 review view: '+name);
 const f=surface.frame(...p.uv),target=new T.Vector3(...f.position).addScaledVector(new T.Vector3(...f.normal),.12);
 camera.position.copy(target).add(new T.Vector3(...p.offset).multiplyScalar(width/height<.8?1.35:1));
 camera.up.set(0,1,0);camera.lookAt(target);camera.aspect=width/height;camera.fov=p.fov;camera.near=.1;camera.far=180;camera.updateProjectionMatrix();world.rotation.set(0,0,0);
}
