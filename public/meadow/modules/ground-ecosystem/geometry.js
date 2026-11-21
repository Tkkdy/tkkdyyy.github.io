import * as T from 'three';
import {tangentUV,randomFromSeed} from './config.js';

// All artwork is original parametric geometry. Colors are linear vertex pigments;
// no external assets, per-frame noise, or copied reference geometry.
class Builder {
  constructor(){this.p=[];this.c=[];}
  tri(a,b,c,ca,cb=ca,cc=ca){this.p.push(...a,...b,...c);this.c.push(...ca,...cb,...cc);}
  quad(a,b,c,d,ca,cb=ca,cc=ca,cd=ca){this.tri(a,b,d,ca,cb,cd);this.tri(b,c,d,cb,cc,cd);}
  finish(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));g.setAttribute('color',new T.Float32BufferAttribute(this.c,this.colorSize??3));if(this.uv)g.setAttribute('uv',new T.Float32BufferAttribute(this.uv,2));g.computeVertexNormals();g.computeBoundingSphere();return g;}
}
const color=s=>new T.Color(s).toArray();
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const rotate=(p,a)=>[p[0]*Math.cos(a)+p[2]*Math.sin(a),p[1],-p[0]*Math.sin(a)+p[2]*Math.cos(a)];
const add=(a,b)=>a.map((v,i)=>v+b[i]);

function leaf(b,{origin=[0,0,0],angle=0,length=.55,width=.09,lean=.25,base='#344d43',tip='#8b9d68',steps=5}){
  const dark=color(base),light=color(tip);
  const point=(t,side)=>add(origin,rotate([side*Math.sin(Math.PI*t)*width, length*(t-.24*t*t)-Math.abs(side)*Math.sin(Math.PI*t)*width*.24,lean*t*t],angle));
  for(let i=0;i<steps;i++){
    const t=i/steps,n=(i+1)/steps;
    for(const [l,r] of [[-1,0],[0,1]])b.quad(point(t,l),point(n,l),point(n,r),point(t,r),mix(dark,light,t*.7),mix(dark,light,n*.9),mix(dark,light,n*.7),mix(dark,light,t*.65));
  }
}
function stem(b,a,c,r=.009){
  const d=new T.Vector3(...c).sub(new T.Vector3(...a)), side=new T.Vector3(1,0,0).cross(d).normalize().multiplyScalar(r), other=d.clone().normalize().cross(side);
  const shade=color('#71825c');
  for(let i=0;i<4;i++){
    const p=t=>side.clone().multiplyScalar(Math.cos(t)).addScaledVector(other,Math.sin(t)).toArray();
    const q=p(i*Math.PI/2),n=p((i+1)*Math.PI/2);
    b.quad(add(a,q),add(c,q),add(c,n),add(a,n),shade);
  }
}
function softenNormals(g){
  const p=g.attributes.position,n=g.attributes.normal,buckets=new Map();
  for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*1e5)).join(',');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}
  for(const ids of buckets.values()){const v=new T.Vector3();for(const i of ids)v.add(new T.Vector3().fromBufferAttribute(n,i));v.normalize();for(const i of ids)n.setXYZ(i,v.x,v.y,v.z);}
  return g;
}
export function grassGeometry(simple=false){
  const b=new Builder(),count=simple?4:8,steps=simple?3:5;
  const root=color('#3f5b43'),body=color('#83965f'),dry=color('#b5af79');
  for(let i=0;i<count;i++){
    const a=i*2.399,h=.23+(i%5)*.065,w=.018+(i%3)*.008,bend=.14+(i%4)*.045;
    const point=(t,side)=>rotate([side*w*Math.sin(Math.PI*Math.pow(t,.76))+.045*Math.sin(t*2.4+i)*t,h*t-.11*t*t,bend*t*t],a);
    for(let j=0;j<steps;j++){
      const t=j/steps,n=(j+1)/steps,c0=mix(root,body,t),c1=mix(body,dry,(i%3===0?.48:.16)*n);
      b.quad(point(t,-1),point(n,-1),point(n,1),point(t,1),c0,c1,mix(c1,dry,.07),c0);
    }
  }
  return softenNormals(b.finish());
}
export function fernGeometry(simple=false){
  const b=new Builder(),dark=color('#386450'),mid=color('#709b70'),light=color('#a6b88a');
  const fronds=simple?4:6,pairs=simple?6:10;
  for(let frond=0;frond<fronds;frond++){
    const angle=frond*2.399+.1*Math.sin(frond),length=.62+(frond%3)*.11,spread=.42+(frond%2)*.12;
    const at=(t,x=0,lift=0)=>rotate([x,length*Math.sin(t*1.42)-.12*t*t+lift,spread*t*t],angle);
    for(let j=0;j<pairs;j++){
      const t=j/pairs,n=(j+1)/pairs,stemWidth=.009*(1-.75*t);
      b.quad(at(t,-stemWidth),at(n,-stemWidth*.9),at(n,stemWidth*.9),at(t,stemWidth),dark,mid,light,mid);
      const q=.09+j*.085*(10/pairs),width=.21*Math.sin(Math.PI*Math.pow(q,.7))+.012;
      for(const side of [-1,1]){
        const root=at(q),ridge=at(q+.025,side*width*.48,.012),tip=at(q+.09,side*width,.008);
        const lower=at(q-.026,side*width*.46,-.007),upper=at(q+.077,side*width*.53,-.004);
        const shade=mix(mid,light,q*.42);
        b.tri(root,ridge,lower,dark,shade,mid);b.tri(lower,ridge,tip,mid,shade,light);
        b.tri(root,upper,ridge,dark,mid,shade);b.tri(ridge,upper,tip,shade,mid,light);
      }
    }
    // Tapering tips extend beyond the last pair, without blunt polygon ends.
    b.tri(at(.91,-.014),at(1.05),at(.91,.014),mid,light,mid);
  }
  return softenNormals(b.finish());
}
export function flowerGeometry(simple=false){
  const b=new Builder();
  for(let stalk=0;stalk<(simple?2:3);stalk++){
    const a=stalk*2.4,center=[Math.cos(a)*.075,.44+stalk*.105,Math.sin(a)*.075];
    stem(b,[0,-.025,0],center);
    leaf(b,{angle:a+1,origin:[0,.06,0],length:.24,width:.048,lean:.14,steps:3});
    const low=color(stalk===1?'#a48ab8':'#cfb775'), high=color(stalk===1?'#e1c9e3':'#fff1c9');
    for(let p=0;p<5;p++){
      const ang=p*Math.PI*2/5+stalk;
      const point=(t,s)=>add(center,rotate([Math.sin(Math.PI*t)*s*.047,.015+Math.sin(t*Math.PI*.8)*.045,.012+t*.115],ang));
      for(let j=0;j<(simple?2:3);j++){
        const steps=simple?2:3,t=j/steps,n=(j+1)/steps;
        b.quad(point(t,-1),point(n,-1),point(n,0),point(t,0),mix(low,high,t),mix(low,high,n),mix(low,high,n),mix(low,high,t));
        b.quad(point(t,0),point(n,0),point(n,1),point(t,1),mix(low,high,t),mix(low,high,n),mix(low,high,n),mix(low,high,t));
      }
    }
    for(let p=0;p<8;p++) b.tri(add(center,[0,.039,0]),add(center,[Math.cos(p*Math.PI/4)*.029,.025,Math.sin(p*Math.PI/4)*.029]),add(center,[Math.cos((p+1)*Math.PI/4)*.029,.025,Math.sin((p+1)*Math.PI/4)*.029]),color('#dfb85c'));
  }
  return b.finish();
}
export function stoneGeometry(variant=0){
  const g=new T.SphereGeometry(1,40,24),p=g.attributes.position,colors=[];
  const shadow=color('#586875'),body=color('#a0a49c'),warm=color('#c4b59a'),moss=color('#778664');
  const planes=[[1,.16,.12,.88],[-1,.08,.21,.83],[.08,1,.12,.86],[-.09,-1,.14,.81],[.14,.21,1,.86],[-.12,.08,-1,.8],
    [.7,.5,.55,.91],[-.63,.58,.55,.9],[.58,.6,-.65,.88],[-.6,.52,-.62,.89],[.7,-.5,.55,.95],[-.65,-.54,.6,.94],[.59,-.58,-.6,.93],[-.6,-.5,-.65,.92]];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),phase=variant*1.7;
    let face=Infinity;
    for(let j=0;j<planes.length;j++){const [a,b,c,d]=planes[j],dot=a*x+b*y+c*z;if(dot>.001)face=Math.min(face,(d+.035*Math.sin(j*2.3+phase))/dot);}
    // Smoothly rounded intersections of broad mineral planes. All faces belong
    // to the same closed mesh; there are no layered/disconnected rock shells.
    const r=.18+.82*face,weather=.012*Math.sin(y*11+x*3+Math.sin(z*5+phase));
    const px=x*(r+weather)*(variant===0?1.04:variant===1?.96:1.08);
    p.setXYZ(i,px,y*r*(.59+variant*.025)+.3+px*(variant===1?.09:.035),z*(r+weather)*(.8-variant*.025));
    let c=mix(shadow,body,Math.max(0,Math.min(1,y*.4+.57)));
    c=mix(c,warm,Math.max(0,Math.sin(x*5+z*3+phase))*.16);
    c=mix(c,moss,Math.max(0,(y-.3)*.22));colors.push(...c);
  }
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();softenNormals(g);g.computeBoundingSphere();return g;
}
export function mossGeometry(items,surface,field){
  const b=new Builder(),base=color('#536a53'),tip=color('#819273');b.uv=[];b.colorSize=4;
  const uv=(r,a)=>[(Math.cos(a)*r+1)/2,(Math.sin(a)*r+1)/2];
  for(const item of items){
    const center=surface.frame(item.u,item.v),points=new Map(),pigments=new Map();
    const point=(r,a)=>{
      const key=r===0?'center':`${r}:${Math.round((a%(Math.PI*2))*1e6)}`;
      if(points.has(key))return points.get(key);
      const scallop=1+.055*Math.sin(a*5+item.heading)+.035*Math.sin(a*3);
      const [u,v]=tangentUV(surface,center,Math.cos(a)*r*item.size*scallop,Math.sin(a)*r*item.size*.8*scallop);
      const f=surface.frame(u,v),lift=.014;
      const p=f.position.map((x,i)=>x+f.normal[i]*lift);points.set(key,p);return p;
    };
    const pigment=(r,a)=>{
      const key=`${r}:${a}`;if(pigments.has(key))return pigments.get(key);
      const c=[...mix(base,tip,.3+.22*(1-r)+.08*Math.sin(a*3+item.heading)),field.opacity(item,point(r,a))];
      pigments.set(key,c);return c;
    };
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8,n=(i+1)*Math.PI/8;
      b.tri(point(0,a),point(.34,n),point(.34,a),pigment(0,a),pigment(.34,n),pigment(.34,a));
      b.uv.push(...uv(0,a),...uv(.34,n),...uv(.34,a));
      for(const [r,s] of [[.34,.68],[.68,1]]){
        b.quad(point(r,a),point(r,n),point(s,n),point(s,a),pigment(r,a),pigment(r,n),pigment(s,n),pigment(s,a));
        b.uv.push(...uv(r,a),...uv(r,n),...uv(s,a),...uv(r,n),...uv(s,n),...uv(s,a));
      }
    }
  }
  return softenNormals(b.finish());
}

export function understoryGeometry(items,surface,quality,field){
  const b=new Builder(),random=randomFromSeed(98117);
  const root=color('#456446'),body=color('#6f875b'),tip=color('#99a677'),edge=color('#6d7d60');
  for(const item of items){
    const f=surface.frame(item.u,item.v),count=item.transition?(quality==='mobile'?8:12):(quality==='mobile'?28:40);
    let placed=0;
    for(let attempt=0;placed<count&&attempt<count*8;attempt++){
      const a=random()*Math.PI*2,r=Math.sqrt(random())*.97;
      const [u,v]=tangentUV(surface,f,Math.cos(a)*r*item.size,Math.sin(a)*r*item.size*.8);
      const s=surface.sample(u,v),coverage=field.sample(s.position).coverage;
      if(random()>.16+.84*coverage)continue;
      const angle=random()*Math.PI*2,fade=.22+.78*Math.sqrt(coverage);
      const length=Math.min(.10+random()*.11,Math.max(.016,(1.08-r)*item.size))*fade;
      const width=(.012+random()*.009)*(.42+.58*coverage),height=(.05+random()*.065)*fade;
      const point=(x,y,z)=>{
        const q=rotate([x,y,z],angle);
        return s.position.map((n,k)=>n+f.east[k]*q[0]+s.direction[k]*(q[1]-.007)+f.south[k]*q[2]);
      };
      const l=point(-width,0,0),right=point(width,0,0),middle=point(-width*.25,height,length*.48),end=point(.009*fade,height*.66,length);
      const c=mix(edge,mix(body,tip,random()*.32),coverage),top=mix(edge,tip,coverage*.74),bottom=mix(edge,root,coverage);
      b.tri(l,right,middle,bottom,bottom,c);b.tri(right,end,middle,bottom,top,c);placed++;
    }
  }
  return b.finish();
}
