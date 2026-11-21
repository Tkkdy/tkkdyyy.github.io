import * as T from 'three';
import {edgeHalfWidth} from './field.js';
import {pathLine,nearest} from '../../provider.js';
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function createDetails(ctx){
 const rng=random(77311),records=[],surface=ctx.surface;
 for(let attempt=0;records.length<34&&attempt<12000;attempt++){
  const u=-2.9+rng()*4.1,v=-.85+rng()*3.15;
  if(Math.sin(u*4.8+v*2.1)<.25||Math.sin(v*5.6-u*.8)<-.3)continue;
  const d=nearest(pathLine,u,v).distance,edge=edgeHalfWidth(u,v);if(d>edge-.015||d<.13)continue;
  const s=surface.sample(u,v);if(Math.abs(d-s.zones.pathDistance)>1e-9)throw Error("R7 B path contract differs from final provider");
  if(s.zones.wet||s.zones.protectedHouse||s.height<ctx.hydrology.seaLevel+.13||d>edge-.015||d<.13||Math.sin(u*4.8+v*2.1)<.25||Math.sin(v*5.6-u*.8)<-.3)continue;
  const radius=.009+rng()*.013;
  if(records.some(r=>Math.hypot(r.u-u,r.v-v)<radius+r.radius+.055))continue;
  records.push({u,v,radius,heading:rng()*Math.PI*2,height:.004+rng()*.005,scaleZ:.62+rng()*.40});
 }
 const geometry=new T.IcosahedronGeometry(1,1),p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=1+.08*Math.sin(x*7.3+z*5.1+y*3.7);p.setXYZ(i,x*n,y*n,z*n);}geometry.computeVertexNormals();
 const material=new T.MeshStandardMaterial({color:'#ffffff',roughness:.94,metalness:0});
 const mesh=new T.InstancedMesh(geometry,material,records.length);mesh.name='R7 B / embedded path-edge grains';mesh.receiveShadow=true;mesh.castShadow=true;
 const matrix=new T.Matrix4(),turn=new T.Matrix4(),scale=new T.Matrix4(),color=new T.Color();
 for(let i=0;i<records.length;i++){const r=records[i],f=surface.frame(r.u,r.v),normal=new T.Vector3(...f.normal);
  matrix.makeBasis(new T.Vector3(...f.east),normal,new T.Vector3(...f.south)).setPosition(new T.Vector3(...f.position).addScaledVector(normal,-.001)).multiply(turn.makeRotationY(r.heading)).multiply(scale.makeScale(r.radius,r.height,r.radius*r.scaleZ));
  mesh.setMatrixAt(i,matrix);color.set(i%4===0?'#a6a094':i%4===1?'#b8a58f':i%4===2?'#c2b49f':'#aaa593');mesh.setColorAt(i,color);
 }
 mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();ctx.world.add(mesh);let disposed=false;
 return {mesh,records,dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();mesh.dispose();geometry.dispose();material.dispose();}};
}
