import {layouts} from './layout-cache.js';
import {layoutKey} from './layout-key.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {random,rockObstacles} from '../../visual-r9/c-ecology/layout.js';
const V=a=>new T.Vector3(...a);
const REVISION='storybook-meadow-3';
// Curved volumetric petals and lanceolate foliage, not billboard cards.
function blade(length,width,bend,angle,y=0){
 const p=[],ix=[];for(let i=0;i<=5;i++){const t=i/5,w=width*Math.sin(Math.PI*t)*.5;for(const side of [-1,0,1]){const x=side*w,z=bend*t*t+(side===0?-.008*Math.sin(Math.PI*t):0);p.push(x*Math.cos(angle)+z*Math.sin(angle),y+length*(t-.34*t*t*t),-x*Math.sin(angle)+z*Math.cos(angle));}}
 for(let i=0;i<5;i++)for(let j=0;j<2;j++){const a=i*3+j;ix.push(a,a+3,a+1,a+1,a+3,a+4);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;
}
function stem(x,z,h){const g=new T.CylinderGeometry(.003,.005,h,3,1, true);g.deleteAttribute('uv');g.translate(x,h/2,z);return g;}
function flowerPetal(angle,h,r){const g=new T.BufferGeometry();const p=[0,h,0,r*.48,h+.014,-r*.22,r,h+.004,0,r*.48,h+.014,r*.22,r*.5,h+.020,0];g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex([0,1,4,1,2,4,2,3,4,3,0,4]);g.rotateY(-angle);g.computeVertexNormals();return g;}

function geometry(kind,variant){
 const greens=[],blooms=[],hearts=[],rng=random(71+variant*31),sage=kind==='sage',grass=kind==='grass';
 if(grass){for(let k=0;k<3;k++)greens.push(blade(.23+rng()*.19,.018+rng()*.012,.13+rng()*.11,k*.47));}
 else{const h=sage?.31+variant*.035:.18+variant*.02;greens.push(stem(0,0,h));for(let k=0;k<3;k++)greens.push(blade(.07+rng()*.045,.013+rng()*.012,.05+rng()*.025,k*2.4,k<3?0:h*.25));
 if(sage){for(let tier=0;tier<5;tier++){const t=tier/5,rad=.035*(1-t*.65);for(let k=0;k<3;k++){const a=k*Math.PI/2+tier*.8,g=new T.SphereGeometry(1,4,2);g.scale(.019*(1-t*.4),.025*(1-t*.5),.015);g.translate(Math.cos(a)*rad,h*.48+t*h*.59,Math.sin(a)*rad);blooms.push(g);}}}
 else {const radius=.052+variant*.003;for(let k=0;k<9;k++)blooms.push(flowerPetal(k*Math.PI*2/9,h,radius));const g=new T.SphereGeometry(1,6,2);g.scale(.019,.013,.019);g.translate(0,h+.008,0);hearts.push(g);}}
 const merge=a=>{if(!a.length)return null;const g=mergeGeometries(a,false);a.forEach(g=>g.dispose());return g;};return {leaf:merge(greens),bloom:merge(blooms),heart:merge(hearts)};
}
export function install(ctx){
 const {surface,hydrology,world,debug}=ctx,rng=random(20261118),group=new T.Group();group.name='Storybook / authored meadow colonies';world.add(group);
 const records=[],rejected={},meshes=[],materials=[],geometries=[];let disposed=false;
 const quality=ctx.quality??'desktop',key=layoutKey(ctx,install.toString()+geometry.toString()+blade.toString()+stem.toString()+flowerPetal.toString()+rockObstacles.toString()),build=new URLSearchParams(location.search).has('layoutBuild'),entry=layouts[quality],cached=!build&&entry?.key===key?entry:null;
 const rocks=cached?[]:rockObstacles(ctx);
 world.updateMatrixWorld(true);const houseInverse=new T.Matrix4().multiplyMatrices(world.matrixWorld.clone().invert(),ctx.assets.cottage.matrixWorld).invert();
 const reject=k=>{rejected[k]=(rejected[k]??0)+1;return false;};
 function safe(u,v,r){const f=surface.frame(u,v),z=f.zones??surface.sample(u,v).zones,b=debug.r7B;
 if(z.wet||z.sea||z.river||(hydrology.waterAt?.(u,v)?.depth??0)>.001)return reject('wet');
 const hp=V(f.position).applyMatrix4(houseInverse);if((Math.abs(hp.x)<2.9&&hp.z>1.05&&hp.z<2.55)||Math.hypot(hp.x-2.48,hp.z-2.63)<.32+r)return reject('courtyard');
 if(z.protectedHouse||z.protectedTree)return reject('protected');
 if((b?.rootRegions??[]).some(p=>Math.hypot(u-p.u,v-p.v)<(p.kind==='main'?b.rootRadiusAt(u,v):p.radius)+r))return reject('root');
 const aux=debug.r7A?.auxiliaryTree;if(aux&&Math.hypot(u-aux.u,v-aux.v)<(aux.rootRadius??.6)+r)return reject('aux-root');
 if(z.pathDistance<(b?.road?.edgeHalfWidthAt?.(u,v)??.48)+r*.7)return reject('path');
 if(rocks.some(p=>Math.hypot(u-p.u,v-p.v)<p.footprint+r*.4))return reject('rock');
 if(f.normal.reduce((s,x,i)=>s+x*f.direction[i],0)<.62)return reject('slope');
 for(let k=0;k<6;k++){const a=k*Math.PI/3,p=f.position.map((x,i)=>x+f.east[i]*Math.cos(a)*r+f.south[i]*Math.sin(a)*r),uv=surface.uvFromDirection(p),q=surface.sample(...uv);if(q.zones.wet||q.zones.sea||q.zones.river||q.zones.protectedHouse||q.zones.protectedTree)return reject('rim');}return f;}
 // Elongated drifts follow the land; their overlapping lobes avoid polka-dot beds.
 const beds=[[-1.65,1.55,.95,.5,.5,85],[-.35,2.9,.70,.60,-.7,100],[.75,4.25,.75,.45,.5,85],[1.4,6.5,.65,.55,.7,46],[3.6,5.5,.85,.62,-.7,64],[3.5,2.7,.65,.40,.6,42],[-3.6,.8,.7,.38,-.3,44],[-4.8,2,.75,.38,-.7,35],[1.6,.4,.45,.26,.3,22]];
 if(cached){records.push(...cached.records.map(p=>({...p,matrix:new T.Matrix4().fromArray(p.matrix)})));Object.assign(rejected,cached.rejected);}else{
 for(let j=0;j<beds.length;j++){const [u0,v0,rx,rz,a,target]=beds[j];for(let attempt=0,placed=0;attempt<2000&&placed<target;attempt++){
 const angle=rng()*Math.PI*2,r=Math.sqrt(rng()),x=Math.cos(angle)*r*rx,z=Math.sin(angle)*r*rz,u=u0+x*Math.cos(a)-z*Math.sin(a),v=v0+x*Math.sin(a)+z*Math.cos(a);
 const lace=.45+.35*Math.sin(u*7+v*3)+.25*Math.cos(v*9-u*4);if(lace<.25||rng()>lace*(1-r*.68))continue;
 const kind=rng()<.24?'grass':(j%3===0?rng()<.70:rng()<.36)?'sage':'daisy',size=(v>5?1.0:.58)+rng()*(v>5?.75:.48),footprint=(kind==='grass'?.13:kind==='sage'?.085:.08)*size;
 if(records.some(p=>Math.hypot(p.u-u,p.v-v)<(kind==='grass'?.085:.078)))continue;const f=safe(u,v,footprint);if(!f)continue;
 const matrix=new T.Matrix4().makeBasis(V(f.east),V(f.normal),V(f.south)).setPosition(V(f.position).addScaledVector(V(f.normal),-.009)).multiply(new T.Matrix4().makeRotationY(rng()*Math.PI*2)).scale(new T.Vector3(size,size,size));records.push({u,v,kind,variant:Math.floor(rng()*3),bed:j,size,footprint,matrix});placed++;}}
 }
 const palette={leaf:['#66764e','#748057','#879162'],daisy:['#e7ddc8','#eee3d5','#d3c7c6'],sage:['#a08bb7','#b3a0c6','#8b7ba8'],heart:['#b99a52','#ccb166','#c4a35b']};
 for(const kind of ['grass','daisy','sage'])for(let variant=0;variant<3;variant++){const subset=records.filter(p=>p.kind===kind&&p.variant===variant);if(!subset.length)continue;const gs=geometry(kind,variant);for(const [part,g]of Object.entries(gs)){if(!g)continue;const mat=new T.MeshStandardMaterial({color:palette[part==='bloom'?kind:part][variant],roughness:.92,metalness:0,side:T.DoubleSide});materials.push(mat);geometries.push(g);const mesh=new T.InstancedMesh(g,mat,subset.length);mesh.name=`Storybook ${kind}/${variant}/${part}`;subset.forEach((p,i)=>mesh.setMatrixAt(i,p.matrix));mesh.instanceMatrix.needsUpdate=true;mesh.receiveShadow=true;mesh.castShadow=false;mesh.computeBoundingSphere();group.add(mesh);meshes.push(mesh);}}
 ctx.invalidate?.();const api={group,exportLayout:()=>({key,quality,rejected,records:records.map(({matrix,...p})=>({...p,matrix:matrix.toArray()}))}),dispose(){if(disposed)return;disposed=true;ctx.signal?.removeEventListener('abort',api.dispose);group.removeFromParent();meshes.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());ctx.invalidate?.();},inspect:()=>({revision:REVISION,layoutCache:{mode:cached?'baked':'sampled',quality,key,reason:build?'explicit-build':!entry?'cache-missing':entry.key!==key?'dependency-mismatch':'matched'},disposed,plants:records.length,bySpecies:Object.fromEntries(['grass','daisy','sage'].map(k=>[k,records.filter(p=>p.kind===k).length])),beds:beds.map((b,i)=>({anchor:b,count:records.filter(p=>p.bed===i).length})),drawCalls:meshes.length,triangles:meshes.reduce((s,m)=>s+m.geometry.index.count/3*m.count,0),rejected,records:records.map(({matrix,...p})=>p)})};ctx.signal?.addEventListener('abort',api.dispose,{once:true});return api;
}




