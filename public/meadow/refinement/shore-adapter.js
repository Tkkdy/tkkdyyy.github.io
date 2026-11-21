import * as T from 'three';
import {uvFromDirection} from '../modules/planet-terrain/surface.js';
import {rockGeometry} from '../modules/ambient-animation/shore-rock-geometry.js';
const hash=n=>{const v=Math.sin(n*127.1+13.7)*43758.5453;return v-Math.floor(v);};
const grainGLSL=`
float shoreHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float shoreNoise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(shoreHash(i),shoreHash(i+vec2(1,0)),f.x),
 mix(shoreHash(i+vec2(0,1)),shoreHash(i+vec2(1,1)),f.x),f.y);
}
`;

export function dressGround(material){
 material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec3 shoreDetail;\nattribute vec2 shoreUV;\nvarying vec3 vShore;\nvarying vec2 vShoreUV;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nvShore=shoreDetail;vShoreUV=shoreUV;');
  shader.fragmentShader='varying vec3 vShore;\nvarying vec2 vShoreUV;\n'+grainGLSL+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
   #include <color_fragment>
   vec2 p=vShoreUV;
   float sand=smoothstep(.10,.65,vShore.x);
   float mottling=shoreNoise(p*5.3+shoreNoise(p*1.7));
   vec2 cell=p*27.,id=floor(cell),q=fract(cell)-.5;
   vec2 center=vec2(shoreHash(id+2.3),shoreHash(id+7.8))*.55-.275;
   float seed=shoreHash(id+9.4);
   float density=smoothstep(.36,.67,shoreNoise(p*1.8+vec2(12,3)));
   float grainPresent=step(.91-density*.22,seed);
   vec2 scale=vec2(1.,1.25+shoreHash(id+1.1)*.9);
   float radius=length((q-center)*scale);
   float aa=max(.035,length(fwidth(cell))*.55);
   float grain=(1.-smoothstep(.18-aa,.18+aa,radius))*grainPresent;
   float shadow=(1.-smoothstep(.23-aa,.23+aa,length((q-center-vec2(.07,.055))*scale)))*grainPresent;
   diffuseColor.rgb*=1.+sand*(mottling-.5)*.12;
   diffuseColor.rgb*=1.-sand*shadow*.13;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.59,.49,.34),grain*sand*.38);
   // Dry ochre grains and cooler damp sediment have different values.
   float damp=(1.-smoothstep(.01,.19,abs(vShore.z)))*sand;
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.80,.85,.86),damp*.55);
   float earth=shoreNoise(p*10.+vec2(5,13));
   diffuseColor.rgb*=1.+vShore.y*(earth-.5)*.10;
  `);
 };
 material.customProgramCacheKey=()=> 'shore-selected-granules-v2';
}

export function rockMaterial(){
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,toneMapped:false,emissive:'#738078',emissiveIntensity:.025});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute float stoneWater;\nvarying vec3 vStone,vPlanet;\nvarying float vWater;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
   #include <begin_vertex>
   vStone=position;vPlanet=(instanceMatrix*vec4(position,1.)).xyz;vWater=stoneWater;
  `);
  shader.fragmentShader='varying vec3 vStone,vPlanet;\nvarying float vWater;\n'+grainGLSL+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
   #include <color_fragment>
   vec3 p=vStone;
   float wash=shoreNoise(p.xz*4.2+p.y*.7);
   diffuseColor.rgb*=.88+.24*wash;
   float moss=smoothstep(.52,.72,shoreNoise(p.xz*3.+vec2(7.1,1.3)))
    *smoothstep(-.1,.45,p.y)*(1.-smoothstep(-.3,.5,p.z));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.20,.12),moss*.45);
   float fine=shoreNoise(p.xz*17.+p.y*4.);
   float aa=1.-smoothstep(.6,1.8,length(fwidth(p.xz*17.)));
   diffuseColor.rgb*=1.+(fine-.5)*.055*aa;
   float submerged=max(0.,vWater-length(vPlanet));
   // These are solid stones; only their submerged parts get a quiet water tint.
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.085,.18,.21),1.-exp(-submerged*5.));
  `);
 };
 material.customProgramCacheKey=()=> 'shore-fractured-stone-v2';
 return material;
}


// Controller adapter: original v2 fracture geometry and both shader functions above.
// No import of Ambient's alternate terrain, river or water material.
export function createShoreDetails(context, publication, ecosystem) {
 context.signal?.throwIfAborted();
 const {surface,hydrology}=context;
 if(surface.revision!=='terrain-20261114-r5'||hydrology.surfaceRevision!==surface.revision
   ||publication.shore.surfaceRevision!==surface.revision||publication.cross.surfaceRevision!==surface.revision)
   throw Error('Shore adapter requires the exact frozen r5 publication');
 const group=new T.Group();group.name='Ambient_shore_v2_on_r5';
 const resources=new Set(),own=r=>(resources.add(r),r),placements=[],rejected={};
 const coast=publication.shore.curves[0].slice(0,-1),sections=publication.cross.sections;
 const R=surface.radius,SEA=hydrology.seaLevel,batches=Array.from({length:5},()=>[]);
 const nearby=[];
 ecosystem?.traverse(o=>{if(o.userData.ecosystem?.kind==='rock')nearby.push(...o.userData.ecosystem.instances)});
 const failure=reason=>(rejected[reason]=(rejected[reason]??0)+1,false);
 const sample=(u,v)=>surface.sample(u,v);
 function nearestCoast(u,v){return coast.reduce((best,p,i)=>((p[0]-u)**2+(p[1]-v)**2<best.d?{i,p,d:(p[0]-u)**2+(p[1]-v)**2}:best),{d:Infinity})}
 function dryDirection(u,v) {
  const e=.04,d=hydrology.shoreline.signedDistance;
  const x=d(u+e,v)-d(u-e,v),z=d(u,v+e)-d(u,v-e),len=Math.hypot(x,z);
  return len>1e-7?[x/len,z/len]:[0,1];
 }
 function safe(u,v,size,submerged=false,cluster=null) {
  if(Math.hypot(u,v)>Math.PI*R-.5)return failure('chart');
  const s=sample(u,v);
  if(s.zones.protectedHouse||s.zones.protectedTree||s.zones.pathDistance<size*1.5+.55)return failure('protected/path');
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4,q=sample(u+Math.cos(a)*(size*1.6+.025),v+Math.sin(a)*(size*1.6+.025));
   if(q.zones.protectedHouse||q.zones.protectedTree||q.zones.pathDistance<.46)return failure('footprint');
  }
  if(nearby.some(p=>Math.hypot(p.u-u,p.v-v)<(p.footprint??p.size)+size*1.7+.05))return failure('ecosystem-rock');
  if(placements.some(p=>Math.hypot(p.u-u,p.v-v)<(p.size+size)*(cluster&&p.cluster===cluster.id? .55:1.35)))return failure('shore-overlap');
  if(!submerged&&s.height<SEA-.12)return failure('deep-shore');
  return true;
 }
 function place(u,v,size,variant,seed,flatten=.7,submerged=false,cluster=null) {
  if(!safe(u,v,size,submerged,cluster))return false;
  const s=sample(u,v),f=surface.frame(u,v),n=new T.Vector3(...f.normal);
  const east=new T.Vector3(...f.east).projectOnPlane(n).normalize(),south=new T.Vector3().crossVectors(east,n).normalize();
  const matrix=new T.Matrix4().makeBasis(east,n,south).multiply(new T.Matrix4().makeRotationY(seed*2.4));
  matrix.scale(new T.Vector3(size*(1.1+hash(seed)*.3),size*flatten,size*(.72+hash(seed+5)*.24)));
  matrix.setPosition(new T.Vector3(...s.position).addScaledVector(n,-size*.08));
  // Retain the source fractured geometry; seat its base in the actual r5 mesh.
  // Base vertices are checked in the spherical chart, not against a flat plane.
  let baseClearance=null;
  if(cluster){
   const geometry=rockGeometry(variant),points=geometry.attributes.position;
   for(let attempt=0;attempt<5;attempt++){
    const clearances=[];
    for(let j=0;j<points.count;j++)if(points.getY(j)<-.3){
     const q=new T.Vector3().fromBufferAttribute(points,j).applyMatrix4(matrix),uv=uvFromDirection(q.toArray());
     clearances.push(q.length()-R-sample(...uv).height);
    }
    clearances.sort((a,b)=>a-b);
    if(!clearances.length)break;
    baseClearance=clearances[Math.floor((clearances.length-1)*.85)];
    if(Math.abs(baseClearance+.035)<.008)break;
    matrix.setPosition(new T.Vector3().setFromMatrixPosition(matrix).addScaledVector(n,-baseClearance-.035));
   }
   geometry.dispose();
  }
  const r=sections.reduce((best,r)=>Math.hypot(r.u-u,r.v-v)<best.d?{d:Math.hypot(r.u-u,r.v-v),r}:best,{d:Infinity}).r;
  const stage=s.zones.river?r.waterHeight:SEA;
  batches[variant].push({matrix,water:R+stage,tint:.90+hash(seed+40)*.20});
  placements.push({u,v,size,variant,groundHeight:s.height,stage,submerged,cluster:cluster?.id??null,baseClearance,matrix:matrix.toArray()});
  return true;
 }
 // Two estuary shoulders, measured along r5's coast in chart metres.
 // Unlike the old coast indices, spacing remains meaningful on this publication.
 const coastAt=(start,offset)=>{
  let i=start,remaining=Math.abs(offset),sign=Math.sign(offset)||1;
  for(let k=0;k<coast.length;k++){
   const j=(i+sign+coast.length)%coast.length,a=coast[i],b=coast[j],d=Math.hypot(b[0]-a[0],b[1]-a[1]);
   if(remaining<=d)return[a[0]+(b[0]-a[0])*remaining/d,a[1]+(b[1]-a[1])*remaining/d];
   remaining-=d;i=j;
  }
  return coast[start];
 };
 let seed=70;
 for(const cluster of [{id:'west-mouth',target:[-2.8,2.2]},{id:'east-mouth',target:[1.35,5.3]}]){
  const nearest=nearestCoast(...cluster.target);
  for(const [offset,size,variant]of [[0,.67,0],[-.85,.52,1],[.93,.46,2]]){
   const p=coastAt(nearest.i,offset),dry=dryDirection(...p);
   place(p[0]+dry[0]*.30,p[1]+dry[1]*.30,size,variant,seed++,.82,false,cluster);
  }
 }
 // Small river stones use final asymmetric bank publications, never old indices.
 for(const [t,bank] of [[.27,'leftBank'],[.40,'rightBank'],[.52,'leftBank'],[.67,'rightBank'],[.82,'leftBank']]){
  const r=sections[Math.round(t*(sections.length-1))];if(r.mergedWithSea)continue;
  const p=r[bank],x=p[0]-r.u,z=p[1]-r.v,len=Math.hypot(x,z);
  place(p[0]+x/len*.15,p[1]+z/len*.15,.10+hash(seed)*.025,seed%3,seed++,.64);
 }
 // Original v2 sparse sediment pockets, relocated with the frozen shoreline.
 const pockets=[[-3.3,5.3],[-4.55,2.2],[-1.8,3.8]].map(p=>{
  const q=nearestCoast(...p).p,d=dryDirection(q[0],q[1]);
  return {u:q[0]+d[0]*.24,v:q[1]+d[1]*.24,d};
 });
 for(let i=0;i<1800&&batches[3].length<86;i++){
  const p=pockets[i%pockets.length],a=hash(i+301)*Math.PI*2,r=Math.sqrt(hash(i+601))*.90;
  const u=p.u+Math.cos(a)*r,v=p.v+Math.sin(a)*r,s=sample(u,v),d=hydrology.shoreline.signedDistance(u,v);
  if(d<.045||d>.65||s.zones.wet)continue;
  place(u,v,.022+.035*hash(i+901),3,i+201,.55);
 }
 for(let i=0;i<700&&batches[3].length<93;i++){
  const p=pockets[i%3],u=p.u-p.d[0]*(.25+hash(i+1301)*.45)+(hash(i+1601)-.5)*.7,
   v=p.v-p.d[1]*(.25+hash(i+1301)*.45)+(hash(i+1901)-.5)*.7;
  const depth=SEA-sample(u,v).height;
  if(depth>.035&&depth<.22)place(u,v,.025+.025*hash(i+1901),3,i+1700,.52,true);
 }
 // Relocate grit displaced by the larger groups rather than dropping detail.
 for(let i=0;i<2200&&batches[3].length<93;i++){
  const p=pockets[i%3],u=p.u+(hash(i+4301)-.5)*2.1,v=p.v+(hash(i+4701)-.5)*1.8;
  const d=hydrology.shoreline.signedDistance(u,v);
  if(d<.045||d>.65||sample(u,v).zones.wet)continue;
  place(u,v,.022+.035*hash(i+4901),3,i+4201,.55);
 }
 // Retain exactly 44 selected grains where final dry pockets permit, without
 // touching the preserved ecosystem's instance positions or quantities.
 let grains=0;
 for(let i=0;i<1300&&grains<44;i++){
  const p=pockets[i%3],u=p.u+(hash(i+2501)-.5)*.62,v=p.v+(hash(i+2801)-.5)*.5;
  const d=hydrology.shoreline.signedDistance(u,v);
  if(d<.07||d>.65||sample(u,v).zones.wet)continue;
  if(place(u,v,.0055+.0065*hash(i+3101),4,i+2300,.46))grains++;
 }
 const material=own(rockMaterial());
 batches.forEach((items,i)=>{
  if(!items.length)return;
  const g=own(rockGeometry(i));
  g.setAttribute('stoneWater',new T.InstancedBufferAttribute(new Float32Array(items.map(x=>x.water)),1));
  const mesh=new T.InstancedMesh(g,material,items.length);
  items.forEach((item,j)=>{mesh.setMatrixAt(j,item.matrix);mesh.setColorAt(j,new T.Color().setScalar(item.tint))});
  mesh.name=i===4?'selected-sand-grains':i===3?'sand-grit-and-pebbles':'fractured-shore-stones-'+i;
  mesh.castShadow=i<3;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);
 });
 // A local dry sediment skin carries the unchanged v2 sand shader. It is not
 // another globe/riverbed/water layer; accepted terrain data stays untouched.
 const pos=[],colors=[],uv=[],details=[],indices=[],skinSamples=[];
 for(const pocket of pockets){
  const step=.055,N=22,first=pos.length/3,valid=[];
  for(let y=0;y<=N;y++)for(let x=0;x<=N;x++){
   const u=pocket.u+(x/N-.5)*N*step,v=pocket.v+(y/N-.5)*N*step,s=sample(u,v);
   const d=hydrology.shoreline.signedDistance(u,v),r=Math.hypot((x/N-.5)*2,(y/N-.5)*2);
   const allowed=r<1&&!s.zones.wet&&!s.zones.protectedHouse&&!s.zones.protectedTree&&s.zones.pathDistance>.58&&d>.02&&d<.75;
   const n=s.direction;pos.push(...s.position.map((q,i)=>q+n[i]*.003));uv.push(u,v);
   const weight=allowed?Math.max(0,1-r*r):0,color=new T.Color('#b7a384').lerp(new T.Color('#c9b895'),weight*.7);
   colors.push(color.r,color.g,color.b);details.push(weight,0,d);valid.push(allowed);skinSamples.push({u,v,allowed,offset:.003});
  }
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
   const a=y*(N+1)+x,b=a+1,c=a+N+1,d=c+1;
   for(const tri of [[a,c,b],[b,c,d]])if(tri.every(i=>valid[i]))indices.push(...tri.map(i=>i+first));
  }
 }
 if(indices.length){
  const g=own(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('shoreUV',new T.Float32BufferAttribute(uv,2));
  g.setAttribute('shoreDetail',new T.Float32BufferAttribute(details,3));g.setIndex(indices);g.computeVertexNormals();
  // Orient outward for all charts.
  const p=g.attributes.position,index=g.index;
  for(let i=0;i<index.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,index.getX(i)),b=new T.Vector3().fromBufferAttribute(p,index.getX(i+1)),c=new T.Vector3().fromBufferAttribute(p,index.getX(i+2));
   if(new T.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a)).dot(a)<0){const j=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,j)}}
  g.computeVertexNormals();g.computeBoundingSphere();
  const m=own(new T.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,toneMapped:false,transparent:true,depthWrite:false,alphaTest:.006,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  dressGround(m);
  const originalCompile=m.onBeforeCompile;
  m.onBeforeCompile=shader=>{originalCompile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a *= .58*smoothstep(0.,.72,vShore.x);\n#include <alphatest_fragment>')};
  m.customProgramCacheKey=()=> 'shore-v2-r5-feathered-dry-sediment';
  const mesh=new T.Mesh(g,m);mesh.name='local-dry-sand-sediment';mesh.receiveShadow=true;group.add(mesh);
 }
 let disposed=false;
 function dispose(){if(disposed)return;disposed=true;context.signal?.removeEventListener('abort',dispose);
  for(const o of group.children)if(o.isInstancedMesh)o.dispose();for(const r of resources)r.dispose();resources.clear();group.clear();group.removeFromParent()}
 context.signal?.addEventListener('abort',dispose,{once:true});
 const counts=batches.map(b=>b.length);const stats={revision:'shore-v3-grouped-on-frozen-r5',source:'b923392c',terrainRevision:surface.revision,counts,placements:placements.length,grains,skinTriangles:indices.length/3,rejected,waterMeshes:0,terrainReplaced:false};
 group.userData=stats;
 return {id:'ambient-shore',group,placements,skinSamples,stats,dispose};
}
