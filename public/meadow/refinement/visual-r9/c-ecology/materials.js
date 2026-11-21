import * as T from 'three';
export const REVISION='r7-c-purple-communities-4';
export const PALETTE=Object.freeze({violet:'#8565b3',lavender:'#aa8dce',pink:'#c497c2',white:'#e8dfd7'});
function once(shader,part,needle,value){const i=shader[part].indexOf(needle);if(i<0||shader[part].indexOf(needle,i+needle.length)>=0)throw Error('C retained shader contract: '+needle);shader[part]=shader[part].slice(0,i)+value+shader[part].slice(i+needle.length);}
const floral=String.raw`
uniform vec3 r7Violet,r7Lavender,r7Pink,r7White;
varying vec3 vR7Root;
float r7Hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 r7Bloom(vec3 pigment){
 vec3 n=normalize(vR7Root);float d=length(n.xz);vec2 q=n.xz*(12.*acos(clamp(n.y,-1.,1.))/max(d,.00001));
 float clusterMix=.5+.5*sin(q.x*.68+q.y*.31)*cos(q.y*.49-q.x*.22);
 float salt=r7Hash(floor(q*7.));
 vec3 bloom=mix(r7Violet,r7Lavender,smoothstep(.18,.77,clusterMix));
 bloom=mix(bloom,r7Pink,smoothstep(.69,.96,clusterMix)*.77);
 bloom=mix(bloom,r7White,step(.925,salt));
 float relief=clamp(dot(pigment,vec3(.2126,.7152,.0722)),0.,1.);
 return bloom*(.83+.29*smoothstep(.10,.72,relief));
}
`;
export function materialFor(source,kind,record,garden=false,leafPalette){
 const m=source.clone(),compile=source.onBeforeCompile,key=source.customProgramCacheKey();
 if(source.userData.ecosystemWind)m.userData.ecosystemWind=source.userData.ecosystemWind;
 if(Object.hasOwn(source,'onBeforeRender'))m.onBeforeRender=source.onBeforeRender;
 m.name=source.name+' / C purple communities';m.userData.r7C={revision:REVISION,kind,garden};
 m.customProgramCacheKey=()=>key+'|'+REVISION+'|'+kind+'|'+garden;
 m.onBeforeCompile=(shader,renderer)=>{
  compile.call(source,shader,renderer);record.sourceCalls++;
  const wind=source.userData.ecosystemWind?.time;
  if(wind&&shader.uniforms.ecosystemTime!==wind)throw Error('C lost original shared wind');
  if(leafPalette)for(const name of ['eRoot','eBody','eTip'])if(shader.uniforms[name]&&typeof leafPalette[name]==='string')shader.uniforms[name]={value:new T.Color(leafPalette[name])};
  if(kind==='flowers'){
   for(const [key,hex]of Object.entries(PALETTE))shader.uniforms['r7'+key[0].toUpperCase()+key.slice(1)]={value:new T.Color(hex)};
   once(shader,'vertexShader','#include <common>','#include <common>\nvarying vec3 vR7Root;'+(garden?'\nvarying vec3 vR7Pigment;\nvarying float vR7Height;':''));
   once(shader,'vertexShader','#include <begin_vertex>','#include <begin_vertex>\nvR7Root=instanceMatrix[3].xyz;'+(garden?'\nvR7Pigment=color;vR7Height=position.y;':''));
   once(shader,'fragmentShader','#include <common>','#include <common>\n'+floral+(garden?'\nvarying vec3 vR7Pigment;\nvarying float vR7Height;':''));
   if(garden){
    once(shader,'fragmentShader','#include <roughnessmap_fragment>',`float r7Petal=smoothstep(.35,.40,vR7Height)*smoothstep(-.015,.035,vR7Pigment.r-vR7Pigment.g);
 diffuseColor.rgb=mix(diffuseColor.rgb,r7Bloom(vR7Pigment),r7Petal*.94);
 #include <roughnessmap_fragment>`);
   }else{
    once(shader,'fragmentShader','vec3 eBloom=mix(mix(eCream,ePink,ePinkPatch*.42),eLilac,ePurple*.82);','vec3 eBloom=r7Bloom(vEPigment);');
    once(shader,'fragmentShader','eBloom*=.79+.26*smoothstep(.26,.84,max(vEPigment.r,vEPigment.b));','eBloom*=.97+.06*smoothstep(.26,.84,max(vEPigment.r,vEPigment.b));');
    once(shader,'fragmentShader','diffuseColor.rgb=mix(diffuseColor.rgb,eLeaf,eOwn*.74);','diffuseColor.rgb=mix(diffuseColor.rgb,eLeaf,eOwn*mix(.74,.97,ePetal));');
   }
  }
  record.compiles++;record.uniforms=shader.uniforms;record.vertexShader=shader.vertexShader;record.fragmentShader=shader.fragmentShader;
 };
 return m;
}
