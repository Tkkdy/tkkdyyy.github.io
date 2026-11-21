import * as T from 'three';
export const REVISION='r5-night-pigment-2';
// sRGB palette inputs, converted by Three into linear working space. Existing
// R4 masks and three-scale textures stay intact; this layer only rebinds pigment.
export const PALETTE=Object.freeze({
 eRoot:'#2f504b',eBody:'#66836c',eTip:'#adb88c',
 eCream:'#e8decd',ePink:'#d3acbd',eLilac:'#aaa6c8',
 eStone:'#708092',eStoneWarm:'#ada18e',
 terrainSoil:'#9b8b7b',terrainPath:'#b49b80',
 terrainRock:'#72808b',terrainRockLight:'#ac9f8c',terrainRockShadow:'#43566c',
 water_deep:'#173b58',water_shallow:'#3b7c83',water_lavender:'#596b91',water_stroke:'#7babc0',
});
export function install(ctx){
 const {terrain,ecology,shore,water,debug,signal,invalidate}=ctx;
 signal.throwIfAborted();const bindings=[],records=new Map(),previous=debug.r5Color;
 let disposed=false,published;
 function dispose(){if(disposed)return;disposed=true;signal.removeEventListener('abort',dispose);
  for(const [mesh,source,copy] of bindings)if(mesh.material===copy)mesh.material=source;
  for(const r of records.values())r.material.dispose();
  if(debug.r5Color===published){if(previous===undefined)delete debug.r5Color;else debug.r5Color=previous;}invalidate();
 }
 try{
  for(const group of [terrain.group,ecology.group,shore.group,water.group])group.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const original=mesh.material;if(Array.isArray(original))throw Error('R5 pigment expects single materials');
   let r=records.get(original);
   if(!r){
    const material=original.clone(),callback=original.onBeforeCompile,key=original.customProgramCacheKey;
    if(original.userData.ecosystemWind)material.userData.ecosystemWind=original.userData.ecosystemWind;
    material.name=original.name+' / R5 pigment';
    // Stronger grazing sunlight must not turn the retained quiet bay into a
    // broad highlight. Only its existing physical specular gain is balanced.
    if(!original.userData.eGround)material.specularIntensity=.18;
    r={material,original,kind:original.userData.eGround?.kind??'water',compiles:0,uniforms:null,changed:[],clockPreserved:null};records.set(original,r);
    material.customProgramCacheKey=()=>key.call(original)+'|'+REVISION;
    material.onBeforeCompile=function(shader,renderer){callback.call(original,shader,renderer);
     const time=shader.uniforms.ecosystemTime??shader.uniforms.waterTime;
     for(const [name,hex]of Object.entries(PALETTE))if(shader.uniforms[name]){shader.uniforms[name]={value:new T.Color(hex)};if(!r.changed.includes(name))r.changed.push(name);}
     r.clockPreserved=time===(shader.uniforms.ecosystemTime??shader.uniforms.waterTime);
     const wind=original.userData.ecosystemWind?.time;if(wind&&shader.uniforms.ecosystemTime!==wind)throw Error('R5 pigment lost source wind clock');
     r.uniforms=shader.uniforms;r.compiles++;
    };
   }
   bindings.push([mesh,original,r.material]);mesh.material=r.material;
  });
  published={revision:REVISION,palette:PALETTE,records:[...records.values()],bindings,addedLights:0,addedTextures:0,geometryChanges:0,postProcessing:false,dispose};
  debug.r5Color=published;signal.addEventListener('abort',dispose,{once:true});invalidate();return {dispose};
 }catch(error){dispose();throw error;}
}
