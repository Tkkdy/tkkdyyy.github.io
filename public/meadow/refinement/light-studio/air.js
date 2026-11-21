import {uniforms as study} from './engine.js';
import * as T from 'three';

const linearAir = `
uniform vec3 evSun,evCenter,evLight;
uniform float evRadius,evStrength;
uniform vec3 studyTint,studyLamp;
uniform float studyEnergy,studyMode,studyRoll,studyShadow,studyRadius;
varying vec3 evPoint;

vec3 airLight(vec3 ray){
 vec3 sun=normalize(evSun-cameraPosition);
 float forward=max(0.,dot(ray,sun));
 float rose=pow(forward,7.);
 float gold=pow(forward,32.);
 return mix(vec3(.105,.121,.231),vec3(.34,.205,.28),rose)
      +vec3(.45,.22,.072)*gold;
}
`;
const body = `
 vec3 evRay=normalize(evPoint-cameraPosition);
 vec3 evRad=normalize(evPoint-evCenter);
 float evD=length(evPoint-cameraPosition);
 float evH=length(evPoint-evCenter)-evRadius;
 float evFace=clamp(dot(evRad,-evRay),0.,1.);
 float evGrazing=pow(1.-evFace,2.);
 // Segment inside a shallow spherical layer. A close flower has very
 // little intervening air, even if a distant silhouette lies behind it.
 vec3 evFromSurface=evPoint-evCenter;
 float evB=dot(evFromSurface,-evRay);
 float evShell=evRadius+2.1;
 float evExit=max(0.,-evB+sqrt(max(0.,evB*evB+evShell*evShell-dot(evFromSurface,evFromSurface))));
 float evPath=min(evD,evExit);
 float evHaze=(1.-exp(-evPath*.016))*(.12+.88*evGrazing)*smoothstep(4.,12.,evD)*(1.-smoothstep(1.3,3.2,evH));
 float evWarm=pow(max(0.,dot(evRay,normalize(evSun-cameraPosition))),12.);
 evHaze*=.78+.54*evWarm;
 vec3 evScatter=airLight(evRay);
 outgoingLight=mix(outgoingLight,evScatter,min(.145,evHaze));
`;
const groundLight = `
 // The local painted ground already distinguishes road, rocks and turf.
 // Turn only the dry ochre-green pigment towards blue sage. Preserve the
 // original variation and height strokes, including the exposed road.
 float evDry=(1.-pathMask)*(1.-rockMask)*smoothstep(.12,.68,vTerrainFeatures.x);
 float evOlive=smoothstep(.004,.10,diffuseColor.g-diffuseColor.b);
 float evY=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
 vec3 evSage=mix(diffuseColor.rgb,vec3(evY*.68,evY*1.12,evY*.86),.56);
 diffuseColor.rgb=mix(diffuseColor.rgb,evSage,evDry*evOlive);
`;
const coloredBounce = `
 float evNdotSun=dot(evN,evLight);
 float evFacing=clamp(dot(evN,-evRay),0.,1.);
 float evDay=smoothstep(-.34,.66,evNdotSun);
 float evShade=1.-smoothstep(.05,.38,dot(outgoingLight,vec3(.2126,.7152,.0722)));
 // Diffuse skylight carries the underlying pigment into shade. Near-black
 // contact crevices retain their dark value.
 vec3 evPigment=sqrt(max(diffuseColor.rgb,vec3(0.)));
 outgoingLight+=evShade*(1.-.60*evDay)*evPigment*vec3(.018,.033,.066);
 // A broad amber sky lobe lights upward and sunset-facing facets. The
 // narrower grazing response picks out leaf tips and the lit edges of slate.
 float evRim=pow(1.-evFacing,1.8)*smoothstep(-.10,.68,evNdotSun);
 outgoingLight+=evStrength*(.40+.60*evVisibility)*evPigment*(vec3(.49,.205,.066)*evDay+vec3(.40,.183,.064)*evRim);

`;
const sea = `
 vec3 evN=normalize(transpose(mat3(viewMatrix))*normal);
 vec3 evR=reflect(evRay,evN);
 vec3 evS=normalize(evSun-evPoint);
 float evF=pow(1.-max(0.,dot(evN,-evRay)),3.);
 // The specular path belongs to the vertical plane through the observer,
 // planet centre and the low sun. Its width is measured on the water.
 vec3 evObserver=normalize(cameraPosition-evCenter);
 vec3 evDisk=normalize(evSun-evCenter);
 vec3 evCross=cross(evObserver,evDisk);
 vec3 evAcross=evCross/max(length(evCross),.001);
 float evWidth=abs(dot(evPoint-evCenter,evAcross));
 float evSide=dot(evRad,normalize(evDisk-evObserver*dot(evDisk,evObserver)));
 float evTrack=exp(-evWidth*evWidth/1.10)*smoothstep(-.12,.40,evSide);
 float evGlint=pow(max(0.,dot(evS,evR)),12.);
 float evRipples=smoothstep(.24,.88,r9Crest*r9Broken);
 outgoingLight-=min(outgoingLight*.44,reflectedLight.directSpecular*.58)*(1.-evTrack)*(1.-stream);
 outgoingLight*=vec3(.83,.85,1.04);
  float horizonRim=(1.-smoothstep(.015,.19,dot(evRad,-evRay)))*pow(max(0.,dot(evRay,normalize(evSun-cameraPosition))),32.);
  outgoingLight+=evStrength*vec3(.68,.34,.17)*horizonRim*(.36+.64*evRipples)*(1.-stream);
 outgoingLight+=vec3(.010,.021,.039)*(.34+.66*evF);
 outgoingLight+=vec3(.82,.46,.18)*evStrength*evTrack*(.095+1.24*evRipples)*(.26+.74*evGlint)*(1.-stream);

`;

export function install(ctx){
 const {world, scene,cosmic,debug}=ctx;
 const center=new T.Vector3(),sun=new T.Vector3(),direction=new T.Vector3();
 const porch=world.getObjectByName('Astra cottage / outward porch light');
 const uniforms={...study,evSun:{value:sun},evCenter:{value:center},evLight:{value:direction},
  evRadius:{value:12},evStrength:{value:1}};
 const key=world.getObjectByName('R1 twilight key');
 function sync(){
  porch.getWorldPosition(study.studyLamp.value);
  cosmic.exports.nodes.sun.getWorldPosition(sun);world.getWorldPosition(center);
  direction.copy(debug.eveningLight?.worldDirection??sun).normalize();
  uniforms.evStrength.value=key.visible?T.MathUtils.clamp(key.intensity/3.88,0,1):0;
 }
 const bindings=[],seen=new Map(),skyMaterials=[],hookCounts={};
 const previousFog=scene.fog;scene.fog=null;
 // Patch the actual compiled materials so all upstream uniforms, wind
 // clocks, window lighting and mesh callbacks continue to own their state.
 world.traverse(o=>{
  if(!o.isMesh)return;
  for(const m of Array.isArray(o.material)?o.material:[o.material]){
   if(!m||seen.has(m)||(!m.isMeshStandardMaterial&&!m.isMeshBasicMaterial)||m.transparent)continue;
   const petals=o.name==='blossom_painted_petals',roof=o.name==='Light transfer / B retained roof';
   const orchard=o.name==='R7 auxiliary individual leaves';
   const kind=orchard?'orchard':petals?'petals':roof?'roof':o===debug.r8D.mesh?'water':m.userData.eGround?.kind==='terrain'?'ground':m.isMeshStandardMaterial?'solid':'paint';
   const compile=m.onBeforeCompile, prior=m.customProgramCacheKey,oldKey=prior.call(m);
   let centre;
   if(petals||roof||orchard){
    const bounds=orchard?o:o.geometry;
    if(!bounds.boundingBox)bounds.computeBoundingBox();
    centre=bounds.boundingBox.getCenter(new T.Vector3());
   }
   const hadCompile=Object.hasOwn(m,'onBeforeCompile'),hadKey=Object.hasOwn(m,'customProgramCacheKey');
   seen.set(m,true);bindings.push({m,compile,prior,hadCompile,hadKey});
   m.customProgramCacheKey=()=>oldKey+'|vesper-aerial-2|'+kind+'|'+(o.name==='blossom_painted_scene'?'wood':o.name==='cottage_painted_scene'?'facade':'');
   m.onBeforeCompile=(s,r)=>{
    compile.call(m,s,r);Object.assign(s.uniforms,uniforms);
    s.vertexShader='varying vec3 evPoint;\n'+s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nevPoint=cameraPosition+transpose(mat3(viewMatrix))*mvPosition.xyz;');
    s.fragmentShader=linearAir+s.fragmentShader;
    if(kind!=='water' && m.isMeshStandardMaterial){
     const sampleEnd='vDirectionalShadowCoord[ i ] ) : 1.0;';
     const native=T.ShaderChunk.lights_fragment_begin;
     if(!native.includes(sampleEnd))throw Error('Solar shadow sampling changed');
     const receiver=kind==='ground' ? native.replace('directionalLightShadow.shadowRadius, vDirectionalShadowCoord','(studyRadius*directionalLightShadow.shadowRadius), vDirectionalShadowCoord').replace('directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias','(studyShadow*directionalLightShadow.shadowIntensity), directionalLightShadow.shadowBias') : native;
     const lights=receiver.replace(sampleEnd,sampleEnd+'\n#if UNROLLED_LOOP_INDEX == 0\nevVisibility=directLight.color.r/max(.0001,directionalLight.color.r);\n#endif');
     s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_begin>','float evVisibility=1.;\n'+lights);
    }
    if(kind==='ground')s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',groundLight+'\n#include <roughnessmap_fragment>');
    if(kind==='water'){
     // Diffuse skylight remains visible inside a cast shadow on the water.
     // Keep the actual blocker footprint and crest response on the one water mesh.
     const shadowTerm='directionalLightShadow.shadowIntensity';
     const nativeLights=T.ShaderChunk.lights_fragment_begin;
     if(!nativeLights.includes(shadowTerm))throw Error('Water shadow term changed');
     s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_begin>',nativeLights.replace(shadowTerm,'(.48*directionalLightShadow.shadowIntensity)'));
     const old='outgoingLight+=vec3(.53,.225,.094)*lobe*(.11+.89*flashes)*(1.-stream);';
     if(!s.fragmentShader.includes('texture2D(dSkyPainting,clamp(uv,.001,.999),3.8).rgb')||!s.fragmentShader.includes(old))throw Error('Expected the retained sea reflection');
     s.fragmentShader=s.fragmentShader.replace(old,'')
      .replace('texture2D(dSkyPainting,clamp(uv,.001,.999),3.8).rgb','texture2D(dSkyPainting,clamp(uv-vec2(0.,.14),.001,.999),3.8).rgb*vec3(.41,.40,.54)')
      .replace('vec3 dSky=dReflectedSky(dReflectWorld);','vec3 dSky=dReflectedSky(dReflectWorld); dSky+=vec3(.27,.099,.077)*pow(max(0.,dot(dReflectWorld,normalize(evSun-vDWaterWorld))),11.);');
    }
    let tips='';
    if(centre){
     s.uniforms.evLocalCentre={value:centre};
     s.vertexShader='uniform vec3 evLocalCentre; varying vec3 evMantle;\n'+s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nevMantle=mat3(modelMatrix)*(transformed-evLocalCentre);');
     s.fragmentShader='varying vec3 evMantle;\n'+s.fragmentShader;
     if(orchard)s.vertexShader=s.vertexShader.replace('mat3(modelMatrix)*(transformed-evLocalCentre)','mat3(modelMatrix)*((instanceMatrix*vec4(transformed,1.)).xyz-evLocalCentre)');
     const highlight=orchard?'vec3(.70,.39,.105)':petals?'vec3(.58,.26,.092)':'vec3(.70,.36,.155)';
     tips=`
      vec3 evOutside=normalize(evMantle+.001*evRad);
      float evUpper=smoothstep(-.18,.62,dot(evOutside,evRad));
      float evLeft=smoothstep(-.46,.76,dot(evOutside,evLight));
      float evEdge=.35+.65*smoothstep(-.18,.64,dot(evN,evLight));
      outgoingLight+=evStrength*(.52+.48*evVisibility)*evPigment*${highlight}*evUpper*evLeft*evEdge;`;
     if(orchard)tips+=`
      float thinLeaf=pow(max(0.,dot(evRay,evLight)),3.);
      outgoingLight+=evStrength*thinLeaf*sqrt(evPigment)*vec3(.29,.16,.045)*evUpper*(.18+.82*evLeft);`;
    }
    const normalCode=kind==='paint'||kind==='roof'?'vec3 evN=normalize(cross(dFdx(evPoint),dFdy(evPoint)));':'vec3 evN=normalize(transpose(mat3(viewMatrix))*normal);';
    // Warm light scattered back from the sunset illuminates forms facing the open sky.
    // Use world-space normals so the light stays fixed when the planet turns.
    const illumination={
      roof: [1.07,.34,.23], petals: [1.12,.39,.43], orchard: [.66,.45,.15],
      ground: [.48,.32,.19], solid: [.39,.24,.15], paint: [.29,.18,.11]
    };
    const rgb=illumination[kind];
    // A large patch of peach sky illuminates the open crown and the western bank.
    // It subtends a different angle from the disk; direct solar occlusion alone
    // would black out the petals and the entire path in the silhouette of the house.
    const skyReturn={
      roof:`float tileLight=smoothstep(-.45,.68,dot(normalize(evMantle+.01*evRad),duskBounce));
        outgoingLight+=evStrength*(.16+.84*tileLight)*duskWrap*duskPigment*vec3(.24,.09,.055);`,
      petals:`float mantle=dot(normalize(evMantle+.01*evRad),normalize(duskBounce+vec3(0.,.65,0.)));
        float skyOpening=.18+.82*smoothstep(-.52,.65,mantle);
        outgoingLight+=evStrength*skyOpening*(.43+.57*duskWrap)*evPigment*vec3(.53,.19,.21);`,
      ground:`float westFacing=smoothstep(-.26,.32,duskWest);
        float openSky=westFacing*(.22+.78*duskWrap)+pathMask*duskWrap*.52;
        outgoingLight+=evStrength*openSky*duskPigment*vec3(.47,.31,.19);`,
      orchard:`outgoingLight+=evStrength*evPigment*vec3(.54,.39,.13)*duskWrap*smoothstep(-.3,.7,dot(normalize(evMantle+.01*evRad),duskBounce));`,
      solid:`outgoingLight+=evStrength*duskPigment*vec3(.43,.28,.15)*duskWrap*smoothstep(-.08,.22,duskWest);`
    };
    const bounce=rgb ? `
     vec3 duskBounce=normalize(vec3(.30*evLight.x+.95*evLight.z,.68,-.95*evLight.x+.30*evLight.z));
     float duskWrap=smoothstep(-.55,.88,dot(evN,duskBounce));
     float duskSky=(.035+.965*duskWrap*duskWrap)*(.52+.48*evVisibility);
     float duskWest=dot(evRad,normalize(vec3(evLight.x,.0001,evLight.z)));
     duskSky*= ${kind==='ground'||kind==='solid' ? '.12+.88*smoothstep(-.23,.34,duskWest)' : '1.'};
     ${kind==='ground' ? `float duskSlope=.76*smoothstep(-.15,.24,duskWest)+.24*smoothstep(.02,.58,dot(evN,evLight));
       outgoingLight*=mix(vec3(.61,.76,1.01),vec3(1.10,1.055,.98),duskSlope);` : ''}
     ${kind==='roof' ? `duskSky*=.70+.34*smoothstep(-.55,.65,dot(normalize(evMantle+.01*evRad),duskBounce));` : ''}
     vec3 duskPigment=mix(evPigment,1.18*pow(max(vec3(0.),outgoingLight),vec3(.64)),.53);
     float duskCavity=smoothstep(.008,.12,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
     outgoingLight+=evStrength*duskSky*(.17+.83*duskCavity)*duskPigment*vec3(${rgb.join(',')});
     ${skyReturn[kind]??''}
    ` : '';
    const pos=body.indexOf(' vec3 evScatter');
    const visibility=m.isMeshBasicMaterial ? 'float evVisibility=1.;\n' : '';
    const materialShape={
      roof:`float topLight=smoothstep(-.60,.77,dot(normalize(evMantle+.01*evRad),normalize(evLight+vec3(0.,.38,0.))));
        outgoingLight*=mix(vec3(.65,.57,.64),vec3(.99,.93,.87),topLight);`,
      petals:`float crownLight=smoothstep(-.44,.74,dot(normalize(evMantle+.01*evRad),normalize(evLight+vec3(0.,.68,0.))));
        outgoingLight*=mix(vec3(.57,.53,.72),vec3(.95,.91,.96),crownLight);`
    };
    const wood=o.name==='blossom_painted_scene';
    // Dusk scattered by petals, bark and plaster has a broad response.
    // Use their existing shaded pigment as the mask so joints keep their depth.
    let scatter='';
    if(wood||kind==='petals'||kind==='roof'||o.name==='cottage_painted_scene'){
      const tint=wood?'vec3(.37,.20,.14)':kind==='petals'?'vec3(.33,.19,.31)':kind==='roof'?'vec3(.21,.102,.068)':'vec3(.28,.17,.14)';
      scatter=`
       float surfaceTone=dot(outgoingLight,vec3(.2126,.7152,.0722));
       float midtones=smoothstep(.006,.085,surfaceTone)*(1.-smoothstep(.35,.90,surfaceTone));
       float skylit=.37+.63*smoothstep(-.80,.65,dot(evN,normalize(evLight+.73*evRad)));
       outgoingLight+=evStrength*sqrt(max(outgoingLight,vec3(0.)))*${tint}*skylit*midtones;`;
    }
    const shape=`
      ${materialShape[kind]??''}
      float sunFacet=smoothstep(-.20,.69,evNdotSun)*evVisibility;
      float tone=dot(outgoingLight,vec3(.2126,.7152,.0722));
      float shadow=(1.-smoothstep(.105,.57,tone))*(1.-.81*sunFacet);
      // Open midtone transitions without adding light to the deepest crevices.
      float penumbra=smoothstep(.03,.19,tone)*(1.-smoothstep(.26,.60,tone));
      outgoingLight*=mix(vec3(1.),vec3(.48,.59,.79),shadow*(1.-.43*penumbra));
      ${kind==='ground'||kind==='petals'||kind==='roof'?'outgoingLight/=1.+.12*max(0.,tone-.26);':''}
    `;
    const returnLight=`
      float studyY=dot(outgoingLight,vec3(.2126,.7152,.0722));
      float studyMid=smoothstep(.007,.085,studyY)*(1.-smoothstep(.47,1.25,studyY));
      float opening=.24+.76*smoothstep(-.55,.87,dot(evN,normalize(evLight+.52*evRad)));
      if(studyMode>.5)opening=.57+.43*smoothstep(-.75,.80,dot(evN,evRad));
      if(studyMode>1.5)opening=exp(-dot(evPoint-studyLamp,evPoint-studyLamp)/15.)*(.72+.28*smoothstep(-.7,.8,dot(evN,evRad)));
      ${kind==='roof'?'if(studyMode<1.5){':''}
      outgoingLight+=studyEnergy*studyMid*opening*sqrt(max(outgoingLight,vec3(0.)))*studyTint;
      outgoingLight/=1.+studyRoll*max(0.,studyY-.32);
      ${kind==='roof'?'}':''}`;
    const code=visibility+body.slice(0,pos)+(kind==='water'?sea:normalCode+coloredBounce+tips+bounce+shape+scatter+returnLight)+body.slice(pos);
    s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',code+'\n#include <opaque_fragment>');
    hookCounts[kind]=(hookCounts[kind]??0)+1;
   };
   m.needsUpdate=true;
  }
 });
 // The same air seen past the limb. The visible layer narrows on the cool
 // side and disperses around the low sun. No screen-space blur is involved.
 const limb=`
  vec3 evRay=normalize(bookWorld-cameraPosition);
  vec3 evOrigin=cameraPosition-evCenter;
  float evT=-dot(evOrigin,evRay);
  float evImpact=length(evOrigin+max(0.,evT)*evRay)-evRadius;
  float evWarm=pow(max(0.,dot(evRay,normalize(evSun-cameraPosition))),14.);
  float evAmount=exp(-max(evImpact,0.)/(.11+.27*evWarm))*smoothstep(.1,2.,evT);
  vec3 evTint=mix(vec3(.18,.24,.57),vec3(.93,.48,.25),evWarm);
  gl_FragColor.rgb+=evTint*evAmount*(.027+.27*evWarm);
 `;
 for(const o of [cosmic.exports.nodes.galaxy,scene.getObjectByName('Storybook twilight vault')]){
  const m=o.material,src=m.fragmentShader;
  Object.assign(m.uniforms,uniforms);
  m.fragmentShader='uniform vec3 evSun,evCenter;\nuniform float evRadius;\n'+src.replace('#include <colorspace_fragment>',limb+'\n#include <colorspace_fragment>');
  m.needsUpdate=true;skyMaterials.push({m,src});
 }
 const dome=scene.getObjectByName('Storybook twilight vault'),before=dome.onBeforeRender;
 dome.onBeforeRender=function(...a){sync();before.apply(this,a);};
 sync();
 let disposed=false;
 return {inspect:()=>({materials:bindings.length,hookCounts,extent:2.1,disposed}),dispose(){
  if(disposed)return;disposed=true;
  dome.onBeforeRender=before;scene.fog=previousFog;
  for(const {m,src} of skyMaterials){m.fragmentShader=src;for(const n of Object.keys(uniforms))delete m.uniforms[n];m.needsUpdate=true;}
  for(const {m,compile,prior,hadCompile,hadKey} of bindings){
   if(hadCompile)m.onBeforeCompile=compile;else delete m.onBeforeCompile;
   if(hadKey)m.customProgramCacheKey=prior;else delete m.customProgramCacheKey;
   m.needsUpdate=true;
  }
 }};
}
