import * as T from 'three';

const quantile=(values,q)=>{const a=[...values].sort((a,b)=>a-b);return a[Math.floor((a.length-1)*q)]};
export function supportPoints(geometry){
 const p=geometry.attributes.position,box=geometry.boundingBox??(geometry.computeBoundingBox(),geometry.boundingBox);
 const cut=box.min.y+(box.max.y-box.min.y)*.27,all=[];
 for(let i=0;i<p.count;i++)if(p.getY(i)<cut)all.push(new T.Vector3().fromBufferAttribute(p,i));
 const stride=Math.max(1,Math.floor(all.length/64));return all.filter((_,i)=>i%stride===0);
}
export function contactGaps(points,matrix,surface){
 return points.map(p=>{
  const q=p.clone().applyMatrix4(matrix),uv=surface.uvFromDirection(q.toArray()),s=surface.sample(...uv);
  return q.length()-surface.radius-s.height;
 });
}
export function seatRock(matrix,geometry,surface,{embed=.025,align=true,points=supportPoints(geometry),diagnostics=true}={}){
 const position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3();matrix.decompose(position,rotation,scale);
 const uv=surface.uvFromDirection(position.toArray()),frame=surface.frame(...uv),radial=new T.Vector3(...surface.directionFromUV(...uv));
 if(align){
  const previousUp=new T.Vector3(0,1,0).applyQuaternion(rotation);
  rotation.premultiply(new T.Quaternion().setFromUnitVectors(previousUp,new T.Vector3(...frame.normal)));
  matrix.compose(position,rotation,scale);
 }
 const before=contactGaps(points,matrix,surface),origin=position.clone();
 let gaps=before;
 for(let step=0;step<5;step++){
  const adjust=-quantile(gaps,.90)-embed;
  if(Math.abs(adjust)<.002)break;
  position.addScaledVector(radial,adjust);matrix.setPosition(position);
  gaps=contactGaps(points,matrix,surface);
 }
 const after=gaps,p=geometry.attributes.position;
 let visibleTop=-Infinity;
 if(diagnostics)for(let i=0;i<p.count;i+=4){const q=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix),chart=surface.uvFromDirection(q.toArray());visibleTop=Math.max(visibleTop,q.length()-surface.radius-surface.sample(...chart).height)}
 return {u:uv[0],v:uv[1],supportSamples:points.length,beforeP90:quantile(before,.90),afterP90:quantile(after,.90),
  maxBaseGap:Math.max(...after),minBaseGap:Math.min(...after),visibleTop:diagnostics?visibleTop:null,radialShift:position.clone().sub(origin).dot(radial)};
}
