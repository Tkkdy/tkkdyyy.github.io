import * as T from 'three';
export const REVISION='r9-b-felt-meadow-1';
export const PALETTE=Object.freeze({eRoot:'#36554b',eBody:'#648b66',eTip:'#adb989'});
const ROOT={u:1.4,v:-2.7};
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function edgeHalfWidth(u,v){return .315+.035*Math.sin(u*3.7+v*2.1)+.018*Math.sin(v*6.1-u*1.4)+.018*Math.sin(u*12+v*7+.8*Math.sin(v*5))+.012*Math.sin(v*19-u*7)-.045*smooth(-.84,-.25,v)*(1-smooth(.6,1.25,v));}
export function collectField(ctx){
 const {surface,hydrology,assets,world,debug}=ctx;world.updateMatrixWorld(true,true);
 const inverse=world.matrixWorld.clone().invert(),frame=surface.frame(ROOT.u,ROOT.v),origin=new T.Vector3(...frame.position),normal=new T.Vector3(...frame.normal);
 const radii=Array(24).fill(.22),point=new T.Vector3(),matrix=new T.Matrix4();let rootVertices=0;
 assets.tree.traverse(mesh=>{if(!mesh.isMesh||mesh.name!=='blossom_painted_scene')return;
  matrix.multiplyMatrices(inverse,mesh.matrixWorld);const a=mesh.geometry.attributes.position;
  for(let i=0;i<a.count;i++){point.fromBufferAttribute(a,i).applyMatrix4(matrix);const height=point.clone().sub(origin).dot(normal);if(height<-.12||height>.24)continue;
   const uv=surface.uvFromDirection(point.toArray()),du=uv[0]-ROOT.u,dv=uv[1]-ROOT.v,r=Math.hypot(du,dv);if(r>1.25)continue;
   const index=Math.floor(((Math.atan2(dv,du)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*24);radii[index]=Math.max(radii[index],r);rootVertices++;
  }
 });
 const smooth=radii.map((r,i)=>Math.max(r*.96,(radii[(i+23)%24]+r+radii[(i+1)%24])/3));
 const main={...ROOT,radius:Math.max(...smooth),radii:smooth,kind:'main',measuredVertices:rootVertices};
 const aux=debug.r7A?.auxiliaryTree,rootRegions=[main,...(aux?[{u:aux.u,v:aux.v,radius:aux.rootRadius,kind:'auxiliary'}]:[])];
 const rootRadiusAt=(u,v)=>{let a=((Math.atan2(v-ROOT.v,u-ROOT.u)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*24;const i=Math.floor(a),f=a-i;return smooth[i]*(1-f)+smooth[(i+1)%24]*f;};
 function clearanceAt(u,v,footprint=0){
  const s=surface.sample(u,v),pd=s.zones?.pathDistance;if(!Number.isFinite(pd))throw Error('R7 B requires surface pathDistance');
  const roadClearance=pd-edgeHalfWidth(u,v)-footprint;
  const inRoot=rootRegions.some(r=>Math.hypot(u-r.u,v-r.v)<(r.kind==='main'?rootRadiusAt(u,v):r.radius)+footprint+.025);
  const zone=s.zones.wet?'wet':s.zones.protectedHouse?'house':inRoot?'root':roadClearance<0?'road':'meadow';
  return {allowed:zone==='meadow',zone,pathDistance:pd,roadClearance};
 }
 return {revision:REVISION,surfaceRevision:surface.revision,rootRegions,rootRadiusAt,clearanceAt,groundPalette:PALETTE,
  road:{centerHalfWidth:.21,edgeHalfWidth:.398,edgeHalfWidthAt:edgeHalfWidth,centerline:'surface.sample(u,v).zones.pathDistance',units:'surface chart metres'},
  rockContacts:(debug.r6Ground.contacts??[]).slice(0,12).map(c=>new T.Vector4(...c.uv,c.radius,c.radius*.82)),
  mainRoot:main,auxRoot:aux?new T.Vector3(aux.u,aux.v,aux.rootRadius):new T.Vector3(100,100,0),
  seaRadius:surface.radius+hydrology.seaLevel};
}
