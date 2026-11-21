import * as T from 'three';

export const REVISION='r4-house-warm-matte-1';
const OWNED_LIGHT_UNIFORMS=['houseKey','houseRim','houseCool','houseWarm','houseRimColor','houseAmber'];
const PAINT_RESPONSE=`
  vec3 r4p=vHousePoint,r4n=normalize(vHouseNormal);
  float r4roof=smoothstep(1.98,2.30,r4p.y)*smoothstep(.20,.67,r4n.y);
  float r4stone=1.-smoothstep(.26,.54,r4p.y);
  float r4wall=max(1.-smoothstep(.014,.060,abs(r4p.z-1.35)),1.-smoothstep(.014,.060,abs(r4p.z+1.31)));
  r4wall=max(r4wall,1.-smoothstep(.014,.060,abs(abs(r4p.x)-1.71)));
  r4wall*=1.-smoothstep(.20,.60,abs(r4n.y));
  r4wall*=smoothstep(.29,.52,r4p.y);
  float r4wood=(1.-smoothstep(.34,.49,abs(r4p.x)))*smoothstep(.27,.40,r4p.y);
  r4wood*=1.-smoothstep(1.60,1.83,r4p.y);
  r4wood*=smoothstep(1.37,1.43,r4p.z);
  vec3 r4color=diffuseColor.rgb;
  float r4value=dot(r4color,vec3(.2126,.7152,.0722));
  // Compress broad baked highlight bands without blurring their detail.
  float r4compression=r4roof*.25+r4stone*.34+r4wall*.10+r4wood*.12;
  r4color/=1.+r4color*r4compression;
  r4color=mix(r4color,vec3(r4value)*vec3(.97,1.01,1.04),r4wall*.14);
  r4color=mix(r4color,vec3(r4value),r4roof*.07);
  r4color*=mix(vec3(1.),vec3(1.025,.995,.97),r4wood*.45);
  // Lift dark crevices locally, leaving midtone texture contrast intact.
  float r4dark=1.-smoothstep(.014,.095,r4value);
  vec3 r4floor=mix(vec3(.82,.87,1.00),vec3(1.,.88,.76),r4wood);
  float r4lift=r4roof*.009+r4stone*.012+r4wall*.004+r4wood*.003;
  r4color+=r4floor*r4lift*r4dark;
  float r4fill=max(0.,dot(r4n,r4HouseFillDirection));
  diffuseColor.rgb=r4color*(vec3(1.)+r4HouseFill*r4fill);
`;
const EMISSION_RESPONSE=`
  float r4core=smoothstep(.50,1.30,dot(totalEmissiveRadiance,vec3(.2126,.7152,.0722)));
  totalEmissiveRadiance*=mix(vec3(1.),r4HouseCoreGain,r4core);
`;
function colorResponse(color,whiteMix,gain) {
  return color.clone().lerp(new T.Color(1,1,1),whiteMix).multiplyScalar(gain);
}
function requireChunk(shader,chunk) {
  if(!shader.includes(chunk))throw Error('R4 house: retained shader hook unavailable: '+chunk);
}
function parameters(world,cottage) {
  world.updateMatrixWorld(true);cottage.updateWorldMatrix(true,true);
  const inverse=cottage.matrixWorld.clone().invert();
  const lights=Object.fromEntries(['key','rim','fill'].map(id=>[id,world.children.find(o=>o.name==='R1 twilight '+id)]));
  const hemi=world.children.find(o=>o.isHemisphereLight);
  const porch=world.getObjectByName('Astra cottage / outward porch light');
  if(!hemi||Object.values(lights).some(o=>!o))throw Error('R4 house requires retained A lights');
  const direction=light=>light.getWorldPosition(new T.Vector3())
    .sub(light.target.getWorldPosition(new T.Vector3())).transformDirection(inverse);
  return {
    houseKey:direction(lights.key),houseRim:direction(lights.rim),
    houseCool:colorResponse(hemi.color,.36,.60*Math.pow(hemi.intensity/.95,.35)),
    houseWarm:colorResponse(lights.key.color,.78,.76*Math.pow(lights.key.intensity/2.2,.22)),
    houseRimColor:colorResponse(lights.rim.color,.25,.075*Math.sqrt(lights.rim.intensity/.8)),
    houseAmber:porch?.color.clone()??new T.Color('#ffd09a'),
    r4HouseFillDirection:direction(lights.fill),
    r4HouseFill:lights.fill.color.clone().multiplyScalar(.12*lights.fill.intensity/.62),
    r4HouseCoreGain:new T.Vector3(.92,.90,.88),
  };
}
function materialCandidate(original,paint,values,diagnostics) {
  const copy=original.clone(),inheritedCallback=original.onBeforeCompile;
  const inheritedKey=original.customProgramCacheKey;
  copy.name=original.name+' / R4 matte response';
  copy.onBeforeCompile=function(shader,renderer) {
    inheritedCallback.call(original,shader,renderer);
    diagnostics.callbackInvocations++;
    if(!shader.fragmentShader.includes('varying vec3 vHousePoint;'))throw Error('R4 house requires inherited house coordinates');
    if(paint) {
      // Rebind candidate uniforms; do not mutate R1's shared closure values.
      for(const name of OWNED_LIGHT_UNIFORMS) {
        if(!shader.uniforms[name])throw Error('R4 house missing inherited light uniform '+name);
        shader.uniforms[name]={value:values[name].clone()};
      }
      shader.uniforms.r4HouseFill={value:values.r4HouseFill.clone()};
      shader.uniforms.r4HouseFillDirection={value:values.r4HouseFillDirection.clone()};
      shader.fragmentShader='uniform vec3 r4HouseFill,r4HouseFillDirection;\n'+shader.fragmentShader;
      const hook='#include <alphamap_fragment>';requireChunk(shader.fragmentShader,hook);
      shader.fragmentShader=shader.fragmentShader.replace(hook,PAINT_RESPONSE+'\n'+hook);
    } else {
      shader.uniforms.r4HouseCoreGain={value:values.r4HouseCoreGain.clone()};
      shader.fragmentShader='uniform vec3 r4HouseCoreGain;\n'+shader.fragmentShader;
      const hook='#include <lights_physical_fragment>';requireChunk(shader.fragmentShader,hook);
      shader.fragmentShader=shader.fragmentShader.replace(hook,EMISSION_RESPONSE+'\n'+hook);
    }
  };
  copy.customProgramCacheKey=()=>inheritedKey.call(original)+'|'+REVISION+'|'+(paint?'paint':'emission');
  return copy;
}
function lightingRecord(previous,ctx,values) {
  const {world,assets,renderer}=ctx;
  const record=structuredClone(previous);
  const localToPlanet=new T.Matrix4().multiplyMatrices(world.matrixWorld.clone().invert(),assets.cottage.matrixWorld);
  const porch=world.getObjectByName('Astra cottage / outward porch light');
  const point=vector=>vector.clone().applyMatrix4(localToPlanet).toArray();
  record.sourceRevision=previous.revision;record.revision=REVISION;
  record.lightingRevision=world.userData.r4Lighting?.revision??'actual-scene-lights';
  record.exposure=renderer.toneMappingExposure;
  record.color=record.colorSRGB='#'+values.houseAmber.getHexString();
  record.emissionResponse={retainedPaneGradient:true,coreGainLinear:values.r4HouseCoreGain.toArray(),
    coreLuminanceRange:[.50,1.30],edgeGain:1,reflectionStrengthScale:.94};
  record.emitters=record.emitters.map(e=>({...e,colorSRGB:record.colorSRGB,strength:e.strength*.94,
    sourceStrength:e.strength,materialRevision:REVISION}));
  if(porch?.isSpotLight)record.porch={...record.porch,position:point(porch.position),local:porch.position.toArray(),
    target:point(porch.target.position),direction:porch.target.position.clone().sub(porch.position).normalize().transformDirection(localToPlanet).toArray(),
    colorSRGB:'#'+porch.color.getHexString(),intensity:porch.intensity,distance:porch.distance,
    angle:porch.angle,penumbra:porch.penumbra,decay:porch.decay,castsShadow:porch.castShadow,owner:'r4-lighting'};
  record.limitations='Retained baked paint and facade-bounded bounce; candidate metadata does not update already-installed R1 water uniforms.';
  return record;
}
export function install(ctx) {
  const {assets,world,debug,signal,invalidate}=ctx;
  signal.throwIfAborted();
  const meshes=assets.cottage.children.filter(o=>o.isMesh);
  if(meshes.length!==3||!meshes.some(o=>o.name==='cottage_painted_scene'))throw Error('R4 house expects three retained cottage meshes');
  if(!debug.houseLighting?.emitters)throw Error('R4 house requires retained houseLighting');
  const previousLighting=debug.houseLighting,previousDebug=debug.r4House,owned=[];
  let disposed=false,published,diagnostics;
  const dispose=()=>{
    if(disposed)return;disposed=true;signal.removeEventListener('abort',dispose);
    for(const {mesh,original,copy} of [...owned].reverse()) {
      if(mesh.material===copy)mesh.material=original;
      copy.dispose();
    }
    if(debug.houseLighting===published)debug.houseLighting=previousLighting;
    if(debug.r4House===diagnostics) {
      if(previousDebug===undefined)delete debug.r4House;else debug.r4House=previousDebug;
    }
    invalidate?.();
  };
  try {
    const values=parameters(world,assets.cottage);
    diagnostics={revision:REVISION,lightingRevision:world.userData.r4Lighting?.revision??null,
      callbackInvocations:0,addedLights:0,addedObjects:0,materialCopies:3,
      parameterSpace:'cottage-local directions; linear colors',
      parameters:Object.fromEntries(Object.entries(values).map(([name,v])=>[name,v.toArray()]))};
    for(const mesh of meshes) {
      const original=mesh.material,copy=materialCandidate(original,mesh.name==='cottage_painted_scene',values,diagnostics);
      owned.push({mesh,original,copy});mesh.material=copy;
    }
    published=lightingRecord(previousLighting,ctx,values);
    debug.houseLighting=published;debug.r4House=diagnostics;
    signal.addEventListener('abort',dispose,{once:true});invalidate?.();
    return {dispose};
  } catch(error) {dispose();throw error;}
}
