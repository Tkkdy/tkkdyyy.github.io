import * as T from 'three';
export const REVISION='r9-c-physical-botanical-1';
export function cloneMaterial(source,label,patch){const m=source.clone(),compile=source.onBeforeCompile,key=source.customProgramCacheKey();if(source.userData.ecosystemWind)m.userData.ecosystemWind=source.userData.ecosystemWind;if(Object.hasOwn(source,'onBeforeRender'))m.onBeforeRender=source.onBeforeRender;m.name=source.name+' / R8 '+label;m.customProgramCacheKey=()=>key+'|'+REVISION+'|'+label;m.onBeforeCompile=(s,r)=>{compile.call(source,s,r);patch(s);m.r8Uniforms=s.uniforms;m.userData.r8Compiled=(m.userData.r8Compiled??0)+1;};return m;}
export function woodMaterial(source){
 // The inherited wood was MeshBasicMaterial: previous normal changes never
 // entered Three's light/shadow response. Preserve its flow lookup, not its
 // three generations of simulated directional pigment.
 const m=new T.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0,side:source.side});
 m.name='R9 main tree / physical flow-aligned bark';m.userData.r9PhysicalWood=true;
 const compile=source.onBeforeCompile,key=source.customProgramCacheKey();
 m.customProgramCacheKey=()=>key+'|r9-physical-bark-1';
 m.onBeforeCompile=(s,r)=>{
  compile.call(source,s,r);
  const flowStart=s.fragmentShader.indexOf('vec3 r6WoodPigment(vec4 flow) {'),flowEnd=s.fragmentShader.indexOf('vec3 r6WoodNormal',flowStart);
  if(flowStart<0||flowEnd<0)throw Error('R9 bark flow contract changed');
  s.fragmentShader=s.fragmentShader.slice(0,flowStart)+`vec3 r6WoodPigment(vec4 flow){
   float theta=atan(flow.y,flow.x),v=flow.z,confidence=smoothstep(.02,.62,flow.w);
   // Unequal vertically stretched bark plates, with broken edges. No regular
   // sine rings: the two nearest warped cells define each short fissure.
   vec2 q=vec2(theta*4.3,v*5.6);
   q+=vec2(r6Wash(q*.71+2.),r6Wash(q*.63+7.))*.62;
   vec2 cell=floor(q),f=fract(q);float first=9.,second=9.,seed=0.;
   for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 offset=vec2(float(x),float(y));
    vec2 center=offset+vec2(r6Hash(cell+offset),r6Hash(cell+offset+vec2(7,3)))*.78+.11;
    float d=length((center-f)*vec2(1.,.83));
    if(d<first){second=first;first=d;seed=r6Hash(cell+offset+17.);}else second=min(second,d);
   }
   float edge=second-first;
   float aa=max(fwidth(edge)*.7,.018);
   float split=(1.-smoothstep(.055-aa,.11+aa,edge))*smoothstep(.24,.73,r6Wash(q*vec2(.85,1.6)+9.));
   float plate=smoothstep(.0,.53,edge);
   float fibre=r6Wash(vec2(theta*53.+r6Wash(q)*2.,v*2.4));
   float weather=r6Wash(vec2(cos(theta)*2.7+9.,sin(theta)*2.7+v*1.4));
   float relief=(-.15*split+.055*plate+.032*(fibre-.5))*confidence;
   float pigment=(-.14*split+.055*(seed-.5)+.075*(weather-.5)+.045*(fibre-.5))*confidence;
   return vec3(.5+relief,.5+pigment,.5+(weather-.5)*confidence);
  }
`+s.fragmentShader.slice(flowEnd);
  const start=s.fragmentShader.indexOf('#include <color_fragment>'),end=s.fragmentShader.indexOf('#include <alphatest_fragment>',start);
  if(start<0||end<0||!s.uniforms.r6WoodFlow)throw Error('R9 bark requires retained flow texture');
  s.fragmentShader=s.fragmentShader.slice(0,start)+`#include <color_fragment>
   vec3 r6Wood=r6WoodPigment(vR6WoodFlow);
   float r9Value=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
   vec3 r9Pigment=mix(vec3(.115,.070,.050),vec3(.38,.235,.145),smoothstep(.008,.48,r9Value));
   diffuseColor.rgb=r9Pigment*(1.+(r6Wood.g-.5)*1.65);
   float r9Foot=1.-smoothstep(.025,.34,dot(vec4(vGardenPoint,1.),r6RootPlane));
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.77,.88,.80),r9Foot*.45);
   #include <alphamap_fragment>
  `+s.fragmentShader.slice(end);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec3 r9Dx=dFdx(-vViewPosition),r9Dy=dFdy(-vViewPosition);
   vec3 r9Rx=cross(r9Dy,normal),r9Ry=cross(normal,r9Dx);
   float r9Det=dot(r9Dx,r9Rx);
   normal=normalize(abs(r9Det)*normal-sign(r9Det)*(dFdx(r6Wood.r)*r9Rx+dFdy(r6Wood.r)*r9Ry)*.0055);
  `);
  m.r8Uniforms=s.uniforms;m.userData.r8Compiled=(m.userData.r8Compiled??0)+1;
 };return m;
}
export function auxiliaryMaterial(source,wind){const m=cloneMaterial(source,'quiet orchard leaves',s=>{s.uniforms.r8SharedBreeze=wind;s.vertexShader='uniform float r8SharedBreeze;\nvarying vec3 vR8Leaf;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvR8Leaf=position;\nfloat r8Phase=dot(instanceMatrix[3].xyz,vec3(1.7,.8,1.1));\ntransformed.x+=.045*sin(r8SharedBreeze*.79+r8Phase)*(1.-exp(-r8SharedBreeze*.8))*position.y*position.y;');s.fragmentShader='varying vec3 vR8Leaf;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=.94+.06*sin(vR8Leaf.y*14.+vR8Leaf.x*5.);');s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight=mix(outgoingLight,diffuseColor.rgb*vec3(.48,.56,.59),.23);\n#include <opaque_fragment>');});m.vertexColors=true;m.color.set('#b7c6bb');m.roughness=1;return m;}
export function auxiliaryWoodMaterial(source){return cloneMaterial(source,'orchard bark',s=>{s.vertexShader='varying vec3 vR8Bark;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvR8Bark=position;');s.fragmentShader='varying vec3 vR8Bark;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat r8Fibre=sin(vR8Bark.y*6.+vR8Bark.x*52.+sin(vR8Bark.y*3.)*.7);\ndiffuseColor.rgb*=.94+.055*r8Fibre;');});}
