import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {AUXILIARY_TREE as L} from './layout.js';
// An independent small leafy companion: no protected tree geometry, material or texture is cloned.
export function createAuxiliaryTree(surface){
 let seed=715731;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const group=new T.Group();group.name='R7 quiet orchard tree';const pieces=[],tips=[];let maxSeamPositionError=0,maxSeamNormalError=0;
 const v=a=>new T.Vector3(...a);
 function branch(points,radius,endRadius,steps=16){
  const curve=new T.CatmullRomCurve3(points.map(v)),radial=20,g=new T.TubeGeometry(curve,steps,1,radial,false),p=g.attributes.position,n=g.attributes.normal,colors=[];
  const length=curve.getLength();
  // Analytic tapered-cylinder normals preserve the duplicated radial seam. Face averaging on
  // the former seven-sided tube made the small branch read as a sharply folded triangular rod.
  for(let i=0;i<=steps;i++){
   const t=i/steps,center=curve.getPointAt(t),tangent=curve.getTangentAt(t),r=radius+(endRadius-radius)*Math.pow(t,.88),slope=(endRadius-radius)*.88*Math.pow(Math.max(t,.025),-.12)/length;
   for(let j=0;j<=radial;j++){
    const index=i*(radial+1)+j,radialNormal=new T.Vector3().fromBufferAttribute(n,index),angle=j/radial*Math.PI*2;
    const organic=1+.028*Math.sin(angle*3+t*4.1)+.018*Math.sin(angle*5-t*6.5);
    const q=radialNormal.clone().multiplyScalar(r*organic).add(center);p.setXYZ(index,q.x,q.y,q.z);
    const normal=radialNormal.addScaledVector(tangent,-slope).normalize();n.setXYZ(index,normal.x,normal.y,normal.z);
    const pigment=.87+.09*Math.sin(angle*3+Math.sin(t*7))+.035*Math.sin(angle*9-t*19);colors.push(pigment,pigment*.985,pigment*.96);
   }
  }
  for(let i=0;i<=steps;i++){const a=i*(radial+1),b=a+radial;maxSeamPositionError=Math.max(maxSeamPositionError,new T.Vector3().fromBufferAttribute(p,a).distanceTo(new T.Vector3().fromBufferAttribute(p,b)));maxSeamNormalError=Math.max(maxSeamNormalError,new T.Vector3().fromBufferAttribute(n,a).distanceTo(new T.Vector3().fromBufferAttribute(n,b)));}
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));pieces.push(g);
 }
 branch([[0,-.075,0],[.055,.40,.035],[-.12,.98,.015],[-.20,1.53,.035],[-.03,2.12,-.08]],.19,.030,32);
 const limbs=[
  [[-.04,.74,.01],[-.36,1.01,.06],[-.67,1.37,.19],[-.84,1.96,.27]],
  [[-.12,1.02,.02],[.18,1.27,.12],[.65,1.53,.22],[.86,2.03,.24]],
  [[-.16,1.23,.03],[-.32,1.52,-.22],[-.61,1.84,-.52],[-.64,2.25,-.50]],
  [[-.19,1.45,.03],[.08,1.76,-.14],[.37,2.02,-.46],[.42,2.40,-.38]],
  [[-.16,1.7,.0],[-.19,1.98,.19],[-.43,2.25,.41],[-.45,2.48,.42]],
  [[-.18,1.35,.04],[.03,1.50,.37],[.11,1.88,.64],[.35,2.12,.72]],
 ];
 for(const [i,points]of limbs.entries()){
  branch(points,.079-i*.004,.012,22);tips.push(v(points.at(-1)));
  const root=v(points[2]),tip=v(points[3]);
  for(let j=0;j<2;j++){const q=root.clone().lerp(tip,.35+j*.3),end=q.clone().add(new T.Vector3((j?1:-1)*(.18+random()*.14),.13+random()*.17,(random()-.5)*.40));branch([root.toArray(),q.toArray(),end.toArray()],.014,.003,6);tips.push(end);}
 }
 tips.push(new T.Vector3(.03,2.2,-.08));
 for(let i=0;i<5;i++){const a=i*Math.PI*.4+.2,len=.25+random()*.15;branch([[0,.13,0],[Math.cos(a)*len*.5,.015,Math.sin(a)*len*.5],[Math.cos(a)*len,-.065,Math.sin(a)*len]],.065,.009,7);}
 const barkGeometry=mergeGeometries(pieces);for(const g of pieces)g.dispose();
 const barkMaterial=new T.MeshStandardMaterial({color:'#847664',roughness:.96,vertexColors:true});
 const wood=new T.Mesh(barkGeometry,barkMaterial);wood.name='R7 auxiliary branching wood';wood.castShadow=true;wood.receiveShadow=true;group.add(wood);
 // Rounded oval leaflets with a small central curve: no spiky triangular silhouette.
 const leafGeometry=new T.BufferGeometry(),lp=[0,.5,.035],li=[];
 for(let j=0;j<16;j++){const angle=j/16*Math.PI*2,y=.5-Math.cos(angle)*.5,x=Math.sin(angle)*.31*(.94+.06*Math.sin(angle));lp.push(x,y,.018*Math.sin(Math.PI*y));}
 for(let j=0;j<16;j++)li.push(0,j+1,(j+1)%16+1);
 leafGeometry.setAttribute('position',new T.Float32BufferAttribute(lp,3));leafGeometry.setIndex(li);leafGeometry.computeVertexNormals();
 const leafMaterial=new T.MeshStandardMaterial({color:'#b3c2bb',roughness:1,metalness:0,side:T.DoubleSide});
 const count=tips.length*90,leaves=new T.InstancedMesh(leafGeometry,leafMaterial,count),dummy=new T.Object3D(),color=new T.Color();leaves.name='R7 auxiliary individual leaves';let i=0,measuredCanopyRadius=0,measuredHeight=0;const point=new T.Vector3();
 for(const [cluster,tip]of tips.entries())for(let j=0;j<90;j++){
  const a=random()*Math.PI*2,z=random()*2-1,r=Math.pow(random(),.42),rad=Math.sqrt(1-z*z)*r;
  const spread=.24+.06*Math.sin(cluster*2.1);dummy.position.copy(tip).add(new T.Vector3(Math.cos(a)*rad*spread,z*r*.24,Math.sin(a)*rad*spread));
  dummy.rotation.set(random()*Math.PI,(random()-.5)*Math.PI*2,random()*Math.PI*2);const size=.115+random()*.075;dummy.scale.set(size*(.85+random()*.4),size,size);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);for(let k=0;k<leafGeometry.attributes.position.count;k++){point.fromBufferAttribute(leafGeometry.attributes.position,k).applyMatrix4(dummy.matrix);measuredCanopyRadius=Math.max(measuredCanopyRadius,Math.hypot(point.x,point.z));measuredHeight=Math.max(measuredHeight,point.y);}
  color.setHSL(.38+random()*.045,.12+random()*.10,.30+random()*.14);leaves.setColorAt(i++,color);
 }
 leaves.instanceMatrix.needsUpdate=true;leaves.instanceColor.needsUpdate=true;leaves.castShadow=true;leaves.receiveShadow=true;group.add(leaves);
 const frame=surface.frame(L.u,L.v),basis=new T.Matrix4().makeBasis(new T.Vector3(...frame.east),new T.Vector3(...frame.normal),new T.Vector3(...frame.south));group.quaternion.setFromRotationMatrix(basis);group.position.set(...frame.position);group.updateMatrixWorld(true);
 let disposed=false;return {group,info:{...L,canopyRadius:Math.max(L.canopyRadius,measuredCanopyRadius),height:measuredHeight,measuredCanopyRadius,maxSeamPositionError,maxSeamNormalError,rootHeight:frame.height,geometryTriangles:barkGeometry.index.count/3+leafGeometry.index.count/3*count,leafInstances:count,drawCalls:2,windOwners:0},dispose(){if(disposed)return;disposed=true;group.removeFromParent();leaves.dispose();for(const g of [barkGeometry,leafGeometry])g.dispose();for(const m of [barkMaterial,leafMaterial])m.dispose();}};
}
