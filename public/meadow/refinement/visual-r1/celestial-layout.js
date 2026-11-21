import * as T from 'three';
import {PARAMETERS} from '../../modules/cosmic-background/config.js';
import {placeCelestials as originalPlacement} from '../celestial-layout.js';
export {celestialProjection} from '../celestial-layout.js';
// Original v7 artwork, fixed world anchors per responsive layout. No scroll binding.
export function placeCelestials(cosmic,mobile,enabled=true){
 originalPlacement(cosmic,mobile);if(!cosmic||!enabled)return;
 const {azimuth,elevation,origin}=PARAMETERS;
 const right=new T.Vector3(Math.cos(azimuth),0,-Math.sin(azimuth));
 const outward=new T.Vector3(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation));
 const up=new T.Vector3().crossVectors(outward,right);
 const p=mobile?{x:-2.8,y:9,depth:26,width:29}:{x:-9,y:-1.5,depth:26,width:38};
 const node=cosmic.exports.nodes.sun;
 node.position.set(...origin).addScaledVector(right,p.x).addScaledVector(up,p.y).addScaledVector(outward,-p.depth);
 node.scale.setScalar(p.width/node.geometry.parameters.width);
 cosmic.group.userData.celestialPlacement={revision:'visual-r1-fixed-sun',mobile,sun:p,moon:'original-v7'};
}
