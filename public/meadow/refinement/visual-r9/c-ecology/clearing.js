import * as T from 'three';
import {clearance,rockObstacles,random} from './layout.js';
export function clearingLayout(ctx,mesh){
 const copy=mesh.instanceMatrix.clone(),matrix=new T.Matrix4(),rotation=new T.Matrix4(),pos=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3(),records=[],rng=random(86631),rocks=rockObstacles(ctx),occupied=[];
 const beds=[{u:-4.53,v:1.06,rx:.29,rz:.14,n:12},{u:-1.05,v:.90,rx:.26,rz:.19,n:10}];
 const candidates=[];for(let i=0;i<mesh.count;i++){matrix.fromArray(copy.array,i*16);matrix.decompose(pos,q,scale);const uv=ctx.surface.uvFromDirection(pos.toArray());if(uv[0]<-1.7&&uv[0]>-7.8&&uv[1]>-.2&&uv[1]<4)candidates.push({i,u:uv[0],v:uv[1],scale:scale.x});}
 let k=0;const p=mesh.geometry.attributes.position;let horizontal=0,height=0;for(let i=0;i<p.count;i++){horizontal=Math.max(horizontal,Math.hypot(p.getX(i),p.getZ(i)));height=Math.max(height,p.getY(i));}
 for(const bed of beds){let n=0;for(let attempt=0;n<bed.n&&attempt<bed.n*14&&k<candidates.length;attempt++){
  const a=rng()*Math.PI*2,r=Math.sqrt(rng()),u=bed.u+Math.cos(a)*r*bed.rx,v=bed.v+Math.sin(a)*r*bed.rz,source=candidates[k],size=source.scale*(.36+rng()*.12),frame=ctx.surface.frame(u,v),cos=frame.normal.reduce((n,x,i)=>n+x*frame.direction[i],0),footprint=size*(horizontal+height*Math.sqrt(Math.max(0,1-cos*cos)))+.035;
  if(occupied.some(p=>Math.hypot(p.u-u,p.v-v)<.105)||rocks.some(p=>Math.hypot(p.u-u,p.v-v)<p.footprint+footprint*.55)||!clearance(ctx,u,v,footprint,false,frame))continue;
  const vec=a=>new T.Vector3(...a),position=vec(frame.position).addScaledVector(vec(frame.normal),-.025*size);
  matrix.makeBasis(vec(frame.east),vec(frame.normal),vec(frame.south)).setPosition(position).multiply(rotation.makeRotationY(rng()*Math.PI*2)).scale(new T.Vector3(size,size,size));copy.array.set(matrix.elements,source.i*16);occupied.push({u,v});records.push({i:source.i,u,v,oldU:source.u,oldV:source.v,size,footprint,zone:'left-lawn'});k++;n++;
 }}copy.needsUpdate=true;return {copy,records};
}
