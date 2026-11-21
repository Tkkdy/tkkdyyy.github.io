import * as T from 'three';

export const REVISION='r5-house-directed-windowlight-2';
export const PARAMETERS=Object.freeze({
  skyGain:.40,keyGain:.62,rimGain:.18,fillGain:.26,roofKeyGain:1.65,
  bounceGain:1.45,windowCutoff:1.75,lanternCutoff:2.15,
  emissionGain:[.84,.76,.62],
});
const PAINT_HOOK='diffuseColor.rgb=pigment*(illumination+houseAmber*min(spill,1.15)*1.18);';
const EMISSION_HOOK='#include <lights_physical_fragment>';
const inheritedNames=['houseKey','houseRim','houseCool','houseWarm','houseRimColor','houseAmber','r4HouseFill','r4HouseFillDirection'];
const vector=a=>'vec3('+a.map(v=>Number(v).toFixed(7)).join(',')+')';
const scalar=n=>Number(n).toFixed(7);
function replaceOnce(source,needle,replacement) {
  if(source.split(needle).length!==2)throw Error('R5 house: expected one retained shader hook: '+needle);
  return source.replace(needle,replacement);
}
function readParameters(ctx) {
  const {world,assets,renderer}=ctx;
  world.updateMatrixWorld(true);assets.cottage.updateWorldMatrix(true,true);
  const inverse=assets.cottage.matrixWorld.clone().invert();
  const lights=Object.fromEntries(['key','rim','fill'].map(id=>[id,world.getObjectByName('R1 twilight '+id)]));
  const sky=world.children.find(o=>o.isHemisphereLight);
  const porch=world.getObjectByName('Astra cottage / outward porch light');
  if(!sky||Object.values(lights).some(x=>!x?.isDirectionalLight))throw Error('R5 house requires retained actual lighting');
  const direction=light=>light.getWorldPosition(new T.Vector3()).sub(light.target.getWorldPosition(new T.Vector3())).transformDirection(inverse);
  const color=(light,gain,reference,whiteMix=0)=>light.color.clone().lerp(new T.Color(1,1,1),whiteMix).multiplyScalar(gain*Math.sqrt(Math.max(0,light.intensity)/reference));
  return {
    r5HouseKey:direction(lights.key),r5HouseRim:direction(lights.rim),r5HouseFillDirection:direction(lights.fill),
    r5HouseSky:color(sky,PARAMETERS.skyGain,1.10,.18),
    r5HouseKeyColor:color(lights.key,PARAMETERS.keyGain,1.65,.12),
    r5HouseRimColor:color(lights.rim,PARAMETERS.rimGain,1.05,.05),
    r5HouseFillColor:color(lights.fill,PARAMETERS.fillGain,.62,.05),
    r5HouseAmber:new T.Color('#ffc27e'),
    r5HouseBounceGain:PARAMETERS.bounceGain,r5HouseRoofKeyGain:PARAMETERS.roofKeyGain,
    r5HouseLanternGain:Math.sqrt(Math.max(0,porch?.intensity??17)/17),
    r5HouseEmissionGain:new T.Vector3(...PARAMETERS.emissionGain),
    r5HouseExposureCompensation:T.MathUtils.clamp(1.02/renderer.toneMappingExposure,.65,1.25),
  };
}
const LIGHT_FUNCTION=[
  'float r5HouseArea(vec3 p,vec3 n,vec3 center,vec3 outward,vec2 extent,float cutoff){',
  'vec3 tangent=vec3(outward.z,0.,-outward.x);vec3 delta=p-center;',
  // Nearest point on a finite luminous rectangle; no light behind its facade.
  'vec3 source=center+tangent*clamp(dot(delta,tangent),-extent.x*.42,extent.x*.42);',
  'source.y+=clamp(delta.y,-extent.y*.42,extent.y*.42);source+=outward*.22;',
  'vec3 toLight=source-p;float d2=dot(toLight,toLight);',
  'float facing=max(0.,dot(n,toLight*inversesqrt(max(d2,.0001))));',
  'float facade=1.-smoothstep(.12,.25,-dot(delta,outward));',
  'float reach=1.-smoothstep(cutoff*.70,cutoff,sqrt(d2));',
  'return facade*reach*facing/(1.+d2/.48);}',
].join('\n');
function paintResponse(record,ctx) {
  const planetToLocal=new T.Matrix4().multiplyMatrices(ctx.assets.cottage.matrixWorld.clone().invert(),ctx.world.matrixWorld);
  const emitters=record.emitters;
  if(emitters.length!==9||emitters.some(e=>!e.local||!e.extent))throw Error('R5 house requires nine measured retained emitters');
  const terms=emitters.map(e=>{
    // Transform the published, measured facade normal into cottage-local space.
    const q=e.local;
    const normal=new T.Vector3(...e.normal).transformDirection(planetToLocal).toArray();
    const strength=e.sourceStrength??e.strength;
    const cutoff=e.role==='lantern'?PARAMETERS.lanternCutoff:e.role==='fanlight'?1.32:PARAMETERS.windowCutoff;
    return 'r5spill+=r5HouseArea(p,n,'+vector(q)+','+vector(normal)+',vec2('+e.extent.map(scalar).join(',')+'),'+scalar(cutoff)+')*'+scalar(strength)+(e.role==='lantern'?'*r5HouseLanternGain':'')+';';
  });
  return [
    'float r5sky=smoothstep(-.45,.90,n.y);',
    'vec3 r5light=r5HouseSky*(.68+.32*r5sky)+vec3(.032,.040,.060);',
    'float r5upper=smoothstep(1.98,2.30,p.y);',
    'r5light+=r5HouseKeyColor*max(0.,dot(n,r5HouseKey))*mix(1.,r5HouseRoofKeyGain,r5upper);',
    'r5light+=r5HouseRimColor*pow(max(0.,dot(n,r5HouseRim)),1.35);',
    'r5light+=r5HouseFillColor*max(0.,dot(n,r5HouseFillDirection));',
    'float r5spill=0.;',...terms,
    'r5light+=r5HouseAmber*min(r5spill*r5HouseBounceGain,.95);',
    'diffuseColor.rgb=pigment*r5light;',
  ].join('\n');
}
function candidate(original,paint,values,response,diagnostics) {
  const copy=original.clone(),callback=original.onBeforeCompile,cacheKey=original.customProgramCacheKey;
  copy.name=original.name+' / R5 S1 directed light';
  copy.onBeforeCompile=function(shader,renderer) {
    callback.call(original,shader,renderer);diagnostics.callbackInvocations++;
    if(!shader.fragmentShader.includes('varying vec3 vHousePoint;'))throw Error('R5 house lost retained coordinates');
    // Retain callbacks while detaching mutable wrappers and values.
    for(const name of inheritedNames)if(shader.uniforms[name]){
      const value=shader.uniforms[name].value;
      shader.uniforms[name]={value:value?.clone?value.clone():value};
    }
    const prefix=paint?
      'uniform vec3 r5HouseKey,r5HouseRim,r5HouseFillDirection,r5HouseSky,r5HouseKeyColor,r5HouseRimColor,r5HouseFillColor,r5HouseAmber;\nuniform float r5HouseBounceGain,r5HouseLanternGain,r5HouseRoofKeyGain;\n'+LIGHT_FUNCTION:
      'uniform vec3 r5HouseEmissionGain;\nuniform float r5HouseExposureCompensation;\n';
    for(const [name,value]of Object.entries(values))shader.uniforms[name]={value:value?.clone?value.clone():value};
    shader.fragmentShader=prefix+shader.fragmentShader;
    if(paint){
      shader.fragmentShader=replaceOnce(shader.fragmentShader,PAINT_HOOK,response);
      // Fill is included once above; keep the R4 hook with neutral extra fill.
      if(shader.uniforms.r4HouseFill)shader.uniforms.r4HouseFill.value.setRGB(0,0,0);
    }else{
      shader.fragmentShader=replaceOnce(shader.fragmentShader,EMISSION_HOOK,
        'totalEmissiveRadiance*=r5HouseEmissionGain*r5HouseExposureCompensation;\n'+EMISSION_HOOK);
    }
  };
  copy.customProgramCacheKey=()=>cacheKey.call(original)+'|'+REVISION+'|'+(paint?'paint':'window');
  return copy;
}
export function install(ctx) {
  const {assets,debug,signal,invalidate}=ctx;
  signal.throwIfAborted();
  if(debug.r5House)throw Error('R5 house already installed');
  const meshes=assets.cottage.children.filter(o=>o.isMesh);
  if(meshes.length!==3||!meshes.some(o=>o.name==='cottage_painted_scene'))throw Error('R5 house expects retained three-mesh cottage');
  if(!debug.r4House||!debug.houseLighting?.emitters)throw Error('R5 house must be installed after R4 house');
  const previous={record:debug.houseLighting,diagnostics:debug.r5House},owned=[];
  let disposed=false,record,diagnostics;
  const dispose=()=>{
    if(disposed)return;disposed=true;signal.removeEventListener('abort',dispose);
    for(const {mesh,original,copy}of [...owned].reverse()){
      if(mesh.material===copy)mesh.material=original;
      copy.dispose();
    }
    if(debug.houseLighting===record)debug.houseLighting=previous.record;
    if(debug.r5House===diagnostics){
      if(previous.diagnostics===undefined)delete debug.r5House;else debug.r5House=previous.diagnostics;
    }
    invalidate?.();
  };
  try{
    const values=readParameters(ctx),response=paintResponse(previous.record,ctx);
    const lighting=debug.r5Lighting??ctx.world.userData.r5Lighting??debug.r4Lighting;
    diagnostics={revision:REVISION,stage:'S1',lightingRevision:lighting?.revision??'actual-scene-lights',
      callbackInvocations:0,materialCopies:3,addedLights:0,addedObjects:0,
      parameterSpace:'cottage-local directions; linear RGB',
      parameters:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,v?.toArray?v.toArray():v]))};
    for(const mesh of meshes){
      const original=mesh.material,copy=candidate(original,mesh.name==='cottage_painted_scene',values,response,diagnostics);
      owned.push({mesh,original,copy});mesh.material=copy;
    }
    record=structuredClone(previous.record);
    record.sourceRevision=previous.record.revision;record.revision=REVISION;
    const porch=ctx.world.getObjectByName('Astra cottage / outward porch light');
    const toPlanet=ctx.world.matrixWorld.clone().invert();
    if(porch?.isSpotLight){
      const position=porch.getWorldPosition(new T.Vector3()).applyMatrix4(toPlanet);
      const target=porch.target.getWorldPosition(new T.Vector3()).applyMatrix4(toPlanet);
      record.porch={...record.porch,position:position.toArray(),target:target.toArray(),
        direction:target.clone().sub(position).normalize().toArray(),
        local:porch.position.toArray(),colorSRGB:'#'+porch.color.getHexString(),
        intensity:porch.intensity,distance:porch.distance,angle:porch.angle,
        penumbra:porch.penumbra,decay:porch.decay,owner:debug.r5Lighting?'r5-lighting':'r4-lighting'};
    }
    const reflectionScale=(.2126*PARAMETERS.emissionGain[0]+.7152*PARAMETERS.emissionGain[1]+.0722*PARAMETERS.emissionGain[2])*values.r5HouseExposureCompensation;
    record.emitters=record.emitters.map(e=>({...e,sourceStrength:e.strength,
      strength:e.strength*reflectionScale,materialRevision:REVISION}));
    record.reflectionResponse={strengthScale:reflectionScale,meaning:'approximate luminance coefficient, not integrated radiometric power'};
    record.lightingRevision=diagnostics.lightingRevision;record.exposure=ctx.renderer.toneMappingExposure;
    record.emissionResponse={...record.emissionResponse,r5GainLinear:[...PARAMETERS.emissionGain],
      r5ExposureCompensation:values.r5HouseExposureCompensation,retainedPaneGradient:true};
    record.localBounce={implementation:'finite rectangle nearest-point approximation, facade and normal bounded',
      windowCutoff:PARAMETERS.windowCutoff,lanternCutoff:PARAMETERS.lanternCutoff,gain:PARAMETERS.bounceGain,
      colorSRGB:'#ffc27e',materialOnly:true};
    // Publish a new record; earlier consumers keep their own references.
    record.limitations='Baked texture remains; local bounce is analytic and not ray-traced visibility. Ground/foliage and real lights belong to other owners.';
    debug.houseLighting=record;debug.r5House=diagnostics;
    signal.addEventListener('abort',dispose,{once:true});invalidate?.();
    return{dispose};
  }catch(error){dispose();throw error;}
}
