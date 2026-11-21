import * as T from 'three';

export const REVISION='r4-water-clear-night-2';
const PALETTE={deep:'#193955',shallow:'#3c727d',lavender:'#596b94',stroke:'#739fac'};
function replaceOnce(source,anchor,next){
 if(source.indexOf(anchor)<0||source.indexOf(anchor)!==source.lastIndexOf(anchor))throw Error('R4 water shader anchor changed: '+anchor.slice(0,90));
 return source.replace(anchor,next);
}
export function createLook(original,ctx){
 const lighting=ctx.world.userData.r4Lighting,house=ctx.debug.houseLighting;
 const emitters=house?.emitters;
 if(house?.space!=='planet-local (world group)'||!Array.isArray(emitters)||!emitters.length)throw Error('R4 water requires planet-local houseLighting emitters');
 for(const e of emitters)if(![...e.position,...e.normal,...e.extent,e.strength].every(Number.isFinite)||e.position.length!==3||e.normal.length!==3||e.extent.length!==2)throw Error('Invalid house emitter '+e.name);
 const count=emitters.length;

 const compile=original.onBeforeCompile,key=original.customProgramCacheKey;
 const material=original.clone();
 material.name='R4 / clear night water, retained ripple field';
 material.roughness=.48;material.specularIntensity=.26;
 if(original.onBeforeRender)material.onBeforeRender=original.onBeforeRender;
 let compiled=null,upstream=null;
 const lamps={
  dLampPosition:{value:emitters.map(()=>new T.Vector3())},
  dLampNormal:{value:emitters.map(()=>new T.Vector3())},
  dLampColor:{value:emitters.map(e=>new T.Color(e.colorSRGB??house.colorSRGB))},
  dLampPower:{value:emitters.map(e=>e.strength*Math.sqrt(e.extent[0]*e.extent[1])*3.4)},
 };
 function sync(){
  ctx.world.updateWorldMatrix(true,false);
  emitters.forEach((e,i)=>{
   lamps.dLampPosition.value[i].fromArray(e.position).applyMatrix4(ctx.world.matrixWorld);
   lamps.dLampNormal.value[i].fromArray(e.normal).transformDirection(ctx.world.matrixWorld);
   lamps.dLampColor.value[i].set(e.colorSRGB??house.colorSRGB);
   lamps.dLampPower.value[i]=e.strength*Math.sqrt(e.extent[0]*e.extent[1])*3.4;
  });
 }
 sync();
 const owned={
  r4WaterSkyTint:{value:new T.Color(lighting.fill.color).lerp(new T.Color('#c0d6eb'),.35)},
  r4WaterWarmGain:{value:.55},
 };
 material.onBeforeCompile=function(shader,renderer){
  compile.call(original,shader,renderer);
  // Dynamic upstream uniforms intentionally keep their exact objects: the host
  // clock and R1's existing render callback continue to own their updates.
  upstream={...shader.uniforms};
  for(const [name,hex]of Object.entries(PALETTE))shader.uniforms['water_'+name]={value:new T.Color(hex)};
  Object.assign(shader.uniforms,owned,lamps);
  const define=shader.fragmentShader.match(/#define D_LAMP_COUNT [0-9]+/);
  if(!define)throw Error('Missing retained lamp count');
  shader.fragmentShader=replaceOnce(shader.fragmentShader,define[0],'#define D_LAMP_COUNT '+count);
  shader.fragmentShader='uniform vec3 r4WaterSkyTint;\nuniform float r4WaterWarmGain;\n'+shader.fragmentShader;
  shader.fragmentShader=replaceOnce(shader.fragmentShader,
   'roughnessFactor=clamp(roughness+.08*wash+.08*shore,.25,.60);',
   'roughnessFactor=clamp(roughness+.055*wash+.07*shore+.035*stream,.32,.72);');
  shader.fragmentShader=replaceOnce(shader.fragmentShader,
   'texture2D(dSkyPainting,clamp(uv,.001,.999),2.8)',
   'texture2D(dSkyPainting,clamp(uv,.001,.999),3.8)');
  shader.fragmentShader=replaceOnce(shader.fragmentShader,
   'return mix(sky,sky*.62+paint*.48,valid*.62);',
   'return mix(sky,sky*.68+paint*.38,valid*.58)*mix(vec3(1.),r4WaterSkyTint,.24);');
  shader.fragmentShader=replaceOnce(shader.fragmentShader,
   'outgoingLight+=dSky*(.055+dFresnel*.52)*(1.-.24*dChannelCore);',
   'outgoingLight+=dSky*(.038+dFresnel*.36)*(1.-.18*dChannelCore);');
  shader.fragmentShader=replaceOnce(shader.fragmentShader,'float lobe=pow(alignment,26.);','float lobe=pow(alignment,18.);');
  shader.fragmentShader=replaceOnce(shader.fragmentShader,
   'outgoingLight+=dWarm*(.52+.85*dFresnel)*smoothstep(.005,.065,depth);',
   'float r4WarmEnergy=dot(dWarm,vec3(.2126,.7152,.0722));\n      dWarm/=1.+r4WarmEnergy*1.4;\n      outgoingLight+=dWarm*r4WaterWarmGain*(.52+.85*dFresnel)*smoothstep(.005,.065,depth);');
  shader.fragmentShader=replaceOnce(shader.fragmentShader,'pigment*=1.-dChannelCore*.28;','pigment*=1.-dChannelCore*.18;');
  compiled=shader;
 };
 material.customProgramCacheKey=()=>key.call(original)+'-'+REVISION;
 return {material,sync,houseRevision:house.revision,emitters,inspect:()=>({shader:compiled,upstream,owned,lamps,clock:compiled?.uniforms.waterTime,revision:REVISION})};
}
