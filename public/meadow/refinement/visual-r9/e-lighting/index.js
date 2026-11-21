import * as T from 'three';
import {REVISION,LIGHTING,readLights,direction,houseUniforms,gardenUniforms,cloneResponse} from './materials.js';
export {REVISION,LIGHTING};
const active=new WeakSet();
export function install(ctx){
 const {world,scene,assets,debug,renderer,signal,invalidate}=ctx;signal?.throwIfAborted();
 if(active.has(world))throw Error('R9 E already installed');
 if(!debug.r5House||!debug.r5Garden)throw Error('R9 E requires the retained R5 house/tree material responses');
 const lights=readLights(world),savedLights=[],bindings=[],records=new Map();
 const previous={fog:scene.fog,record:world.userData.r4Lighting,debug:debug.r8E,house:debug.houseLighting};
 let disposed=false,air,published,contract,houseRecord;
 const refresh=()=>{world.updateWorldMatrix(true,true);renderer.shadowMap.needsUpdate=true;debug.refreshShadows?.();invalidate?.();};
 function bind(mesh,kind,values){
  const source=mesh.material;
  if(Array.isArray(source))throw Error('R9 E requires one material per retained mesh');
  let record=records.get(source);
  if(!record){record={kind,source,compiles:0,shader:null};record.material=cloneResponse(source,kind,values,record);records.set(source,record);}
  bindings.push({mesh,source,record});mesh.material=record.material;
 }
 function dispose(){
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);
  for(const {mesh,source,record} of [...bindings].reverse())if(mesh.material===record.material)mesh.material=source;
  for(const r of records.values())r.material.dispose();
  for(const [light,state]of savedLights){light.color.copy(state.color);light.intensity=state.intensity;if(state.groundColor)light.groundColor.copy(state.groundColor);if(state.shadowIntensity!==undefined)light.shadow.intensity=state.shadowIntensity;if(state.distance!==undefined)light.distance=state.distance;}
  if(scene.fog===air)scene.fog=previous.fog;
  if(world.userData.r4Lighting===contract)world.userData.r4Lighting=previous.record;
  if(debug.houseLighting===houseRecord)debug.houseLighting=previous.house;
  if(debug.r8E===published){if(previous.debug===undefined)delete debug.r8E;else debug.r8E=previous.debug;}
  active.delete(world);refresh();
 }
 try{
  active.add(world);
  for(const [id,light]of Object.entries(lights)){
   savedLights.push([light,{color:light.color.clone(),intensity:light.intensity,groundColor:light.groundColor?.clone(),shadowIntensity:light.shadow?.intensity,distance:light.distance}]);
   const p=LIGHTING[id==='sky'?'hemisphere':id];light.color.set(p.color??p.sky);light.intensity=p.intensity;
   if(p.ground)light.groundColor.set(p.ground);if(p.shadowIntensity!==undefined)light.shadow.intensity=p.shadowIntensity;if(p.distance!==undefined)light.distance=p.distance;
  }
  const airEnabled=new URLSearchParams(globalThis.location?.search??'').get('air')!=='off';
  if(airEnabled){air=new T.Fog(LIGHTING.air.color,LIGHTING.air.near,LIGHTING.air.far);scene.fog=air;}
  world.updateWorldMatrix(true,true);
  const directions=Object.fromEntries(['key','rim','fill'].map(id=>[id,direction(lights[id],world).toArray()]));
  contract={...previous.record,...structuredClone(LIGHTING),revision:REVISION,directions,exposure:renderer.toneMappingExposure,air:{...LIGHTING.air,enabled:airEnabled},addedLights:0,addedObjects:0,addedShadowMaps:0,materialsUnchanged:false,cameraUnchanged:true};
  world.userData.r4Lighting=contract;
  bind(assets.cottage.getObjectByName('cottage_painted_scene'),'house',houseUniforms(lights,assets.cottage));
  for(const [name,kind]of [['blossom_painted_scene','wood'],['blossom_painted_petals','blossom']]){const mesh=assets.tree.getObjectByName(name);bind(mesh,kind,mesh.material.userData.r9PhysicalWood?{}:gardenUniforms(lights,mesh));}
  for(const group of [ctx.terrain.group,ctx.ecology.group,ctx.shore.group])group.traverse(mesh=>{
   if(mesh.isMesh&&mesh.material?.userData.r6Ground)bind(mesh,mesh.material.userData.r6Ground.kind,{r6Key:new T.Vector3(...directions.key)});
  });
  // Water's R4 render closure captures the original emitter array. Keep it exact:
  // emission, pane material and reflected source power are unchanged this round.
  houseRecord={...previous.house,lightingRevision:REVISION,emitters:previous.house.emitters,localBounce:{...previous.house.localBounce,gain:2.70,colorSRGB:'#ffd098',materialOnly:true},porch:{...previous.house.porch,intensity:lights.porch.intensity,owner:'r9-e-lighting'}};
  debug.houseLighting=houseRecord;
  published={revision:REVISION,lighting:contract,bindings,records:[...records.values()],dispose,
   stats:{materialCopies:records.size,meshBindings:bindings.length,addedLights:0,addedObjects:0,addedGeometry:0,addedTextures:0,addedClocks:0,addedRenderPasses:0},
   preservation:{geometry:true,camera:true,exposure:true,emissionMaterials:true,reflectionEmitterArray:true,waterMaterial:true,windClocks:true},
   limits:'Five retained real lights; house/crown keep baked directional-response shaders, physical bark consumes real lighting. Terrain/foliage add bounded directional wrap from the original direct/indirect lighting ratio. Window spill uses finite measured rectangles with facing/range bounds, not occluded GI. Linear depth air begins at 18 world units, leaving close inspection clear. Far surfaces blend toward muted lilac; custom cosmic shaders stay unchanged. No bloom or screen blur.'};
  debug.r8E=published;signal?.addEventListener('abort',dispose,{once:true});refresh();return{dispose};
 }catch(error){dispose();throw error;}
}

