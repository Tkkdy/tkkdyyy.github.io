import * as T from 'three';

export const REVISION = 'astra-water-3';
const PALETTE = {deep:'#183b58', shallow:'#466e78', lavender:'#656e9a', stroke:'#9ebac7'};

function replaceOnce(source, anchor, replacement) {
  if (!source.includes(anchor) || source.indexOf(anchor) !== source.lastIndexOf(anchor))
    throw Error('D water: original shader anchor changed: '+anchor.slice(0,72));
  return source.replace(anchor,replacement);
}

// Finite artwork-plane projection, plus an analytic distant sky field.
// This is neither SSR nor a render-target mirror of the scene.
const declarations = /* glsl */ `
varying vec3 vDWaterWorld;
uniform mat4 dSkyInverse;
uniform vec2 dSkySize;
uniform sampler2D dSkyPainting;
uniform float dSkyEnabled;
uniform vec3 dSkyLow, dSkyHigh, dBodyAmbient;
uniform vec3 dLampPosition[D_LAMP_COUNT], dLampNormal[D_LAMP_COUNT], dLampColor[D_LAMP_COUNT];
uniform float dLampPower[D_LAMP_COUNT];
vec3 dReflectedSky(vec3 ray) {
  float elevation=smoothstep(-.45,.8,ray.y);
  vec3 sky=mix(dSkyLow,dSkyHigh,elevation);
  vec3 origin=(dSkyInverse*vec4(vDWaterWorld,1.)).xyz;
  vec3 direction=(dSkyInverse*vec4(ray,0.)).xyz;
  float denominator=direction.z;
  float t=-origin.z/(abs(denominator)>.0001?denominator:.0001);
  vec2 uv=(origin.xy+direction.xy*t)/dSkySize+.5;
  float border=smoothstep(0.,.14,uv.x)*(1.-smoothstep(.86,1.,uv.x))
    *smoothstep(0.,.14,uv.y)*(1.-smoothstep(.86,1.,uv.y));
  // Coarse mip bias filters stars and painted edges into a soft reflected wash.
  vec3 paint=texture2D(dSkyPainting,clamp(uv,.001,.999),2.8).rgb;
  float valid=step(.001,t)*step(.0001,abs(denominator))*dSkyEnabled*border;
  return mix(sky,sky*.62+paint*.48,valid*.62);
}
`;

const reflection = /* glsl */ `
      vec3 dView=normalize(vViewPosition);
      vec3 dReflectView=reflect(-dView,normal);
      vec3 dReflectWorld=inverseTransformDirection(dReflectView,viewMatrix);
      vec3 dNormalWorld=inverseTransformDirection(normal,viewMatrix);
      float dFacing=clamp(dot(normal,dView),0.,1.);
      float dFresnel=.020+.36*pow(1.-dFacing,4.);
      vec3 dSky=dReflectedSky(dReflectWorld);
      // Bounded, sky-coloured ambient response keeps the body readable in shadow.
      // It is a stylized volume/ambient approximation, not transmission/refraction.
      outgoingLight+=diffuseColor.rgb*dBodyAmbient;
      outgoingLight+=dSky*(.055+dFresnel*.52)*(1.-.24*dChannelCore);
      vec3 dWarm=vec3(0.);
      for(int i=0;i<D_LAMP_COUNT;i++) {
        vec3 toLamp=dLampPosition[i]-vDWaterWorld;
        float distance2=max(dot(toLamp,toLamp),.05);
        vec3 towardLamp=toLamp*inversesqrt(distance2);
        float facade=smoothstep(.02,.28,dot(dLampNormal[i],-towardLamp));
        float aboveSurface=smoothstep(.01,.18,dot(dNormalWorld,towardLamp));
        float alignment=max(0.,dot(dReflectWorld,towardLamp));
        // The existing animated normal breaks the source lobe into ripple glints.
        // Positions and normals follow the actual house/world transform.
        float lobe=pow(alignment,26.);
        float radiance=dLampPower[i]/(1.+distance2*.11);
        dWarm+=dLampColor[i]*lobe*radiance*facade*aboveSurface;
      }
      outgoingLight+=dWarm*(.52+.85*dFresnel)*smoothstep(.005,.065,depth);
      outgoingLight*=1.-.12*stream*(1.-smoothstep(.003,.045,depth));
`;

export function createWaterLook(original, context) {
  const {world,cosmic,debug}=context;
  const house=debug.houseLighting;
  const emitters=(house?.emitters??[]).filter(e=>e.position?.length===3 && e.normal?.length===3);
  const lampCount=Math.max(1,emitters.length);
  const galaxy=cosmic?.exports?.nodes?.galaxy;
  if(!galaxy?.material?.uniforms?.uMap?.value)throw Error('D water: retained sky painting unavailable');
  const texture=galaxy.material.uniforms.uMap.value;
  const uniforms={
    dSkyInverse:{value:new T.Matrix4()},dSkySize:{value:new T.Vector2(galaxy.geometry.parameters.width,galaxy.geometry.parameters.height)},
    dSkyPainting:{value:texture},dSkyEnabled:{value:1},
    dSkyLow:{value:new T.Color('#2f4564')},dSkyHigh:{value:new T.Color('#786d96')},
    dBodyAmbient:{value:new T.Color(.15,.20,.27)},
    dLampPosition:{value:Array.from({length:lampCount},()=>new T.Vector3())},
    dLampNormal:{value:Array.from({length:lampCount},()=>new T.Vector3(0,1,0))},
    dLampColor:{value:Array.from({length:lampCount},(_,i)=>new T.Color(emitters[i]?.colorSRGB??house?.colorSRGB??'#ffd09a'))},
    dLampPower:{value:Array.from({length:lampCount},(_,i)=>{
      const e=emitters[i];return e?e.strength*Math.sqrt(e.extent[0]*e.extent[1])*3.4:0;
    })},
  };
  const localPositions=emitters.map(e=>new T.Vector3(...e.position));
  const localNormals=emitters.map(e=>new T.Vector3(...e.normal));
  const material=original.clone();
  material.name='Astra / twilight water with retained R4 ripples';
  material.roughness=.39;
  material.specularIntensity=.38;
  let clock,compiledShader;
  material.onBeforeCompile=(shader,renderer)=>{
    // Calling the original closure is essential: it owns the host's shared clock.
    original.onBeforeCompile(shader,renderer);
    clock=shader.uniforms.waterTime;compiledShader=shader;
    Object.assign(shader.uniforms,uniforms);
    for(const [name,color] of Object.entries(PALETTE))shader.uniforms['water_'+name].value.set(color);
    shader.vertexShader='varying vec3 vDWaterWorld;\n'+shader.vertexShader;
    shader.vertexShader=replaceOnce(shader.vertexShader,'#include <begin_vertex>',
      '#include <begin_vertex>\nvDWaterWorld=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader='#define D_LAMP_COUNT '+lampCount+'\n'+declarations+shader.fragmentShader;
    shader.fragmentShader=replaceOnce(shader.fragmentShader,
      'float depth=mix(max(0.0,vWater.x-vStage),max(0.0,vWater.x),smoothstep(.12,.32,vStage));',
      'float depth=max(0.0,vWater.x); // r5 already supplies actual water-to-bed depth.');
    // Optical depth controls the width of the water-side shallows; no shoreline geometry changes.
    shader.fragmentShader=replaceOnce(shader.fragmentShader,
      'float shallows=exp(-depth*(5.8+wash*3.2));',
      'float shallows=exp(-depth*(2.6+wash*1.8));');
    // The provider supplies independent left/right bank distances through the
    // normalized lateral attribute. Grade the submerged channel across that real
    // width, and only darken a core where actual depth supports it.
    shader.fragmentShader=replaceOnce(shader.fragmentShader,'diffuseColor.rgb*=pigment;', `
      float dShoulder=smoothstep(.12,.90,abs(vWater.w));
      float dChannelCore=stream*(1.-dShoulder)*smoothstep(.08,.26,depth);
      vec3 dBankPigment=mix(water_deep,water_shallow,.40+.16*wash);
      pigment=mix(pigment,dBankPigment,stream*dShoulder*.42);
      pigment*=1.-dChannelCore*.28;
      diffuseColor.rgb*=pigment;
    `);
    const start=shader.fragmentShader.indexOf('      // A restrained sky-tinted grazing sheen.');
    const end=shader.fragmentShader.indexOf('      #include <opaque_fragment>',start);
    if(start<0||end<0)throw Error('D water: original reflection anchor changed');
    shader.fragmentShader=shader.fragmentShader.slice(0,start)+reflection+shader.fragmentShader.slice(end);
  };
  material.customProgramCacheKey=()=>original.customProgramCacheKey()+'-'+REVISION+'-lamps-'+lampCount;
  function sync() {
    // Render-time matrices also update when motion is paused and the user rotates.
    world.updateWorldMatrix(true,false);galaxy.updateWorldMatrix(true,false);
    uniforms.dSkyInverse.value.copy(galaxy.matrixWorld).invert();
    uniforms.dSkyEnabled.value=cosmic.group.visible&&galaxy.visible?1:0;
    for(let i=0;i<emitters.length;i++){
      uniforms.dLampPosition.value[i].copy(localPositions[i]).applyMatrix4(world.matrixWorld);
      uniforms.dLampNormal.value[i].copy(localNormals[i]).transformDirection(world.matrixWorld);
    }
  }
  sync();
  return {material,sync,uniforms,emitters,
    inspect:()=>({clock:clock?.value??null,clockObject:clock,compiled:!!compiledShader,
      rippleTimeScale:compiledShader?.uniforms.waterRippleSpeed.value,flowMetresPerSecond:compiledShader?.uniforms.waterSpeed.value,fragmentShader:compiledShader?.fragmentShader,vertexShader:compiledShader?.vertexShader}),
  };
}
