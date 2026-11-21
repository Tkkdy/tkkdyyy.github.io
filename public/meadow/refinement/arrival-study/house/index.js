import * as T from 'three';
export const REVISION='arrival-house-reference-relight-2';
export const PARAMETERS=Object.freeze({roofAmbient:.38,wallAmbient:.38,wrap:.30,maxGain:2.4});
// An authored-light transport approximation: retain COMBINED's local cavities,
// divide by reference diffuse and multiply by the same live-light model.
// This is deliberately NOT an intrinsic-albedo extraction or a GI solution.
export async function install(ctx){
 const {world,assets,renderer,debug,signal,invalidate}=ctx;
 signal?.throwIfAborted();
 const key=world.getObjectByName('R1 twilight key');
 const meshes=[assets.cottage.getObjectByName('Light transfer / B retained roof'),assets.cottage.getObjectByName('cottage_painted_scene')];
 if(!key||meshes.some(m=>!m?.material?.isMeshBasicMaterial))throw Error('A requires the untouched C/N roof and facade');
 assets.cottage.updateWorldMatrix(true,false);key.updateWorldMatrix(true,false);key.target.updateWorldMatrix(true,false);
 const initialIntensity=key.intensity, initialColor=key.color.clone();
 const keyPoint=new T.Vector3(),targetPoint=new T.Vector3(),directionScratch=new T.Vector3(),inverseCottage=new T.Matrix4();
 const direction=()=>directionScratch.copy(keyPoint.setFromMatrixPosition(key.matrixWorld)).sub(targetPoint.setFromMatrixPosition(key.target.matrixWorld)).transformDirection(inverseCottage.copy(assets.cottage.matrixWorld).invert());
 const reference=direction().clone(), live=reference.clone(), color=new T.Vector3(1,1,1), records=[];
 let disposed=false,updates=0,lastIntensity=NaN,lastVisible=null;const lastColor=new T.Color(-1,-1,-1);
 for(let i=0;i<meshes.length;i++){
  const mesh=meshes[i],source=mesh.material,material=source.clone(),compile=source.onBeforeCompile,cacheKey=source.customProgramCacheKey();
  const record={mesh,source,material,shader:null,compiles:0,kind:i===0?'roof':'facade'};records.push(record);
  material.name=source.name+' / A normalized authored transport';
  material.customProgramCacheKey=()=>cacheKey+'|'+REVISION+'|'+record.kind;
  material.onBeforeCompile=(shader,r)=>{
   compile.call(source,shader,r);
   shader.uniforms.aReference={value:reference};shader.uniforms.aLive={value:live};shader.uniforms.aKeyColor={value:color};shader.uniforms.aStrength={value:key.visible?key.intensity/initialIntensity:0};
   shader.fragmentShader='uniform vec3 aReference,aLive,aKeyColor;\nuniform float aStrength;\n'+shader.fragmentShader;
   const anchor='#include <opaque_fragment>';
   if(shader.fragmentShader.split(anchor).length!==2)throw Error('A lost opaque shader hook');
   shader.fragmentShader=shader.fragmentShader.replace(anchor,`
    vec3 aN=normalize(vHouseNormal);
    float aRef=max(0.,(dot(aN,aReference)+.30)/1.30);
    float aNow=max(0.,(dot(aN,aLive)+.30)/1.30);
    // Local finite window/door warmth is retained when the remote key is off.
    float aAmbient=${i===0?'.38':'.38 + min(r5spill*.40,.50)'};
    vec3 aFloor=vec3(.69,.82,1.)*aAmbient;
    vec3 aResponse=(aFloor+aKeyColor*aNow*aStrength)/(aFloor+vec3(aRef));
    outgoingLight*=clamp(aResponse,vec3(.035),vec3(2.4));
    ${anchor}`);
   record.shader=shader;record.compiles++;
  };
  mesh.material=material;
 }
 function updateLighting(){
  if(disposed)return false;assets.cottage.updateWorldMatrix(true,false);key.updateWorldMatrix(true,false);key.target.updateWorldMatrix(true,false);
  const d=direction();if(live.equals(d)&&lastIntensity===key.intensity&&lastVisible===key.visible&&lastColor.equals(key.color))return false;lastIntensity=key.intensity;lastVisible=key.visible;lastColor.copy(key.color);updates++;
  live.copy(d);color.set(key.color.r/initialColor.r,key.color.g/initialColor.g,key.color.b/initialColor.b);
  for(const r of records)if(r.shader)r.shader.uniforms.aStrength.value=key.visible?Math.max(0,key.intensity/initialIntensity):0;
  invalidate?.();return true;
 }
 function inspect(){return{revision:REVISION,parameters:PARAMETERS,disposed,updates,referenceDirection:reference.toArray(),liveDirection:live.toArray(),intensityRatio:key.intensity/initialIntensity,materials:records.map(r=>({kind:r.kind,compiles:r.compiles,type:r.material.type})),preservation:{geometry:true,combinedTexture:true,normalPoseAppearance:'identity ratio',windows:true,tree:true,ground:true,globalRig:true},cost:{addedTextures:0,addedGeometry:0,addedDrawCalls:0},limits:'Hybrid COMBINED reference-normalized wrapped diffuse. Baked cavity and cast-occlusion shapes remain authored; no new moving cast shadow on roof/facade, no intrinsic albedo recovery or GI. Native foundation/tree/ground shadows remain live.'};}
 function dispose(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);for(const r of records){if(r.mesh.material===r.material)r.mesh.material=r.source;r.material.dispose();}invalidate?.();}
 signal?.addEventListener('abort',dispose,{once:true});updateLighting();return{updateLighting,inspect,dispose};
}
