import * as T from 'three';
// Fixed R6 inspection anchors keep comparisons honest when R7 changes terrain height.
const BASELINE_TARGETS={"bay":[-4.22974517889646,8.948330027456736,4.22974517889646],"river":[3.2328418328131887,11.793596419210509,1.2123156873049457],"ground":[3.742212370746953,10.528370423053792,4.413891514214354],"auxiliary":[-6.27355842607243,11.964788045255336,-3.194416914574173]};
export function inspectDetail(d,name,width,height){
 const points={bay:{uv:[-5,5],offset:[2,4.6,7.4],fov:40},river:{uv:[3.2,1.2],offset:[4,4.8,7.6],fov:39},ground:{uv:[3.9,4.6],offset:[2.9,3.1,5.6],fov:38},auxiliary:{offset:[2.2,1.8,6.4],fov:39}};
 d.world.rotation.set(0,0,0);d.world.updateMatrixWorld(true);
 let target,offset,fov=39;
 if(points[name]){const p=points[name];target=new T.Vector3(...BASELINE_TARGETS[name]);offset=new T.Vector3(...p.offset);fov=p.fov;}
 else if(name==='trunk'){target=d.assets.tree.localToWorld(new T.Vector3(0,1.15,0));offset=new T.Vector3(.4,.24,.90).normalize().multiplyScalar(5.4);}
 else if(name==='windows'){target=d.assets.cottage.localToWorld(new T.Vector3(.1,1.0,1.65));offset=new T.Vector3(.32,.15,.93).normalize().multiplyScalar(4.9);}
 else if(name==='tree'){target=d.assets.tree.getWorldPosition(new T.Vector3()).add(new T.Vector3(.2,2.35,0));offset=new T.Vector3(.40,.24,.90).normalize().multiplyScalar(width<650?14.58:10.8);}
 else throw Error('Unknown R7 inspection: '+name);
 const c=d.camera;c.position.copy(target).add(offset.multiplyScalar(name!=='tree'&&width/height<.8?1.35:1));c.up.set(0,1,0);c.fov=fov;c.near=.1;c.far=180;c.aspect=width/height;c.lookAt(target);c.updateProjectionMatrix();d.invalidate();
}
