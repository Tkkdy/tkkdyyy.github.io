import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export const REVISION='storybook-homestead-2';
export function install(ctx){
 const {world,assets,surface,debug,signal,invalidate}=ctx; signal?.throwIfAborted();
 const group=new T.Group();group.name='Storybook / inhabited garden';world.updateMatrixWorld(true);
 const transform=new T.Matrix4().multiplyMatrices(world.matrixWorld.clone().invert(),assets.cottage.matrixWorld);
 transform.decompose(group.position,group.quaternion,group.scale);world.add(group);
 const inverse=transform.clone().invert(),geometries=new Set(),materials=new Set();let disposed=false,seed=18943;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const mat=(color,options={})=>{const m=new T.MeshStandardMaterial({color,roughness:.87,...options});materials.add(m);return m};
 const stone=['#8d8992','#aaa092','#8e8e8b','#aaa5a0','#757d85'].map(c=>mat(c));
 const wood=mat('#80573e'),edge=mat('#aa8158'),iron=mat('#343a38',{metalness:.42}),soil=mat('#44392d'),leaf=mat('#60794a'),terracotta=mat('#a56d56'),rim=mat('#c38a6c');
 for(const m of [wood,edge]){
  m.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 vCraftPoint;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCraftPoint=position;');
   shader.fragmentShader='varying vec3 vCraftPoint;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat grain=sin(vCraftPoint.y*230.+sin(vCraftPoint.x*5.5+vCraftPoint.z*11.)*2.);float wash=sin(vCraftPoint.x*9.+vCraftPoint.z*13.);diffuseColor.rgb*=.94+.035*grain+.045*wash;');
  };m.customProgramCacheKey=()=>REVISION+'-wood-grain';
 }
 function own(g){geometries.add(g);return g}
 function mesh(g,m,p,parent=group){const o=new T.Mesh(own(g),m);o.position.set(...p);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 function box(w,h,d,r,m,p,parent=group){return mesh(new RoundedBoxGeometry(w,h,d,2,r),m,p,parent)}
 function ground(x,z){let y=0;for(let k=0;k<3;k++){const v=new T.Vector3(x,y,z).applyMatrix4(transform),uv=surface.uvFromDirection(v.toArray());y=new T.Vector3(...surface.frame(...uv).position).applyMatrix4(inverse).y;}return y;}
 function cylinder(a,b,r,m,parent=group){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);const o=mesh(new T.CylinderGeometry(r,r*.94,d.length(),8),m,av.add(bv).multiplyScalar(.5).toArray(),parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;}
 // A short retaining edge, not an enclosing wall: the door and landing remain open.
 function fieldstone(w,h,d,index){
  const g=new T.SphereGeometry(1,12,8),p=g.attributes.position,col=[];
  for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const n=Math.sin(x*4.2+y*2.3+z*3.1+index)*.055+Math.sin(y*7-z*5+index)*.025;
   const round=v=>Math.sign(v)*Math.pow(Math.abs(v),.63);
   p.setXYZ(i,round(x)*w*.5*(1+n),round(y)*h*.5*(1+n*.7),round(z)*d*.5*(1+n));
   const pigment=.86+.12*y+.075*Math.sin(x*7+z*4+index);const cool=Math.max(0,-y)*.045;col.push(pigment*1.03-cool,pigment,pigment*.95+cool);
  }g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.computeVertexNormals();return g;
 }
 for(const m of stone)m.vertexColors=true;
 const sage=mat('#73856a',{side:T.DoubleSide}),darkLeaf=mat('#3f6445',{side:T.DoubleSide}),petal=mat('#c7b1c7'),pollen=mat('#d7b577');leaf.side=T.DoubleSide;
 function blade(base,angle,length,width,lift,droop,material){
  const g=new T.BufferGeometry(),ps=[],uv=[],ids=[],segments=9;
  for(let i=0;i<=segments;i++){const t=i/segments,w=Math.pow(Math.sin(Math.PI*t),.8)*width;
   for(let j=-1;j<=1;j++){const across=j*w,y=Math.sin(Math.PI*t*.85)*lift-droop*t*t-Math.abs(j)*.022*Math.sin(Math.PI*t);ps.push(Math.sin(angle)*length*t+Math.cos(angle)*across,y,Math.cos(angle)*length*t-Math.sin(angle)*across);uv.push(t,(j+1)/2);}}
  for(let i=0;i<segments;i++)for(let j=0;j<2;j++){const n=i*3+j;ids.push(n,n+3,n+1,n+1,n+3,n+4);}g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();mesh(g,material,base);
 }
 for(const side of [-1,1]){const start=side<0?-2.15:.96,end=side<0?-.88:2.18,z=side<0?2.23:2.12;
  // Three thin, staggered courses with unequal spans and an L-shaped return.
  const breaks=[[0,.31,.76,1],[0,.18,.56,.83,1],[0,.40,.68,1]];
  for(let row=0;row<3;row++){const cuts=breaks[row];for(let i=0;i<cuts.length-1;i++){const w=(cuts[i+1]-cuts[i])*(end-start),x=start+(cuts[i]+cuts[i+1])*.5*(end-start),zz=z+Math.sin(i*1.7+row)*.018;const o=mesh(fieldstone(w-.012,.105+random()*.022,.25+random()*.025,i+row*6),stone[(i+row*2)%5],[x,ground(x,zz)+.025+row*.105,zz]);o.rotation.y=(random()-.5)*.12;o.rotation.z=(random()-.5)*.05;}
   const x=side<0?start+.04:end-.04;
   for(let i=0;i<2;i++){const zz=z-.21-i*.25;mesh(fieldstone(.21,.11,.28,i+row*4),stone[(i+row)%5],[x,ground(x,zz)+.025+row*.105,zz]);}}
  const mid=(start+end)/2,sy=ground(mid,z)+.22;
  box(end-start-.13,.075,.50,.035,soil,[mid,sy,z-.29]);
  // Discrete dark crumbs leave readable exposed earth between plants.
  for(let i=0;i<20;i++){const x=start+.12+random()*(end-start-.24),zz=z-.12-random()*.37;const o=mesh(new T.IcosahedronGeometry(.016+random()*.012,0),soil,[x,sy+.045,zz]);o.scale.y=.45;}
  for(let plant=0;plant<3;plant++){const x=start+.19+plant*(end-start-.38)/2,zz=z-.23-(plant%2)*.16,base=[x,sy+.035,zz];
   const material=[sage,darkLeaf,leaf][plant];
   for(let j=0;j<5;j++){const a=j*2.4+plant;blade(base,a,.19+random()*.09,plant===0?.035:.052,.11+random()*.06,plant===2?.16:.045,material);}
   if(plant===1){for(let k=0;k<2;k++){const tx=x+(k-.5)*.11,tz=zz+.025,ty=sy+.25+k*.05;cylinder(base,[tx,ty,tz],.005,darkLeaf);for(let j=0;j<5;j++){const a=j*Math.PI*2/5;const o=mesh(new T.SphereGeometry(.022,6,4),petal,[tx+Math.cos(a)*.022,ty,tz+Math.sin(a)*.022]);o.scale.set(1,.3,.65);o.rotation.y=-a;}mesh(new T.SphereGeometry(.011,6,4),pollen,[tx,ty+.007,tz]);}}
  }
 }
 // Weathered three-post fence, off the left corner, below the windows.
 const fenceZ=1.38,postXs=[-2.86,-2.52,-2.18];
 for(const x of postXs){const y=ground(x,fenceZ);box(.085,.63,.085,.018,wood,[x,y+.29,fenceZ]);box(.11,.045,.11,.016,edge,[x,y+.62,fenceZ]);}
 for(let i=0;i<2;i++)for(const height of [.26,.49]){const a=postXs[i],b=postXs[i+1],ya=ground(a,fenceZ)+height,yb=ground(b,fenceZ)+height;const o=box(b-a+.08,.065,.055,.014,wood,[(a+b)/2,(ya+yb)/2,fenceZ+.015]);o.rotation.z=Math.atan2(yb-ya,b-a);}
 // Bench on the right of the porch: shaped slats, pegged legs and low back.
 const bench=new T.Group();bench.position.set(2.23,ground(2.23,1.0),1.0);bench.scale.setScalar(.88);bench.rotation.y=1.43;group.add(bench);
 const benchFeet=[];
 bench.updateMatrix();
 for(const x of [-.34,.34])for(const z of [-.14,.14]){
  const foot=new T.Vector3(x,0,z).applyMatrix4(bench.matrix);
  const surfaceY=ground(foot.x,foot.z),bottom=(surfaceY-bench.position.y-.028)/bench.scale.y;
  box(.075,.38-bottom,.075,.015,wood,[x,(.38+bottom)*.5,z],bench);
  benchFeet.push({x:foot.x,z:foot.z,groundY:surfaceY,baseY:bench.position.y+bottom*bench.scale.y});mesh(new T.SphereGeometry(.019,6,4),iron,[x,.34,z+.041],bench);}
 for(const z of [-.145,0,.145])box(.91,.065,.12,.018,edge,[0,.40,z],bench);
 for(const x of [-.36,.36])box(.065,.43,.065,.014,wood,[x,.58,-.18],bench);
 for(const y of [.62,.77])box(.90,.105,.055,.02,edge,[0,y,-.18],bench);
 function pot(x,z,s){const y=ground(x,z),profile=[[0,0],[.10,0],[.15,.06],[.18,.21],[.145,.32],[.16,.33],[.16,.365],[.125,.365],[.12,.31],[.14,.21],[.10,.07],[0,.06]].map(([r,h])=>new T.Vector2(r*s,h*s));mesh(new T.LatheGeometry(profile,18),terracotta,[x,y,z]);const lip=mesh(new T.TorusGeometry(.143*s,.019*s,5,20),rim,[x,y+.347*s,z]);lip.rotation.x=Math.PI/2;mesh(new T.CylinderGeometry(.12*s,.12*s,.02,16),soil,[x,y+.29*s,z]);for(let i=0;i<7;i++){const a=i*2.4,top=[x+Math.cos(a)*.12*s,y+(.43+random()*.16)*s,z+Math.sin(a)*.12*s];cylinder([x,y+.3*s,z],top,.008*s,leaf);const l=mesh(new T.SphereGeometry(.06*s,7,5),leaf,top);l.scale.set(1,.35,2);l.rotation.y=a;}}
 pot(-2.02,1.75,.83);pot(2.12,1.57,.67);
 // A small forged lantern, a warm amber core protected by four narrow corner ribs.
 const lx=2.48,lz=2.63,ly=ground(lx,lz);box(.19,.13,.18,.035,stone[2],[lx,ly+.04,lz]);cylinder([lx,ly+.07,lz],[lx,ly+1.12,lz],.025,iron);
 cylinder([lx,ly+1.10,lz],[lx-.20,ly+1.16,lz],.022,iron);cylinder([lx-.20,ly+1.16,lz],[lx-.22,ly+1.03,lz],.016,iron);
 const cx=lx-.22,cy=ly+.88;box(.19,.035,.19,.015,iron,[cx,cy-.13,lz]);
 const glow=mat('#ffd29a',{emissive:'#ffb963',emissiveIntensity:1.45,roughness:.45});box(.12,.21,.12,.018,glow,[cx,cy,lz]);
 for(const dx of [-.075,.075])for(const dz of [-.075,.075])cylinder([cx+dx,cy-.12,lz+dz],[cx+dx,cy+.12,lz+dz],.011,iron);
 const cap=mesh(new T.ConeGeometry(.15,.10,4),iron,[cx,cy+.16,lz]);cap.rotation.y=Math.PI/4;
 const light=new T.PointLight('#ffc184',.38,1.8,2);light.position.set(cx,cy,lz);group.add(light);
 // Batch static handcrafted pieces by pigment, preserving real 3D silhouettes.
 group.updateWorldMatrix(true,true);const localInverse=group.matrixWorld.clone().invert(),batches=new Map(),pieces=[];
 group.traverse(o=>{if(o.isMesh)pieces.push(o)});
 // Pigments with identical light and shadow behaviour share a vertex-colour batch.
 const families=new Map();
 for(const o of pieces){
  const src=o.material,g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
  const old=g.attributes.color,colour=new Float32Array(g.attributes.position.count*3);
  for(let i=0;i<g.attributes.position.count;i++){
   colour[i*3]=src.color.r*(src.vertexColors&&old?old.getX(i):1);
   colour[i*3+1]=src.color.g*(src.vertexColors&&old?old.getY(i):1);
   colour[i*3+2]=src.color.b*(src.vertexColors&&old?old.getZ(i):1);
  }
  g.setAttribute('color',new T.BufferAttribute(colour,3));
  g.applyMatrix4(new T.Matrix4().multiplyMatrices(localInverse,o.matrixWorld));
  const family=src===iron?'iron':src===glow?'lamp':src===wood||src===edge?'wood':src.side;
  if(!families.has(family)){
   const m=src.clone();m.onBeforeCompile=src.onBeforeCompile;m.customProgramCacheKey=src.customProgramCacheKey.bind(src);
   m.vertexColors=true;m.color.setRGB(1,1,1);families.set(family,m);materials.add(m);batches.set(m,[]);
  }
  batches.get(families.get(family)).push(g);o.removeFromParent();
 }
 for(const g of geometries)g.dispose();geometries.clear();
 for(const [m,gs] of batches){const merged=mergeGeometries(gs);for(const g of gs)g.dispose();mesh(merged,m,[0,0,0]);}
 // Locate the chimney cap from the protected cottage's actual highest vertex cluster.
 let highest=-Infinity;const assetInverse=assets.cottage.matrixWorld.clone().invert();
 const capBounds=new T.Box3(),vertex=new T.Vector3();
 for(let pass=0;pass<2;pass++)assets.cottage.traverse(o=>{
  if(!o.isMesh)return;
  const m=new T.Matrix4().multiplyMatrices(assetInverse,o.matrixWorld),p=o.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   vertex.fromBufferAttribute(p,i).applyMatrix4(m);
   if(pass===0)highest=Math.max(highest,vertex.y);
   else if(vertex.y>highest-.035)capBounds.expandByPoint(vertex);
  }
 });
 const chimney=capBounds.getCenter(new T.Vector3());chimney.y=highest-.018;
 for(let layer=0;layer<5;layer++){
  const path=[];for(let i=0;i<=20;i++){const t=i/20,a=layer*1.7;path.push(new T.Vector3(chimney.x+Math.sin(t*7)*.075+t*t*.20+Math.cos(a)*.016*t,chimney.y+t*1.32,chimney.z-.13*t+Math.sin(t*8+a)*.022*t));}
  const curve=new T.CatmullRomCurve3(path),g=new T.TubeGeometry(curve,64,.045+layer*.012,12,false),pos=g.attributes.position;
  for(let i=0;i<pos.count;i++){const t=g.attributes.uv.getX(i),c=curve.getPointAt(t),v=new T.Vector3().fromBufferAttribute(pos,i).sub(c).multiplyScalar(.35+t*1.2);pos.setXYZ(i,c.x+v.x,c.y+v.y,c.z+v.z);}g.computeVertexNormals();
  const m=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{pigment:{value:new T.Color('#aeaaa8')},strength:{value:.065}},vertexShader:'varying vec2 smokeUV;varying vec3 smokeNormal;varying vec3 smokeView;void main(){smokeUV=uv;vec4 mv=modelViewMatrix*vec4(position,1.);smokeView=-mv.xyz;smokeNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*mv;}',fragmentShader:'uniform vec3 pigment;uniform float strength;varying vec2 smokeUV;varying vec3 smokeNormal;varying vec3 smokeView;void main(){float t=smokeUV.x;float facing=abs(dot(normalize(smokeNormal),normalize(smokeView)));float envelope=smoothstep(0.,.035,t)*(1.-smoothstep(.3,1.,t));float drift=.75+.25*sin(t*32.+sin(smokeUV.y*19.)*1.2);float alpha=strength*pow(facing,2.)*envelope*drift;gl_FragColor=vec4(pigment,alpha);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});materials.add(m);const o=mesh(g,m,[0,0,0]);o.name='Fine chimney smoke '+layer;o.castShadow=false;o.receiveShadow=false;o.renderOrder=3;
 }
 world.updateMatrixWorld(true);debug.refreshShadows?.();invalidate?.();
 const inspect=()=>({revision:REVISION,disposed,meshes:(()=>{let n=0;group.traverse(o=>{if(o.isMesh)n++});return n})(),geometries:geometries.size,materials:materials.size,addedLights:1,benchFeet,protectedAssetsUnchanged:true,groundMethod:'active surface frame, iterated in house-local coordinates',chimney:chimney.toArray(),chimneyCap:capBounds.getSize(new T.Vector3()).toArray(),smoke:'five translucent 3D tapered wisps, static in reduced motion'});
 function dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();signal?.removeEventListener('abort',dispose);invalidate?.();}
 signal?.addEventListener('abort',dispose,{once:true});return {dispose,inspect};
}




