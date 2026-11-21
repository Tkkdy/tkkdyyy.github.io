import * as T from 'three';
export function collectContext(ctx){
 const {surface,world,assets,debug}=ctx;
 world.updateWorldMatrix(true,true);
 const planetInverse=world.matrixWorld.clone().invert();
 const houseToPlanet=new T.Matrix4().multiplyMatrices(planetInverse,assets.cottage.matrixWorld);
 const houseUp=new T.Vector3(0,1,0).transformDirection(houseToPlanet);
 const key=new T.Vector3(...world.userData.r4Lighting.directions.key).normalize();
 const planes=new Map(),contacts=[];
 for(const mesh of [...ctx.ecology.group.children,...ctx.shore.group.children]){
  const kind=mesh.material?.userData.eGround?.kind;
  if(!mesh.isInstancedMesh||!['rock','shore-rock'].includes(kind)||/grit|grains/.test(mesh.name))continue;
  const batch=[],box=new T.Box3().setFromBufferAttribute(mesh.geometry.attributes.position);
  for(let i=0;i<mesh.count;i++){
   const m=new T.Matrix4().fromArray(mesh.instanceMatrix.array,i*16),origin=new T.Vector3().setFromMatrixPosition(m);
   const uv=surface.uvFromDirection(origin.toArray()),frame=surface.frame(...uv);
   const n=new T.Vector3(...frame.normal),p=new T.Vector3(...frame.position);
   batch.push(new T.Vector4(n.x,n.y,n.z,n.dot(p)));
   const scale=new T.Vector3().setFromMatrixScale(m),size=box.getSize(new T.Vector3());
   const radius=Math.max(size.x*scale.x,size.z*scale.z)*.44;
   if(radius>.25)contacts.push({mesh:mesh.name,index:i,uv,radius,plane:batch.at(-1).toArray()});
  }
  planes.set(mesh,batch);
 }
 // Largest actual footprints only; damp pigment, not an invented AO pass.
 contacts.sort((a,b)=>b.radius-a.radius);
 const footprint=contacts.slice(0,24).map(p=>new T.Vector4(...p.uv,p.radius,p.radius*.82));
 const emitters=debug.houseLighting?.emitters;
 if(!emitters||emitters.length!==9)throw Error('R6 ground needs the retained nine-emitter house contract');
 return {key,planes,contacts:contacts.slice(0,24),footprint,seaRadius:surface.radius+ctx.hydrology.seaLevel,
  houseUp,houseCenter:new T.Vector3().setFromMatrixPosition(houseToPlanet),
  emitters:emitters.filter(e=>e.role!=='lantern'),houseRevision:debug.houseLighting.revision,
  lightingRevision:world.userData.r4Lighting.revision,
  limits:'Surface tangent planes and measured rock footprints approximate local damp contact, not AO. Eight finite window/fanlight surfaces add bounded diffuse response; original lantern/porch remains solely a standard light. No visibility rays.'};
}
