import * as T from 'three';

const REVISION = 'astra-cottage-3';
const WARM = '#ffd09a';
const LOCAL_Y = -.00371445;
// Measured from the retained, normalized GLB's disconnected glass components.
// No geometry, attributes, UVs, or source textures are edited.
const PANES = [
  {name:'front-left-window',center:[-1.06,1.25+LOCAL_Y,1.435],normal:[0,0,1],width:.50,height:.70,radius:.82,strength:.46},
  {name:'front-right-window',center:[1.05,1.28+LOCAL_Y,1.435],normal:[0,0,1],width:.53,height:.75,radius:.84,strength:.46},
  {name:'east-gable-window',center:[1.80,2.44+LOCAL_Y,-.03],normal:[1,0,0],width:.49,height:.64,radius:.66,strength:.23},
  {name:'east-lower-window',center:[1.80,1.13+LOCAL_Y,-.15],normal:[1,0,0],width:.63,height:.78,radius:.82,strength:.31},
  {name:'rear-left-window',center:[-.87,1.20+LOCAL_Y,-1.40],normal:[0,0,-1],width:.55,height:.74,radius:.78,strength:.30},
  {name:'rear-right-window',center:[.91,1.20+LOCAL_Y,-1.40],normal:[0,0,-1],width:.55,height:.74,radius:.78,strength:.30},
  {name:'west-window',center:[-1.80,1.20+LOCAL_Y,-.12],normal:[-1,0,0],width:.59,height:.77,radius:.80,strength:.30},
];
const FANLIGHT = {name:'door-fanlight',center:[0,1.5175+LOCAL_Y,1.449],normal:[0,0,1],width:.49,height:.255,radius:.52,strength:.18};
const LANTERN = {name:'door-lantern',center:[.75,1.48+LOCAL_Y,1.69],normal:[0,0,1],width:.15,height:.25,radius:.88,strength:.73};
const EMITTERS = [...PANES,FANLIGHT,LANTERN];
const vec = v => 'vec3(' + v.map(n => Number(n).toFixed(7)).join(',') + ')';
const scalar = v => Number(v).toFixed(7);
const varying = 'varying vec3 vHousePoint;\nvarying vec3 vHouseNormal;\n';

function attachCoordinates(shader) {
  shader.vertexShader = varying + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\nvHousePoint=position;vHouseNormal=normal;');
  shader.fragmentShader = varying + shader.fragmentShader;
}
function readLight(world, id) {
  return world.children.find(o => o.name === 'R1 twilight ' + id)
    ?? (id === 'key' ? world.children.find(o => o.isDirectionalLight && o.castShadow) : null);
}
function lightDirection(light, inverse, fallback) {
  return light ? light.getWorldPosition(new T.Vector3())
    .sub(light.target.getWorldPosition(new T.Vector3())).transformDirection(inverse)
    : new T.Vector3(...fallback).normalize();
}
function temperatureColor(source, whiteMix, gain) {
  return source.clone().lerp(new T.Color(1,1,1),whiteMix).multiplyScalar(gain);
}

function paintMaterial(original, lighting) {
  const material=original.clone();
  material.name='Astra cottage / retained painted materials';
  material.toneMapped=true;
  material.onBeforeCompile=shader=>{
    attachCoordinates(shader);
    Object.assign(shader.uniforms,{
      houseKey:{value:lighting.keyDirection},houseRim:{value:lighting.rimDirection},
      houseCool:{value:lighting.cool},houseWarm:{value:lighting.warm},
      houseRimColor:{value:lighting.rim},houseAmber:{value:new T.Color(WARM)},
    });
    shader.fragmentShader='uniform vec3 houseKey,houseRim,houseCool,houseWarm,houseRimColor,houseAmber;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n' + [
        'vec3 p=vHousePoint,n=normalize(vHouseNormal);',
        'float key=smoothstep(-.30,.88,dot(n,houseKey));',
        'float sky=smoothstep(-.20,.85,n.y);',
        'vec3 illumination=mix(houseCool,houseWarm,key*.85);',
        'illumination+=houseCool*.10*sky+houseRimColor*smoothstep(.08,.85,dot(n,houseRim));',
        'vec3 pigment=diffuseColor.rgb;',
        'float roof=smoothstep(1.98,2.30,p.y)*smoothstep(.20,.67,n.y);',
        'float stone=1.-smoothstep(.26,.54,p.y);',
        'float value=dot(pigment,vec3(.2126,.7152,.0722));',
        'pigment=mix(pigment,value*vec3(1.12,.88,1.17),roof*.45);',
        'float wallPlane=max(1.-smoothstep(.014,.060,abs(p.z-1.35)),1.-smoothstep(.014,.060,abs(p.z+1.31)));',
        'wallPlane=max(wallPlane,1.-smoothstep(.014,.060,abs(abs(p.x)-1.71)));',
        'float plaster=wallPlane*(1.-smoothstep(.20,.60,abs(n.y)))*smoothstep(.29,.52,p.y);',
        'pigment=mix(pigment,vec3(value)*vec3(1.04,1.02,1.),plaster*.36);',
        'illumination=mix(illumination,mix(houseCool,houseWarm,key*.30)+houseRimColor*.6,roof*.72);',
        'pigment*=mix(vec3(1.),vec3(.89,.97,1.10),stone*.60);',
        'float spill=0.;',
        ...EMITTERS.map(e=>{
          const source=e.center.map((v,i)=>v+e.normal[i]*(e===LANTERN?.045:.13));
          return '{vec3 outward='+vec(e.normal)+',fromSurface=p-'+vec(e.center)+';'
            +'vec3 toLamp='+vec(source)+'-p;float distance2=dot(toLamp,toLamp);'
            // A source cannot relight another facade through the solid house.
            +'float facade=1.-smoothstep(.12,.27,-dot(fromSurface,outward));'
            +'float range=1.-smoothstep('+scalar(e.radius*.78)+','+scalar(e.radius*1.30)+',length(fromSurface));'
            +'float facing=max(0.,dot(n,toLamp*inversesqrt(max(distance2,.0001))));'
            +'spill+=facade*range*exp(-distance2/'+scalar(e.radius*e.radius*.63)+')*facing*'+scalar(e.strength)+';}';
        }),
        // Pigment, including its baked occlusion, remains the basis of every lit area.
        'diffuseColor.rgb=pigment*(illumination+houseAmber*min(spill,1.15)*1.18);',
      ].join('\n'));
  };
  material.customProgramCacheKey=()=>REVISION+'-paint';
  return material;
}

const paneFunction = [
  'float housePane(vec3 p,vec3 center,vec3 normal,float width,float height){',
  'vec3 tangent=vec3(normal.z,0.,-normal.x);',
  'vec2 q=vec2(dot(p-center,tangent)/(width*.5),(p.y-center.y)/(height*.5));',
  'float inset=1.-max(abs(q.x),abs(q.y));',
  'float edge=smoothstep(.015,.44,inset);',
  'vec2 offset=(q-vec2(-.10,.08))*vec2(1.12,.82);',
  'float core=exp(-dot(offset,offset)*1.25);',
  'return clamp(.07+.57*edge+.32*core+.035*q.y,.04,.97);',
  '}',
].join('\n');

function glassMaterial(original, soft) {
  const material=original.clone();
  material.name='Astra cottage / '+(soft?'lantern and fanlight':'soft amber panes');
  // Reflected colour stays quiet; the spatially graded emission supplies the light.
  material.color.set('#30201a');
  material.emissive.set('#ffffff'); material.emissiveIntensity=1;
  material.roughness=.88; material.metalness=0; material.toneMapped=true;
  material.onBeforeCompile=shader=>{
    attachCoordinates(shader);
    shader.fragmentShader=paneFunction+'\n'+shader.fragmentShader;
    const profiles=soft ? [
      'bool isLantern=vHousePoint.x>.50;',
      'float glow=isLantern?housePane(vHousePoint,'+vec(LANTERN.center)+',vec3(0.,0.,1.),.15,.25)'
        +':housePane(vHousePoint,'+vec(FANLIGHT.center)+',vec3(0.,0.,1.),.49,.255);',
      'float outputGain=isLantern?1.28:.78;',
    ] : [
      'float closest=1.e10,glow=0.;float outputGain=1.;',
      ...PANES.map(e=>'{vec3 center='+vec(e.center)+';float d=dot(vHousePoint-center,vHousePoint-center);'
        +'if(d<closest){closest=d;glow=housePane(vHousePoint,center,'+vec(e.normal)+','+scalar(e.width)+','+scalar(e.height)+');}}'),
    ];
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n'+profiles.join('\n')+'\n'
      +'totalEmissiveRadiance=mix(vec3(.52,.175,.037),vec3(2.65,1.38,.47),glow)*outputGain;');
  };
  material.customProgramCacheKey=()=>REVISION+'-'+(soft?'small-lights':'panes');
  return material;
}

export function install(context) {
  const {assets,world,debug,signal,renderer,invalidate}=context;
  signal.throwIfAborted();
  const cottage=assets.cottage, originals=[], materials=[], additions=[];
  const previousDebug=debug.houseLighting;
  let published,disposed=false;
  const dispose=()=>{
    if(disposed)return;
    disposed=true;signal.removeEventListener('abort',dispose);
    for(const [mesh,original,copy] of originals)if(mesh.material===copy)mesh.material=original;
    for(const material of materials)material.dispose();
    for(const object of additions){object.removeFromParent();object.dispose?.();}
    if(debug.houseLighting===published){
      if(previousDebug===undefined)delete debug.houseLighting;else debug.houseLighting=previousDebug;
    }
    invalidate?.();
  };
  try {
    cottage.updateWorldMatrix(true,true);world.updateMatrixWorld(true);
    const inverse=cottage.matrixWorld.clone().invert(),key=readLight(world,'key'),rim=readLight(world,'rim');
    const hemisphere=world.children.find(o=>o.isHemisphereLight);
    const contract=world.userData.compositionLighting;
    const lighting={
      keyDirection:lightDirection(key,inverse,[-.7,.5,.4]),
      rimDirection:lightDirection(rim,inverse,[.4,.7,-.5]),
      cool:temperatureColor(hemisphere?.color??new T.Color('#a8b8df'),.36,.60),
      warm:temperatureColor(key?.color??new T.Color('#ffd4a4'),.78,.76),
      rim:temperatureColor(rim?.color??new T.Color('#c4a7df'),.25,.075),
    };
    cottage.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const original=mesh.material;
      const copy=mesh.name==='cottage_painted_scene'
        ?paintMaterial(original,lighting)
        :glassMaterial(original,mesh.name==='windows_soft_amber');
      originals.push([mesh,original,copy]);materials.push(copy);mesh.material=copy;
    });

    // The entire cone travels out of the front facade. It cannot light the back
    // of the house: its least-forward ray still has positive local Z.
    const porch=new T.SpotLight(WARM,4.6,3.8,.44,.95,2);
    porch.name='Astra cottage / outward porch light';
    porch.position.set(.75,1.48+LOCAL_Y,1.85);
    porch.target.position.set(.28,.04,3.10);
    cottage.add(porch,porch.target);additions.push(porch,porch.target);
    cottage.updateWorldMatrix(true,true);
    const worldInverse=world.matrixWorld.clone().invert();
    const cottageToPlanet=new T.Matrix4().multiplyMatrices(worldInverse,cottage.matrixWorld);
    const point=v=>new T.Vector3(...v).applyMatrix4(cottageToPlanet).toArray();
    const direction=v=>new T.Vector3(...v).transformDirection(cottageToPlanet).toArray();
    const coneDirection=porch.target.position.clone().sub(porch.position).normalize();
    const forwardConeMinimum=coneDirection.z*Math.cos(porch.angle)
      -Math.sqrt(1-coneDirection.z*coneDirection.z)*Math.sin(porch.angle);
    published={
      revision:REVISION,lightingRevision:contract?.revision??'scene-lights',
      space:'planet-local (world group)',color:WARM,colorSRGB:WARM,
      temperatureK:2900,temperatureNote:'art-direction nominal; use colorSRGB for rendering, not a measured CCT',
      exposure:renderer?.toneMappingExposure??contract?.exposure??1.05,
      emitters:EMITTERS.map(e=>({...e,local:[...e.center],position:point(e.center),
        normal:direction(e.normal),colorSRGB:WARM,temperatureK:2900,
        role:e===LANTERN?'lantern':e===FANLIGHT?'fanlight':'window',
        implementation:'retained emissive geometry + facade-bounded painted bounce',
        extent:[e.width,e.height],cutoff:e.radius*1.30})),
      porch:{kind:'SpotLight',position:point(porch.position.toArray()),local:porch.position.toArray(),
        target:point(porch.target.position.toArray()),direction:direction(coneDirection.toArray()),
        colorSRGB:WARM,temperatureK:2900,intensity:porch.intensity,distance:porch.distance,
        angle:porch.angle,penumbra:porch.penumbra,decay:porch.decay,castsShadow:false,
        forwardConeMinimum,implementation:'real light; outward-only cone'},
      geometryUnchanged:true,bakedMapPreserved:true,toneMapped:true,
      limitations:'Baked occlusion retained; local painted bounce is not ray-traced visibility.',
    };
    debug.houseLighting=published;
    signal.addEventListener('abort',dispose,{once:true});
    invalidate?.();
    return {dispose};
  } catch(error) {
    dispose();throw error;
  }
}
