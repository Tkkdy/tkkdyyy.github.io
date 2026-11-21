import * as T from 'three';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const plane=(x,y,z,d)=>{const n=new T.Vector3(x,y,z),l=n.length();return {n:n.divideScalar(l),d:d/l};};
function intersections(planes){
 const vertices=[],seen=new Set();
 for(let a=0;a<planes.length-2;a++)for(let b=a+1;b<planes.length-1;b++)for(let c=b+1;c<planes.length;c++){
  const A=planes[a],B=planes[b],C=planes[c],cross=new T.Vector3().crossVectors(B.n,C.n),det=A.n.dot(cross);
  if(Math.abs(det)<1e-7)continue;
  const p=cross.multiplyScalar(A.d)
   .addScaledVector(new T.Vector3().crossVectors(C.n,A.n),B.d)
   .addScaledVector(new T.Vector3().crossVectors(A.n,B.n),C.d).divideScalar(det);
  if(planes.some(q=>q.n.dot(p)>q.d+1e-6))continue;
  const key=p.toArray().map(v=>Math.round(v*1e5)).join(',');
  if(!seen.has(key)){seen.add(key);vertices.push(p);}
 }
 return vertices;
}
function bevel(planes,width){
 const vertices=intersections(planes),extras=[];
 for(let a=0;a<planes.length-1;a++)for(let b=a+1;b<planes.length;b++){
  const A=planes[a],B=planes[b];
  const common=vertices.filter(v=>Math.abs(A.n.dot(v)-A.d)<1e-5&&Math.abs(B.n.dot(v)-B.d)<1e-5);
  if(common.length<2)continue;
  const n=A.n.clone().add(B.n),l=n.length();
  if(l<.15)continue;
  extras.push({n:n.divideScalar(l),d:(A.d+B.d)/l-width});
 }
 return intersections([...planes,...extras]);
}
function basePlanes(variant){
 const sides=variant===4?5:7,p=[];
 for(let i=0;i<sides;i++){
  const a=i*Math.PI*2/sides+.16*variant;
  p.push(plane(Math.cos(a),.08*Math.sin(i*2.7+variant),Math.sin(a),.78+.10*Math.sin(i*2.4+variant)));
 }
 p.push(plane(.15+variant*.035,1,-.1,.63),plane(-.09,-1,.08,.57));
 // Asymmetric split faces and sloping shoulders, not a displaced sphere.
 p.push(plane(.7,.85,.2,.98),plane(-.65,.75,-.3,.93),plane(.25,.65,-.85,1.02));
 return p;
}
function fragment(planes,variant,bevelWidth,transform){
 const g=new ConvexGeometry(variant===4?intersections(planes):bevel(planes,bevelWidth));
 if(transform)g.applyMatrix4(transform);
 if(variant<3){
  const a=g.attributes.position;
  for(let i=0;i<a.count;i++){
   const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
   a.setXYZ(i,x+.025*Math.sin(y*7+z*3+variant),
    y+.023*Math.sin(x*5-z*4+variant),z+.018*Math.sin(y*5+x*3));
  }
  // Duplicated face vertices receive identical displacement; facets stay closed.
  g.computeVertexNormals();
 }
 const p=g.attributes.position,n=g.attributes.normal,colors=[];
 const dark=new T.Color(variant===4?'#9f947e':'#626c70');
 const light=new T.Color(variant===4?'#c5b9a5':'#b3b5ab'),c=new T.Color();
 for(let i=0;i<p.count;i++){
  // Broad planar values are carried by actual face normals, not painted fracture lines.
  const lit=T.MathUtils.clamp(.42+n.getY(i)*.29-n.getX(i)*.13+n.getZ(i)*.06,0,1);
  c.copy(dark).lerp(light,lit);
  c.multiplyScalar(.97+.035*Math.sin(p.getX(i)*3+p.getZ(i)*2+variant));
  colors.push(c.r,c.g,c.b);
 }
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 return g;
}

export function rockGeometry(variant){
 const base=basePlanes(variant),parts=[];
 if(variant===0){
  // Two complementary fracture faces, separated by an actual irregular opening.
  parts.push(fragment([...base,plane(1,.16,.28,.06)],variant,.025));
  parts.push(fragment([...base,plane(-1,-.16,-.28,-.13)],variant,.022,
   new T.Matrix4().makeRotationZ(-.035)));
 }else if(variant===1){
  // Broken ledge: a broad base and a shifted, smaller cap with a visible overhang.
  parts.push(fragment([...base,plane(.12,1,.05,.05)],variant,.035));
  const top=base.map(p=>({n:p.n.clone(),d:p.d}));
  top.push(plane(-.12,-1,-.05,-.07),plane(-1,0,.2,.57),plane(.2,0,1,.63));
  parts.push(fragment(top,variant,.025,new T.Matrix4().makeTranslation(.045,0,-.025)));
 }else{
  parts.push(fragment(base,variant,variant>=3?.065:.045));
 }
 const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());
 // Preserve planar face normals and narrow geometric bevels; never average into a blob.
 g.computeBoundingSphere();g.userData={variant,fragments:parts.length,realFracture:variant<2};
 return g;
}
