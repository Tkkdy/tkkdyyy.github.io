import * as T from 'three';
import {PARAMETERS} from '../modules/cosmic-background/config.js';
// Host placement only. Existing v7 meshes, shaders and textures stay intact.
// Desktop retains original v7 placement. Mobile sun alone rises from y=3.8 to 13
// to clear the planet in the default reference view; original low-altitude x/depth remain.
// Anchors are fixed world points throughout the journey; no per-frame screen lock.
export function placeCelestials(cosmic,mobile){
 if(!cosmic)return;
 const {azimuth,elevation,origin}=PARAMETERS,right=new T.Vector3(Math.cos(azimuth),0,-Math.sin(azimuth)),outward=new T.Vector3(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation)),up=new T.Vector3().crossVectors(outward,right);
 const layout=mobile?{sun:{x:-2.8,y:13,depth:26,width:29},moon:{x:10.8,y:17,depth:22,width:4.4}}:{sun:{x:-9,y:-4,depth:26,width:38},moon:{x:18.2,y:14.7,depth:22,width:4.8}};
 for(const [id,p]of Object.entries(layout)){const node=cosmic.exports.nodes[id];node.position.set(...origin).addScaledVector(right,p.x).addScaledVector(up,p.y).addScaledVector(outward,-p.depth);node.scale.setScalar(p.width/node.geometry.parameters.width);}
 cosmic.group.userData.celestialPlacement={revision:'retained-v7-host-placement-1',mobile,layout};
}
export function celestialProjection(cosmic,camera,width,height){
 cosmic.group.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 return Object.fromEntries(['sun','moon'].map(id=>{const n=cosmic.exports.nodes[id],p=new T.Vector3().setFromMatrixPosition(n.matrixWorld).project(camera),edge=new T.Vector3(n.geometry.parameters.width*(id==='sun'?.025:.39),0,0).applyMatrix4(n.matrixWorld).project(camera);return [id,{visible:n.visible,inFrustum:Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1,x:(p.x+1)*width/2,y:(1-p.y)*height/2,coreDiameterPx:Math.abs(edge.x-p.x)*width,texture:n.material.uniforms.uMap.value.image.currentSrc,world:n.position.toArray()}]}));
}
