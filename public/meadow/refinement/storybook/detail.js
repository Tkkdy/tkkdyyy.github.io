import * as T from 'three';
const views={flowers:[.65,4.2,5.6,.45,.50],garden:[-2.2,-.85,8,.55,.34],shore:[-.7,5.4,9,-.25,.63]};
export function setDetail(d,name,w,h){
 if(name==='foxglove'){
  const frame=d.surface.frame(.698331261985004,4.66117045711726);
  const root=new T.Vector3(...frame.position);root.y+=.30;
  const house=new T.Box3().setFromObject(d.assets.cottage).getCenter(new T.Vector3());
  const away=root.clone().sub(house);away.y=0;away.normalize();
  const right=new T.Vector3(away.z,0,-away.x),c=d.camera;
  c.position.copy(root).addScaledVector(away,w<h?3.5:2.83).addScaledVector(right,.24);
  c.position.y+=.88;root.y+=.62;
  d.world.rotation.set(0,0,0);c.up.set(0,1,0);c.lookAt(root);
  c.aspect=w/h;c.fov=w<h?59:52;c.near=.06;c.far=180;
  c.updateProjectionMatrix();d.view='detail:'+name;d.invalidate();return;
 }
 const [u,v,distance,az,el]=views[name],p=new T.Vector3(...d.surface.frame(u,v).position);
 d.world.rotation.set(0,0,0);
 p.y+=name==='garden'?.85:.14;
 const c=d.camera;
 c.position.copy(p).addScaledVector(new T.Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)),distance*(w/h<.8?1.48:1));
 c.up.set(0,1,0);c.lookAt(p);c.aspect=w/h;c.fov=40;c.near=.1;c.far=180;c.updateProjectionMatrix();d.view='detail:'+name;d.invalidate();
}
