import * as T from 'three';
export const REVISION='r8-e-luminous-night-2';
// Existing lights and linear material response. No exposure or postprocessing change.
export const LIGHTING=Object.freeze({
 hemisphere:{sky:'#8fa5db',ground:'#393a61',intensity:1.00},
 key:{color:'#ffd09a',intensity:2.20,shadowIntensity:.34},
 rim:{color:'#ffb974',intensity:2.70},
 fill:{color:'#a3b9ef',intensity:1.10},
 porch:{color:'#ffd09a',intensity:42,distance:5.2},
 air:{color:'#233b60',density:.008},
});
export function readLights(world){
 const lights={sky:world.children.find(o=>o.isHemisphereLight),porch:world.getObjectByName('Astra cottage / outward porch light')};
 for(const id of ['key','rim','fill'])lights[id]=world.getObjectByName('R1 twilight '+id);
 if(!lights.sky||!lights.porch||['key','rim','fill'].some(id=>!lights[id]?.isDirectionalLight))throw Error('R8 E requires the retained five-light rig');
 return lights;
}
export function direction(light,object){return light.getWorldPosition(new T.Vector3()).sub(light.target.getWorldPosition(new T.Vector3())).transformDirection(object.matrixWorld.clone().invert());}
const color=(light,gain,reference,white=0)=>light.color.clone().lerp(new T.Color(1,1,1),white).multiplyScalar(gain*Math.sqrt(Math.max(0,light.intensity)/reference));
const tint=(source,amount)=>{const c=source.clone(),l=.2126*c.r+.7152*c.g+.0722*c.b;return new T.Color(1,1,1).lerp(c.multiplyScalar(1/Math.max(.001,l)),amount);};
export function houseUniforms(lights,object){return {
 r5HouseKey:direction(lights.key,object),r5HouseRim:direction(lights.rim,object),r5HouseFillDirection:direction(lights.fill,object),
 r5HouseSky:color(lights.sky,.35,1.10,.12),r5HouseKeyColor:color(lights.key,.59,1.65,.12),
 r5HouseRimColor:color(lights.rim,.17,1.05,.05),r5HouseFillColor:color(lights.fill,.29,.62,.05),
 r5HouseAmber:new T.Color('#ffd098'),r5HouseBounceGain:2.70,r5HouseRoofKeyGain:1.42,
 r5HouseLanternGain:Math.sqrt(lights.porch.intensity/17),
};}
export function gardenUniforms(lights,object){
 const values={gardenKey:direction(lights.key,object),gardenRim:direction(lights.rim,object),r4GardenWarm:tint(lights.key.color,.34),r4GardenRimTint:tint(lights.rim.color,.22),r4GardenSky:tint(lights.sky.color,.26),r5GardenSky:tint(lights.sky.color,.42)};
 for(const [id,reference,amount] of [['key',1.65,.68],['rim',1.05,.65],['fill',.62,.36]]){
  const name=id[0].toUpperCase()+id.slice(1);values['r5Garden'+name]=direction(lights[id],object);values['r5Garden'+name+'Tint']=tint(lights[id].color,amount);values['r5Garden'+name+'Strength']=T.MathUtils.clamp(Math.sqrt(lights[id].intensity/reference),0,1.8);
 }
 const box=new T.Box3().setFromBufferAttribute(object.geometry.attributes.position),extent=box.getSize(new T.Vector3()).multiplyScalar(.5),d=values.r5GardenKey;
 values.r5GardenSpan=Math.max(.001,extent.x*Math.abs(d.x)+extent.y*Math.abs(d.y)+extent.z*Math.abs(d.z));return values;
}
function once(shader,from,to){if(shader.fragmentShader.split(from).length!==2)throw Error('R8 E shader contract: '+from.slice(0,90));shader.fragmentShader=shader.fragmentShader.replace(from,to);}
export function cloneResponse(source,kind,values,record){
 const candidate=source.clone(),compile=source.onBeforeCompile,key=source.customProgramCacheKey();
 if(source.userData.ecosystemWind)candidate.userData.ecosystemWind=source.userData.ecosystemWind;
 if(Object.hasOwn(source,'onBeforeRender'))candidate.onBeforeRender=source.onBeforeRender;
 candidate.name=source.name+' / R8 E night response';candidate.customProgramCacheKey=()=>key+'|'+REVISION+'|'+kind;
 candidate.onBeforeCompile=function(shader,renderer){
  compile.call(source,shader,renderer);
  const wind=shader.uniforms.ecosystemTime;
  for(const [name,value] of Object.entries(values)){
   if(!shader.uniforms[name])throw Error('R8 E missing inherited uniform '+name);
   shader.uniforms[name]={value:value?.clone?value.clone():value};
  }
  if(kind==='wood'){
   once(shader,'r5WoodLight+=r5GardenKeyTint*.28*r5Key+r5GardenRimTint*.60*r5Rim;','r5WoodLight+=r5GardenKeyTint*.26*r5Key+r5GardenRimTint*.42*r5Rim;');
   once(shader,'diffuseColor.rgb=mix(diffuseColor.rgb,r5WoodResponse,.72);','diffuseColor.rgb=mix(diffuseColor.rgb,r5WoodResponse,.86);');
  }
  if(kind==='house')once(shader,'vec3 r5light=r5HouseSky*(.68+.32*r5sky)+vec3(.032,.040,.060);','vec3 r5light=r5HouseSky*(.66+.34*r5sky)+vec3(.029,.036,.064);');
  if(shader.fragmentShader.includes('float r6Window(')){
   // Existing measured finite windows: unchanged centers, facade tests and ranges.
   // Their warmer near-field light is distinct from the real porch spotlight.
   once(shader,'return min(.13,s*1.35);','return min(.40,s*3.60);');
   shader.uniforms.r6WindowGain={value:1.40};
  }
  if(wind!==shader.uniforms.ecosystemTime)throw Error('R8 E changed the inherited wind clock');
  record.compiles++;record.shader=shader;record.ownedUniforms=Object.keys(values);record.wind=wind;
 };
 return candidate;
}

