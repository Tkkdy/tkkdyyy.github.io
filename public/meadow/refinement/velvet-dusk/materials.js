import * as T from 'three';
import {install as installVault} from '../light-studio/vault.js';
import {installGrass} from './grass.js';

// Integral of an ellipsoidal Gaussian along the visible ray segment. The
// difference of the two endpoints clips the layer at the first opaque surface.
const field=`
uniform mat4 vdFromWorld;
uniform float vdAirStrength;
float vdErf(float x){
 x=clamp(x,-5.,5.);
 float t=x*(1.13+.45*x*x);
 return t*inversesqrt(1.+t*t);
}
float vdColumn(vec3 eye,vec3 ray,float distanceToSurface,vec3 center,vec3 scale){
 vec3 p=(eye-center)/scale, d=ray/scale;
 float inv=inversesqrt(max(.00001,dot(d,d)));
 vec3 axis=d*inv;
 float t=dot(p,axis);
 vec3 across=p-t*axis;
 return .88623*inv*exp(-dot(across,across))*(vdErf(t+distanceToSurface/inv)-vdErf(t));
}
float vdDensity(vec3 worldRay,float depth){
 vec3 eye=(vdFromWorld*vec4(cameraPosition,1.)).xyz;
 vec3 ray=mat3(vdFromWorld)*worldRay;
 // One cushion of air along the meadow and a thinner drift behind the crown.
 float bank=.033*vdColumn(eye,ray,depth,vec3(-.7,12.9,-.9),vec3(8.2,1.22,4.4));
 float veil=.023*vdColumn(eye,ray,depth,vec3(2.4,14.6,-3.2),vec3(7.0,.83,3.8));
 return 1.-exp(-vdAirStrength*min(.32,bank+veil));
}
vec3 vdTint(vec3 worldRay,vec3 sunDirection){
 float warm=smoothstep(.33,.99,dot(worldRay,sunDirection));
 vec3 tint=mix(vec3(.193,.145,.235),vec3(.39,.20,.213),warm);
 return tint;
}`;
const diffuse=`
 float vdLum=dot(outgoingLight,vec3(.2126,.7152,.0722));
 float vdOpen=smoothstep(.007,.095,vdLum)*(1.-smoothstep(.68,1.35,vdLum));
 float vdUp=smoothstep(-.65,.85,dot(evN,evRad));
 float vdWest=smoothstep(-.65,.8,dot(evN,evLight));
 vec3 vdSky=mix(vec3(.135,.12,.22),vec3(.34,.184,.119),vdWest);
 // Scatter into the middle values according to the painted pigment and
 // the normal. Black contact lines and emissive window cores remain anchored.
 vec3 vdPig=sqrt(max(outgoingLight,vec3(0.)));
 outgoingLight+=vdPig*vdSky*vdOpen*(.48+.52*vdUp)*vdResponse;
 outgoingLight/=1.+vdResponse*.22*max(0.,vdLum-.30);
`;
export async function install(ctx){
 const grass=installGrass(ctx);
 let base;
 try{base=await installVault(ctx);}catch(e){grass.dispose();throw e;}
 const tracked=[],seen=new Set(),inverse={value:new T.Matrix4()},strength={value:1};
 const dome=ctx.scene.getObjectByName('Storybook twilight vault'),mat=dome.material,priorRender=dome.onBeforeRender;
 const update=()=>inverse.value.copy(ctx.world.matrixWorld).invert();update();
 dome.onBeforeRender=function(...args){update();priorRender.apply(this,args);};
 const originalSky=mat.fragmentShader,anchor='#include <colorspace_fragment>';
 mat.uniforms.vdFromWorld=inverse;mat.uniforms.vdAirStrength=strength;
 mat.fragmentShader=field+originalSky.replace(anchor,`
   vec3 vdSkyRay=normalize(bookWorld-cameraPosition);
   gl_FragColor.rgb=mix(gl_FragColor.rgb,vdTint(vdSkyRay,normalize(bookSun-cameraPosition)),vdDensity(vdSkyRay,160.)*skyEnabled);
   ${anchor}`);
 mat.needsUpdate=true;
 ctx.world.traverse(o=>{
  if(!o.isMesh)return;
  for(const material of Array.isArray(o.material)?o.material:[o.material]){
   if(seen.has(material)||!material.customProgramCacheKey().includes('|vesper-aerial-2|'))continue;
   seen.add(material);
   const original=material.onBeforeCompile,key=material.customProgramCacheKey;
   const terrain=material.userData.eGround?.kind==='terrain',water=o===ctx.debug.r8D.mesh;
   const plant=o.name.includes('understory /')||o.name.includes('petals');
   const blade=o.name.includes('understory /')||o.name.includes('shoulder grass');
   const facade=o.name==='cottage_painted_scene',roof=o.name==='Light transfer / B retained roof';
   const stone=o.userData.ecosystem?.kind==='rock'||o.name.startsWith('fractured-shore-stones-');
   const paintMap=roof||facade||o.name==='blossom_painted_scene';
   const response=plant?'1.05':facade?'.69':roof?'.78':terrain?'.70':'.80';
   material.customProgramCacheKey=()=>key.call(material)+'|velvet-3|'+[response,stone,blade,paintMap].join('-');
   material.onBeforeCompile=function(shader,renderer){
    original.call(this,shader,renderer);shader.uniforms.vdFromWorld=inverse;shader.uniforms.vdAirStrength=strength;
    // Optical depth changes over metres. Interpolate it across the small
    // blades, tiles and stones. Evaluate the uninterrupted sky per pixel.
    shader.vertexShader=field+'\nvarying float vdOpticalDepth;\n'+shader.vertexShader.replace('#include <fog_vertex>',`#include <fog_vertex>
      vec3 vdEyeRay=evPoint-cameraPosition;
      vdOpticalDepth=vdDensity(normalize(vdEyeRay),length(vdEyeRay));`);
    let src=shader.fragmentShader;
    const mark='vec3 evScatter=airLight(evRay);';
    if(!src.includes(mark))throw Error('Missing surface air response on '+o.name);
    if(stone){
     const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();
     const box=g.boundingBox,center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
     shader.uniforms.vdRockCenter={value:center};shader.uniforms.vdRockSize={value:size};
     shader.vertexShader='uniform vec3 vdRockCenter,vdRockSize;\n'+shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
       vec3 worn=(position-vdRockCenter)/max(vec3(.001),vdRockSize*vdRockSize);
       objectNormal=normalize(mix(objectNormal,normalize(worn+vec3(.00001)),.30));`);
    }
    if(paintMap&&material.map){
     const sample=T.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )','texture2D( map, vMapUv, .64 )');
     src=src.replace('#include <map_fragment>',sample);
    }
    if(terrain){
     // Keep broad moss patches. Move small bright flecks off the flat ground
     // into the geometry of the standing grass instead.
     src=src.replace('fleck*2.3','fleck*.85').replace('vec3(.085,.067,.035)*smoothstep','vec3(.037,.031,.019)*smoothstep');
     src=src.replace('vec3(.068,.124,.095),vec3(.215,.231,.104)','vec3(.060,.110,.088),vec3(.168,.206,.110)');
    }
    if(blade)src=src.replace('float evNdotSun=dot(evN,evLight);','evN=normalize(evN*.55+.66*evRad); float evNdotSun=dot(evN,evLight);');
    const finish=water?'':`float vdResponse=${response};`+diffuse+(blade?'outgoingLight*=vec3(.66,.85,.73);':'');
    src=src.replace(mark,finish+'\n'+mark).replace('#include <opaque_fragment>',`
      vec3 vdAir=vdTint(evRay,normalize(evSun-cameraPosition));
      outgoingLight=mix(outgoingLight,vdAir,vdOpticalDepth);
      #include <opaque_fragment>`);
    shader.fragmentShader='varying float vdOpticalDepth;\n'+field+src;
   };
   material.needsUpdate=true;tracked.push({material,original,key});
  }
 });
 ctx.debug.velvet={clumps:grass.clumps,shoulder:grass.shoulder,materials:tracked.length};
 let disposed=false;
 const dispose=()=>{
  if(disposed)return;disposed=true;ctx.signal?.removeEventListener('abort',dispose);
  for(const {material,original,key} of tracked){material.onBeforeCompile=original;material.customProgramCacheKey=key;material.needsUpdate=true;}
  dome.onBeforeRender=priorRender;mat.fragmentShader=originalSky;delete mat.uniforms.vdFromWorld;delete mat.uniforms.vdAirStrength;mat.needsUpdate=true;
  base.dispose();grass.dispose();
 };
 ctx.signal?.addEventListener('abort',dispose,{once:true});ctx.invalidate();
 return {dispose,inspect:()=>ctx.debug.velvet,setAir(percent){strength.value=percent/100;ctx.invalidate();}};
}
