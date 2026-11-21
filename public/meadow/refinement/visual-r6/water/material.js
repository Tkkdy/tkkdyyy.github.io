import * as T from 'three';
export const REVISION='r6-water-depth-flow-5';
const PALETTE={water_deep:'#103553',water_shallow:'#438d96',water_lavender:'#526b91',water_stroke:'#96b5bf'};
function replace(source,anchor,next){if(source.indexOf(anchor)<0||source.indexOf(anchor)!==source.lastIndexOf(anchor))throw Error('R6 water anchor changed: '+anchor.slice(0,80));return source.replace(anchor,next)}
export function createLook(source,ctx){
 const river=ctx.hydrology?.river,sea=ctx.hydrology?.seaLevel;
 if(!Array.isArray(river)||river.length<3||!Number.isFinite(sea))throw Error('R6 water requires current hydrology');
 let mouthIndex=river.findIndex(r=>r.waterHeight<=sea+.045);if(mouthIndex<1)mouthIndex=river.length-2;
 const mouth=river[mouthIndex],previous=river[Math.max(0,mouthIndex-3)],direction=new T.Vector2(mouth.u-previous.u,mouth.v-previous.v).normalize();
 if(!Number.isFinite(mouth.u+mouth.v)||direction.length()<.99)throw Error('Invalid current river mouth');
 const owned={r6Mouth:{value:new T.Vector4(mouth.u,mouth.v,direction.x,direction.y)},r6FoamColor:{value:new T.Color('#b5c8c3')}};
 const material=source.clone(),compile=source.onBeforeCompile,key=source.customProgramCacheKey;
 material.name='R6 / depth, long bay swell and downstream broken wash';
 material.roughness=.46;material.specularIntensity=.14;
 material.onBeforeRender=source.onBeforeRender;
 let shader=null,upstream=null,sourceFragment=null,sourceVertex=null;
 material.onBeforeCompile=function(s,renderer){
  compile.call(source,s,renderer);upstream={...s.uniforms};sourceFragment=s.fragmentShader;sourceVertex=s.vertexShader;
  for(const [name,color] of Object.entries(PALETTE))s.uniforms[name]={value:new T.Color(color)};
  Object.assign(s.uniforms,owned);
  s.fragmentShader='uniform vec4 r6Mouth;\nuniform vec3 r6FoamColor;\n'+s.fragmentShader;
  s.fragmentShader=replace(s.fragmentShader,'      diffuseColor.rgb*=pigment;',/* glsl */`
      // Material-only optical body: actual water-to-bed depth, never stage subtraction.
      float r6Shelf=exp(-depth*(1.55+.75*wash));
      float r6Littoral=1.-smoothstep(.06,.22+.48*waterNoise(p*.95),depth);
      pigment*=mix(vec3(.56,.70,.91),vec3(1.),r6Shelf);
      pigment=mix(pigment,water_shallow*(.72+.10*wash),r6Littoral*(.48-.14*stream));
      // Arc length grows downstream in the retained provider. The same host clock
      // advects these marks toward the mouth; no second clock or invented river.
      float r6Travel=vWater.y-waterTime*waterSpeed;
      float r6Cross=vWater.w;
      float r6Phase=r6Travel*9.4+1.1*sin(r6Cross*3.8+r6Travel*.62);
      float r6Crest=pow(.5+.5*sin(r6Phase),14.0);
      float r6Filament=waterNoise(vec2(r6Cross*6.3+sin(r6Travel*.9)*.3,r6Travel*3.2));
      float r6LaneA=r6Travel*.93+r6Cross*3.1;
      float r6LaneB=r6Travel*2.6-r6Cross*2.;
      float r6Lane=r6Cross*13.+2.2*sin(r6LaneA)+.85*sin(r6LaneB);
      float r6FilamentFace=pow(.5+.5*sin(r6Lane),5.);
      float r6Thread=r6Crest*smoothstep(.32,.74,r6Filament);
      pigment=mix(pigment,water_stroke,stream*r6FilamentFace*(.18*r6Filament*r6Filament)*detailFade);
      pigment=mix(pigment,water_stroke,stream*r6Thread*.065*detailFade);
      // Bay long waves are an addition to, not a replacement for, the source ripple field.
      vec2 r6BayDirection=normalize(vec2(.16,1.));
      float r6BayPhase=dot(p,r6BayDirection)*4.2+.5*sin(p.x*.9)-waterTime*.32;
      float r6BayFace=pow(.5+.5*sin(r6BayPhase),5.0);
      pigment=mix(pigment,water_stroke,(1.-stream)*r6BayFace*(.014+.026*fineWash)*detailFade);
      // Narrow, eroded patches in the real shallow fringe. No continuous outline.
      float r6ShallowEdge=(1.-smoothstep(.045,.090,depth))*smoothstep(.008,.026,depth);
      float r6Break=smoothstep(.46,.68,waterNoise(p*vec2(3.1,4.6)+vec2(waterTime*.012,-waterTime*.025)));
      float r6Erode=smoothstep(.35,.70,waterNoise(p*vec2(14.,9.)+vec2(0.,-waterTime*.06)));
      float r6Wash=r6ShallowEdge*r6Break*r6Erode
        *pow(.5+.5*sin(depth*90.-waterTime*.65+waterNoise(p*4.)*3.),2.);
      vec2 r6FromMouth=p-r6Mouth.xy;
      float r6Along=dot(r6FromMouth,r6Mouth.zw);
      float r6Across=dot(r6FromMouth,vec2(-r6Mouth.w,r6Mouth.z));
      float r6MouthArea=(1.-smoothstep(.28,1.3,abs(r6Across)))*(1.-smoothstep(.35,1.8,abs(r6Along)))
        *smoothstep(.004,.035,depth)*(1.-smoothstep(.22,.7,depth));
      float r6MouthCrest=pow(.5+.5*sin(r6Along*13.-waterTime*waterSpeed*13.+1.8*waterNoise(p*3.)),12.0);
      float r6MouthWash=r6MouthArea*r6MouthCrest*smoothstep(.46,.77,waterNoise(p*vec2(7.,4.)));
      pigment=mix(pigment,r6FoamColor,clamp(r6Wash*.60+r6MouthWash*.095,0.,.62)*detailFade);
      diffuseColor.rgb*=pigment;`);
  s.fragmentShader=replace(s.fragmentShader,
   'if(stream>.001) slope=mix(slope,waterSlope(vec2(vWater.w*.23,vWater.y),time),stream);',
   'if(stream>.001) slope=mix(slope,waterSlope(vec2(vWater.w*.23,vWater.y),time)*.55,stream);');
  s.fragmentShader=replace(s.fragmentShader,'      slope*=smoothstep(.005,.12,depth);',/* glsl */`
      // Analytic gradients avoid 2x2 derivative glints, while preserving every
      // original wave function and frequency. Stream amplitude is explicitly rebalanced below.
      vec2 r6BayGradient=(r6BayDirection*4.2+vec2(.45*cos(p.x*.9),0.))*.020*cos(r6BayPhase);
      vec2 r6BaySlope=vec2(dot(r6BayGradient,dFdx(p)),dot(r6BayGradient,dFdy(p)));
      float r6Curl=cos(r6Cross*3.8+r6Travel*.62);
      vec2 r6LaneGradient=vec2(13.+6.82*cos(r6LaneA)-1.7*cos(r6LaneB),2.046*cos(r6LaneA)+2.21*cos(r6LaneB));
      vec2 r6RiverGradient=r6LaneGradient*.0038*cos(r6Lane)*(.25+.75*r6Filament)
        +vec2(4.18*r6Curl,9.4+.682*r6Curl)*.002*cos(r6Phase);
      vec2 r6RiverCoords=vec2(r6Cross,vWater.y);
      vec2 r6RiverSlope=vec2(dot(r6RiverGradient,dFdx(r6RiverCoords)),dot(r6RiverGradient,dFdy(r6RiverCoords)));
      slope+=mix(r6BaySlope,r6RiverSlope,stream);
      slope*=smoothstep(.005,.12,depth);`);
  s.fragmentShader=replace(s.fragmentShader,'roughnessFactor=clamp(roughness+.055*wash+.07*shore+.035*stream,.32,.72);',
   'roughnessFactor=clamp(roughness+.045*wash+.08*shore+.05*stream+.07*r6Wash,.36,.74);');
  s.fragmentShader=replace(s.fragmentShader,'vec3 dReflectView=reflect(-dView,normal);',
   'vec3 r6ReflectionNormal=normalize(mix(normal,geometryNormal,.24));\n      vec3 dReflectView=reflect(-dView,r6ReflectionNormal);');
  shader=s;
 };
 material.customProgramCacheKey=()=>key.call(source)+'|'+REVISION;
 return {material,inspect:()=>({shader,upstream,owned,sourceFragment,sourceVertex,clock:shader?.uniforms.waterTime}),mouth:{index:mouthIndex,u:mouth.u,v:mouth.v,direction:direction.toArray(),waterHeight:mouth.waterHeight,seaLevel:sea},palette:PALETTE};
}
