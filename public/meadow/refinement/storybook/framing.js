import * as T from 'three';
import {installShoulder as installBroad} from '../arrival-study/coast/landing/shoulder.js';
import {installShoulder as installOriginal} from '../directed-lc/composition/shoulder.js';
import {placeCelestials as restoreCelestials} from '../visual-r1/celestial-layout.js';
import {applyPose, viewportBlend} from '../visual-r1/a-composition/rig.js';
import {journeyPose as originalJourney} from '../visual-r1/a-composition/journey.js';
import {applyReviewView} from '../visual-r4/review-views.js';
import {inspectDetail} from '../visual-r9/review-views.js';
export const REVISION='storybook-shore-camera';
const active=new WeakSet();
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(x)=>x*x*(3-2*x);
function corners(box){const result=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])result.push(new T.Vector3(x,y,z));return result;}
function projected(points,camera){camera.updateMatrixWorld(true);const p=points.map(v=>v.clone().project(camera));return {left:Math.min(...p.map(v=>(v.x+1)/2)),right:Math.max(...p.map(v=>(v.x+1)/2)),top:Math.min(...p.map(v=>(1-v.y)/2)),bottom:Math.max(...p.map(v=>(1-v.y)/2))};}
function travel(a,b,c,p){
 const h0=.55,h1=.45,d0=(b-a)/h0,d1=(c-b)/h1,w0=2*h1+h0,w1=h1+2*h0;
 const mid=d0*d1<=0?0:(w0+w1)/(w0/d0+w1/d1),first=p<=h0,span=first?h0:h1,t=(p-(first?0:h0))/span;
 const y0=first?a:b,y1=first?b:c,m0=first?0:mid,m1=first?mid:0;
 return (2*t**3-3*t*t+1)*y0+(t**3-2*t*t+t)*span*m0+(-2*t**3+3*t*t)*y1+(t**3-t*t)*span*m1;
}
export async function install(ctx){
 const {world,camera,assets,debug,signal,invalidate}=ctx;signal?.throwIfAborted();
 if(active.has(world))throw Error('C composition duplicate install');
 const saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),up:camera.up.clone(),fov:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far,rotation:world.rotation.clone()};
 world.updateMatrixWorld(true);
 const houseBox=new T.Box3().setFromObject(assets.cottage),treeBox=new T.Box3().setFromObject(assets.tree),centre=houseBox.getCenter(new T.Vector3());
 const housePoints=corners(houseBox),treePoints=corners(treeBox),previous=debug.compositionC;
 let disposed=false,current=null,api,skyRecord=null;
 const shoulder=ctx.baked ? await (await import('../arrival-study/bake/install.js')).installShoulder(ctx,{variant:'D'}) : await installBroad(ctx);
 const candidateContext={...ctx,surface:shoulder.surface,hydrology:shoulder.hydrology};
 function pose(name,width,height){
  const t=viewportBlend(width,height),close=name==='close';
  const distance=mix(close?35:42,close?12.7:19.0,t),azimuth=mix(.32,close?.35:.34,t),elevation=mix(.24,close?.17:.245,t),fov=mix(43,close?52:43,t);
  const out=new T.Vector3(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation)),right=new T.Vector3(Math.cos(azimuth),0,-Math.sin(azimuth)),up=new T.Vector3().crossVectors(out,right);
  const half=distance*Math.tan(T.MathUtils.degToRad(fov/2));
  const sx=mix(.48,close?.67:.74,t),sy=mix(.43,close?.46:.495,t);
  const target=centre.clone().addScaledVector(right,-(sx*2-1)*half*width/height).addScaledVector(up,-(1-sy*2)*half);
  const value={target:target.toArray(),distance,azimuth,elevation,fov,yaw:0};
  // Keep the complete protected blossom crown in frame using its measured box.
  // This is a lateral framing correction, never object scaling or asset edits.
  const temp=new T.PerspectiveCamera(fov,width/height,.1,180),dummy=new T.Group();applyPose(temp,dummy,value,width,height);
  const bounds=projected(treePoints,temp),overflow=Math.max(0,bounds.right-.975);
  if(overflow>0){target.addScaledVector(right,overflow*2*half*width/height);value.target=target.toArray();}
  return value;
 }
 let skySize="";
 function sky(width,height){
  if(skySize===width+"x"+height)return;
  skySize=width+"x"+height;
  const nodes=ctx.cosmic?.exports?.nodes;if(!nodes)return;
  const p=pose('default',width,height),c=new T.PerspectiveCamera(p.fov,width/height,.1,180);applyPose(c,new T.Group(),p,width,height);c.updateMatrixWorld(true);
  const n=c.position.clone().normalize(),d=c.position.length(),radius=12.45;
  const right=new T.Vector3(1,0,0).applyQuaternion(c.quaternion);right.addScaledVector(n,-right.dot(n)).normalize();
  const up=new T.Vector3().crossVectors(n,right).normalize(),side=right.clone().multiplyScalar(Math.cos(115*Math.PI/180)).addScaledVector(up,Math.sin(115*Math.PI/180));
  const tangent=n.clone().multiplyScalar(radius*radius/d).addScaledVector(side,radius*Math.sqrt(1-radius*radius/(d*d))*1.015);
  const ndc=tangent.project(c),mobile=width/height<.8;
  function at(node,x,y,distance){const ray=new T.Vector3(x,y,.5).unproject(c).sub(c.position).normalize();node.position.copy(c.position).addScaledVector(ray,distance);ctx.cosmic.group.worldToLocal(node.position);}
  // Project the baked terrain and water once per viewport to place the disc just
  // above the actual shoreline silhouette. Reuse that world anchor through travel.
  const sunX=mobile?ndc.x:-.115;
  if(!mobile){
   const sample=new T.Vector3(),local=new T.Matrix4(),inverse=world.matrixWorld.clone().invert();
   let high=-Infinity;
   for(const layer of [ctx.terrain.group,ctx.water.group])layer.traverse(mesh=>{
    if(!mesh.isMesh||mesh.isInstancedMesh)return;
    local.multiplyMatrices(inverse,mesh.matrixWorld);
    const a=mesh.geometry.attributes.position;
    for(let i=0;i<a.count;i+=2){sample.fromBufferAttribute(a,i).applyMatrix4(local).project(c);
     if(Math.abs(sample.x-sunX)<.009&&sample.z<1&&sample.z>-1)high=Math.max(high,sample.y);}
   });
   if(Number.isFinite(high)){ndc.x=sunX;ndc.y=high+.036;}
  }
  at(nodes.sun,ndc.x,ndc.y,72);at(nodes.moon,mobile?.63:.76,mobile?.67:.72,60);
  skyRecord={kind:'fixed world sun and moon anchors',sunTangentNDC:[ndc.x,ndc.y],sun:nodes.sun.position.toArray(),moon:nodes.moon.position.toArray()};
 }
 function metrics(){
  world.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const h=projected(corners(new T.Box3().setFromObject(assets.cottage)),camera),tree=projected(corners(new T.Box3().setFromObject(assets.tree)),camera);
  return {house:h,tree,houseWidth:h.right-h.left,houseHeight:h.bottom-h.top,position:camera.position.toArray(),fov:camera.fov,aspect:camera.aspect};
 }
 function view(name,width,height){
  if(disposed)return;
  if(['default','close','rotate'].includes(name)){
   const p=pose(name==='rotate'?'default':name,width,height);if(name==='rotate')p.yaw=Math.PI/2;applyPose(camera,world,p,width,height);current={view:name,pose:p};
  }else if(['ground','bay','river','auxiliary','trunk','windows','tree'].includes(name)){
   camera.aspect=width/height;inspectDetail({...debug,...candidateContext},name,width,height);current={view:name,baselineInspection:true};
  }else{
   applyReviewView(camera,world,name,ctx.surface,width,height);current={view:name,baselineInspection:true};
  }
  sky(width,height);invalidate?.();return current;
 }
 function journey(progress,width,height){
  if(disposed)return;
  const p=T.MathUtils.clamp(progress,0,1),far=originalJourney(0,width,height),arrival=pose('default',width,height),close=pose('close',width,height),value={target:far.target.map((v,i)=>travel(v,arrival.target[i],close.target[i],p)),yaw:0};
  for(const key of ['distance','azimuth','elevation','fov'])value[key]=travel(far[key],arrival[key],close[key],p);
  applyPose(camera,world,value,width,height);current={view:'journey',progress:p,pose:value};sky(width,height);invalidate?.();return current;
 }
 function dispose(){
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);shoulder.dispose();restoreCelestials(ctx.cosmic,camera.aspect<.8,true);
  camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);camera.up.copy(saved.up);for(const k of ['fov','aspect','near','far'])camera[k]=saved[k];camera.updateProjectionMatrix();world.rotation.copy(saved.rotation);
  if(debug.compositionC===api){if(previous===undefined)delete debug.compositionC;else debug.compositionC=previous;}
  active.delete(world);invalidate?.();
 }
 api={surface:shoulder.surface,hydrology:shoulder.hydrology,applyView:view,applyJourney:journey,dispose,inspect:()=>({revision:REVISION,disposed,current,measurements:metrics(),sky:skyRecord,shoulder:shoulder.inspect(),changed:['camera target measured from house bounds','azimuth','elevation','distance','fov','continuous journey interpolation','same-topology local land shoulder and matching water/anchors','fixed sun/moon layout calibration'],preserved:['house/tree matrices and scale','water mesh count/index topology and shader text','vegetation count','lights','material colors/BRDF/light semantics','sky artwork'],limitations:'The close journey uses a wider lens to bring the path into the foreground. The protected crown constrains lateral framing.'})};
 active.add(world);debug.compositionC=api;signal?.addEventListener('abort',dispose,{once:true});return api;
}
