import * as T from 'three';
export const REVISION='e-meadow-pigment-1';
const common=`
varying vec3 vEPoint;
varying float vEHeight;
varying vec3 vEPigment;
float eHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float eNoise(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(eHash(i),eHash(i+vec3(1,0,0)),f.x),mix(eHash(i+vec3(0,1,0)),eHash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(eHash(i+vec3(0,0,1)),eHash(i+vec3(1,0,1)),f.x),mix(eHash(i+vec3(0,1,1)),eHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
vec2 eChart(vec3 p){vec3 n=normalize(p);float d=length(n.xz);return n.xz*(12.*acos(clamp(n.y,-1.,1.))/max(d,.00001));}
float eOwnership(vec3 p){return smoothstep(1.35,1.72,length(eChart(p)-vec2(1.4,-2.7)));}
uniform vec3 eRoot,eBody,eTip,eCream,ePink,eLilac,eStone,eStoneWarm;
`;
const palette={eRoot:'#284a43',eBody:'#687e66',eTip:'#b1b38b',
 eCream:'#ecdfc6',ePink:'#d6afc1',eLilac:'#ac94bf',eStone:'#7b8190',eStoneWarm:'#ac9b83'};
export function groundMaterial(original,kind){
 const material=original.clone(),compile=original.onBeforeCompile,sourceKey=original.customProgramCacheKey();
 // Material.copy JSON-copies userData and does not copy either callback.
 // Keep exactly the original closure and original shared wind time.
 if(original.userData.ecosystemWind)material.userData.ecosystemWind=original.userData.ecosystemWind;
 material.userData.eGround={kind,revision:REVISION};
 material.customProgramCacheKey=()=>sourceKey+'|'+REVISION+'|'+kind;
 if(kind==='rock'||kind==='shore-rock'){material.toneMapped=true;material.roughness=.94;if(material.bumpMap)material.bumpScale=.021;}
 if(kind==='sand')material.toneMapped=true;
 material.onBeforeCompile=(shader,renderer)=>{
  compile.call(material,shader,renderer);
  for(const [name,value]of Object.entries(palette))shader.uniforms[name]={value:new T.Color(value)};
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
varying vec3 vEPoint;
varying float vEHeight;
varying vec3 vEPigment;`);
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
 vEPoint=(instanceMatrix*vec4(position,1.)).xyz;
#else
 vEPoint=position;
#endif
 vEHeight=position.y;
 vEPigment=color.rgb;
`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+common);
  let pigment='';
  if(kind==='terrain')pigment=`
 // Original r5 feature masks and wet-bank shading remain authoritative.
 float eOwn=eOwnership(vEPoint);
 float eDry=smoothstep(.16,.65,vTerrainFeatures.x)*(1.-smoothstep(.06,.55,vTerrainFeatures.w));
 float eLawn=eDry*(1.-pathMask)*(1.-rockMask)*eOwn;
 float eBroad=eNoise(vEPoint*.28+vec3(4,7,2));
 float eMiddle=eNoise(vEPoint*3.1+vec3(6,1,9));
 float eWeave=eNoise(vEPoint*vec3(49.,11.,43.));
 float eDetail=1.-smoothstep(.035,.13,length(fwidth(vEPoint)));
 // Short, directional fibre wash; shading relief only, no displacement.
 float eStroke=pow(max(0.,sin(dot(vEPoint,vec3(108.,7.,51.))+eMiddle*5.)),10.)*smoothstep(.38,.7,eWeave);
 vec3 eMeadow=mix(eRoot,eBody,.35+.36*eBroad);
 eMeadow=mix(eMeadow,eTip,.045*smoothstep(.57,.85,eMiddle));
 eMeadow*=.91+.14*eMiddle+eDetail*(eStroke*.095+(eWeave-.5)*.075);
 diffuseColor.rgb=mix(diffuseColor.rgb,eMeadow,eLawn*.78);
 // Keep the worn centre and all path geometry.
 diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.97,.99,1.035),pathMask*eOwn*.45);
 terrainMicroRelief+=eLawn*eDetail*((eWeave-.5)*.0028+eStroke*.0017);
`;
  else if(kind==='groundcover')pigment=`
 float eOwn=eOwnership(vEPoint);
 float eBroad=eNoise(vEPoint*.28+vec3(4,7,2));
 float eMiddle=eNoise(vEPoint*3.1+vec3(6,1,9));
 vec3 eMeadow=mix(eRoot,eBody,.35+.36*eBroad);
 eMeadow=mix(eMeadow,eTip,.045*smoothstep(.57,.85,eMiddle));
 eMeadow*=.91+.14*eMiddle;
 diffuseColor.rgb=mix(diffuseColor.rgb,eMeadow,eOwn*.94);
`;
  else if(['grass','fern','flowers','understory'].includes(kind)){
   const flowers=kind==='flowers',bed=kind==='understory'||kind==='groundcover';
   pigment=`
 float eOwn=eOwnership(vEPoint),eBroad=eNoise(vEPoint*.82+vec3(4,7,2));
 float eSource=dot(vEPigment,vec3(.2126,.7152,.0722));
 float eBlade=${bed?'smoothstep(.035,.34,eSource)':'smoothstep(.025,.46,vEHeight)'};
 vec3 eLeaf=mix(eRoot,eBody,.23+.53*eBlade+.16*eBroad);
 eLeaf=mix(eLeaf,eTip,smoothstep(.48,.97,eBlade)*${kind==='fern'?'.25':'.63'});
 eLeaf*=.88+.18*eBroad;
 ${flowers?`
 float ePetal=smoothstep(.008,.045,vEPigment.r-vEPigment.g);
 float ePurple=step(vEPigment.r,vEPigment.b);
 float ePinkPatch=smoothstep(.36,.71,eNoise(vEPoint*.61+vec3(1,2,4)));
 vec3 eBloom=mix(mix(eCream,ePink,ePinkPatch*.42),eLilac,ePurple*.82);
 eBloom*=.79+.26*smoothstep(.26,.84,max(vEPigment.r,vEPigment.b));
 float eDisc=smoothstep(.60,.70,vEPigment.r)*(1.-smoothstep(.12,.16,vEPigment.b));
 eBloom=mix(eBloom,diffuseColor.rgb,eDisc);
 eLeaf=mix(eLeaf,eBloom,ePetal);
 `:''}
 diffuseColor.rgb=mix(diffuseColor.rgb,eLeaf,eOwn*${bed?'.54':'.74'});
`;
   // A modest material fill prevents black card-like leaf backs; standard
   // directional lighting still supplies 90 percent of the response.
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
 outgoingLight=mix(outgoingLight,diffuseColor.rgb*vec3(.66,.73,.83),.10*eOwnership(vEPoint));
 #include <opaque_fragment>`);
  }else if(kind==='rock'||kind==='shore-rock')pigment=`
 float eOwn=eOwnership(vEPoint),eWash=eNoise(vEPoint*2.7+vec3(5,1,9));
 float eValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
 vec3 eMineral=mix(eStone,eStoneWarm,smoothstep(.48,.84,eWash)*.45);
 eMineral*=.62+eValue*1.30;
 diffuseColor.rgb=mix(diffuseColor.rgb,eMineral,eOwn*.56${kind==='shore-rock'?'*smoothstep(vWater-.015,vWater+.10,length(vPlanet))':''});
`;
  else if(kind==='sand')pigment=`
 float eOwn=eOwnership(vEPoint);
 diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.89,.94,1.06),eOwn*.55);
`;
  if(!shader.fragmentShader.includes('#include <roughnessmap_fragment>'))throw Error('E requires standard-material colour stage');
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',pigment+'\n#include <roughnessmap_fragment>');
 };
 return material;
}
