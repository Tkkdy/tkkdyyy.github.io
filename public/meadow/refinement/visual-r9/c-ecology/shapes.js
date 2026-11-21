import * as T from 'three';
const color=s=>new T.Color(s).toArray(),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),add=(a,b)=>a.map((v,i)=>v+b[i]);
const rotate=(p,a)=>[p[0]*Math.cos(a)+p[2]*Math.sin(a),p[1],-p[0]*Math.sin(a)+p[2]*Math.cos(a)];
class Shape {
 constructor(){this.p=[];this.c=[];}
 tri(a,b,c,ca,cb=ca,cc=ca){this.p.push(...a,...b,...c);this.c.push(...ca,...cb,...cc);}
 quad(a,b,c,d,ca,cb=ca,cc=ca,cd=ca){this.tri(a,b,d,ca,cb,cd);this.tri(b,c,d,cb,cc,cd);}
 finish(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));g.setAttribute('color',new T.Float32BufferAttribute(this.c,3));g.computeVertexNormals();const p=g.attributes.position,n=g.attributes.normal,groups=new Map();for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}for(const ids of groups.values()){const v=new T.Vector3();for(const i of ids)v.add(new T.Vector3().fromBufferAttribute(n,i));v.normalize();for(const i of ids)n.setXYZ(i,v.x,v.y,v.z);}g.computeBoundingBox();g.computeBoundingSphere();return g;}
}
export function grassGeometry(simple=false){
 const b=new Shape(),root=color('#3f5948'),body=color('#81996b'),tip=color('#b3b887'),count=simple?4:8,steps=simple?5:7;
 for(let i=0;i<count;i++){
  const a=i*2.399,h=.20+(i%5)*.058,w=(.018+(i%3)*.008)*.82,bend=(.17+(i%4)*.055)*.94;
  const at=(t,side)=>rotate([side*w*Math.pow(Math.sin(Math.PI*t),.72)+.029*Math.sin(t*2.4+i)*t,h*t-.11*t*t-.009*Math.abs(side)*Math.sin(Math.PI*t),bend*t*t],a);
  for(let j=0;j<steps;j++){const t=j/steps,s=(j+1)/steps,c0=mix(root,body,t),c1=mix(body,tip,.18*s);b.quad(at(t,-1),at(s,-1),at(s,1),at(t,1),c0,c1,c1,c0);}
 }return b.finish();
}
export function fernGeometry(simple=false){
 const b=new Shape(),dark=color('#386450'),mid=color('#709b70'),light=color('#94a880');
 const fronds=simple?4:6,pairs=simple?6:10;
 for(let f=0;f<fronds;f++){
  const angle=f*2.399+.1*Math.sin(f),length=.62+(f%3)*.11,spread=.42+(f%2)*.12;
  const at=(t,x=0,lift=0)=>rotate([x,length*Math.sin(t*1.42)-.12*t*t+lift,spread*t*t],angle);
  for(let j=0;j<pairs;j++){
   const t=j/pairs,s=(j+1)/pairs,w=.007*(1-.75*t);b.quad(at(t,-w),at(s,-w*.9),at(s,w*.9),at(t,w),dark,mid,mid,dark);
   const q=.09+j*.085*(10/pairs),span=(.21*Math.sin(Math.PI*Math.pow(q,.7))+.012)*.94;
   for(const side of [-1,1]){
    const centre=at(q+.043,side*span*.48,.019),ring=[];
    for(let k=0;k<8;k++){const a=k*Math.PI/4,x=(1-Math.cos(a))*.5;ring.push(at(q+.074*x+Math.sin(a)*.023,side*span*x,.008*Math.sin(Math.PI*x)-.003*Math.abs(Math.sin(a))));}
    for(let k=0;k<8;k++)b.tri(centre,ring[k],ring[(k+1)%8],mix(mid,light,q*.30),mix(dark,mid,.60),mix(mid,light,.10));
   }
  }b.tri(at(.91,-.011),at(1.05),at(.91,.011),mid,light,mid);
 }return b.finish();
}
function stem(b,a,c,r=.006){const d=new T.Vector3(...c).sub(new T.Vector3(...a)),side=new T.Vector3(1,0,0).cross(d).normalize().multiplyScalar(r),other=d.clone().normalize().cross(side),shade=color('#71825c');for(let i=0;i<4;i++){const p=t=>side.clone().multiplyScalar(Math.cos(t)).addScaledVector(other,Math.sin(t)).toArray(),q=p(i*Math.PI/2),n=p((i+1)*Math.PI/2);b.quad(add(a,q),add(c,q),add(c,n),add(a,n),shade);}}
export function flowerGeometry(simple=false){
 const b=new Shape();
 for(let stalk=0;stalk<(simple?2:3);stalk++){
  const a=stalk*2.4,centre=[Math.cos(a)*.075,.44+stalk*.105,Math.sin(a)*.075];stem(b,[0,-.025,0],centre);
  const leaf=t=>rotate([0,.06+.24*(t-.24*t*t),.14*t*t],a+1),dark=color('#344d43'),green=color('#8b9d68');
  for(let j=0;j<6;j++){const t=j/6,s=(j+1)/6,p=(t,side)=>add(leaf(t),rotate([side*.029*Math.sin(Math.PI*t),-.006*Math.abs(side)*Math.sin(Math.PI*t),0],a+1));b.quad(p(t,-1),p(s,-1),p(s,1),p(t,1),dark,green,green,dark);}
  const low=color(stalk===1?'#a48ab8':'#cfb775'),high=color(stalk===1?'#e1c9e3':'#fff1c9');
  for(let p=0;p<5;p++){
   const ang=p*Math.PI*2/5+stalk,point=(t,x)=>add(centre,rotate([x,.014+.030*Math.sin(t*Math.PI*.87)+.010*(1-Math.min(1,Math.abs(x)/.047)),.010+t*.115],ang)),ring=[];
   for(let k=0;k<12;k++){const angle=k*Math.PI/6,t=(1-Math.cos(angle))*.5;ring.push(point(t,Math.sin(angle)*.044*(.66+.34*t)));}
   const center=point(.56,0);for(let k=0;k<12;k++)b.tri(center,ring[k],ring[(k+1)%12],mix(low,high,.65),mix(low,high,.86),mix(low,high,.86));
  }
  for(let p=0;p<8;p++)b.tri(add(centre,[0,.039,0]),add(centre,[Math.cos(p*Math.PI/4)*.025,.025,Math.sin(p*Math.PI/4)*.025]),add(centre,[Math.cos((p+1)*Math.PI/4)*.025,.025,Math.sin((p+1)*Math.PI/4)*.025]),color('#dfb85c'));
 }return b.finish();
}
export function auxiliaryLeafGeometry(){const b=new Shape(),mid=color('#f1f0de'),edge=color('#daddcd'),ring=[];for(let k=0;k<16;k++){const a=k*Math.PI/8,y=(1-Math.cos(a))*.5;ring.push([Math.sin(a)*.23*(.88+.12*y),y,.018*Math.sin(Math.PI*y)]);}for(let k=0;k<16;k++)b.tri([0,.5,.065],ring[k],ring[(k+1)%16],mid,edge,edge);return b.finish();}
export const triangles=g=>(g.index?.count??g.attributes.position.count)/3;
export function understoryGeometry(source){
 const p=source.attributes.position,c=source.attributes.color;
 if(p.count%6!==0)throw Error('R8 understory expects original paired blade triangles');
 const blades=p.count/6,positions=new Float32Array(blades*21),colors=new Float32Array(blades*21),indices=new Uint32Array(blades*15);
 const point=i=>new T.Vector3().fromBufferAttribute(p,i),pigment=i=>[c.getX(i),c.getY(i),c.getZ(i)];
 for(let blade=0;blade<blades;blade++){
  const i=blade*6,left=point(i),right=point(i+1),bend=point(i+2),end=point(i+4),root=left.clone().add(right).multiplyScalar(.5),side=right.clone().sub(left).multiplyScalar(.5),middle=bend.clone().addScaledVector(side,.25);
  const centre=t=>root.clone().multiplyScalar((1-t)*(1-t)).addScaledVector(middle,2*(1-t)*t).addScaledVector(end,t*t);
  const row=(t,width)=>[centre(t).addScaledVector(side,-width).toArray(),centre(t).addScaledVector(side,width).toArray()];
  const a=row(0,.55),d=row(.38,.62),e=row(.72,.40),base=pigment(i),body=pigment(i+2),top=pigment(i+4);
  positions.set([...a[0],...a[1],...d[0],...d[1],...e[0],...e[1],...end.toArray()],blade*21);
  colors.set([...base,...base,...body,...body,...mix(body,top,.65),...mix(body,top,.65),...top],blade*21);
  indices.set([0,2,1,2,3,1,2,4,3,4,5,3,4,6,5].map(n=>n+blade*7),blade*15);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('color',new T.BufferAttribute(colors,3));g.setIndex(new T.BufferAttribute(indices,1));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
