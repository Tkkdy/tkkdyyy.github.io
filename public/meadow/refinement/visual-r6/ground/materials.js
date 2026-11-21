import * as T from 'three';
export const REVISION='r6-ground-field-4';
// Largest retained desktop/mobile rock batch. Capacity changes no rendered instance.
export const GROUND_PLANE_CAPACITY=17;
const uniformHook='uniform vec3 eRoot,eBody,eTip,eCream,ePink,eLilac,eStone,eStoneWarm;';
function once(shader,part,from,to){
 const s=shader[part];if(s.split(from).length!==2)throw Error('R6 ground source contract: '+from.slice(0,90));
 shader[part]=s.replace(from,to);
}
function span(shader,from,to,replacement){
 const s=shader.fragmentShader,a=s.indexOf(from),b=s.indexOf(to,a);
 if(a<0||b<0||s.indexOf(from,a+1)>=0)throw Error('R6 ground paint span changed');
 shader.fragmentShader=s.slice(0,a)+replacement+'\n'+s.slice(b);
}
const common=String.raw`
varying vec3 vR6Normal;
varying float vR6RootAltitude;
uniform vec3 r6Key;
uniform float r6SeaRadius,r6WindowGain;
float r6Relief;
float r6Hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float r6Noise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(r6Hash(i),r6Hash(i+vec2(1,0)),f.x),mix(r6Hash(i+vec2(0,1)),r6Hash(i+vec2(1)),f.x),f.y);
}
// Continuous crossed fibres, warped by the larger meadow field.
vec4 r6Field(vec3 p){
 vec2 q=eChart(p);
 vec2 warp=vec2(r6Noise(q*.56+8.),r6Noise(q*.63+vec2(3,9)))-.5;
 float broad=r6Noise(q*.48+warp*.7+vec2(4,7));
 float meadowPatch=smoothstep(.24,.76,r6Noise(q*1.55+warp*.9+vec2(2,8)));
 float brush=r6Noise(q*vec2(18.,9.)+warp*2.)*.55+r6Noise(mat2(.87,.50,-.50,.87)*q*vec2(11.,27.)+warp)*.45;
 float fibre=r6Noise(q*vec2(57.,19.)+warp*7.+vec2(5,2));
 float crossed=r6Noise(mat2(.74,.67,-.67,.74)*q*vec2(41.,15.)+warp*5.);
 float fine=(smoothstep(.43,.76,fibre)*.68+smoothstep(.46,.78,crossed)*.32)*(.4+.6*meadowPatch);
 fine*=1.-smoothstep(.045,.14,length(fwidth(q)));
 return vec4(broad,meadowPatch,brush,fine);
}
vec3 r6Meadow(vec4 f,float damp){
 vec3 meadow=mix(eRoot,eBody,.26+.52*f.x);
 meadow=mix(meadow,eBody*vec3(1.08,1.02,.83),f.y*.27*(1.-damp));
 meadow=mix(meadow,eRoot*vec3(.91,1.07,1.13),damp*.22);
 meadow*=.76+.38*f.y+.10*f.x+(f.z-.5)*.24;
 meadow=mix(meadow,eTip,f.w*.10*(1.-damp*.5));
 return meadow;
}
vec3 r6Perturb(vec3 n,float h){
 vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);
 vec3 a=cross(dy,n),b=cross(n,dx);float det=dot(dx,a);
 return normalize(abs(det)*n-sign(det)*(dFdx(h)*a+dFdy(h)*b));
}
`;
const terrainPaint=String.raw`
 float eOwn=eOwnership(vEPoint);
 float eDry=smoothstep(.16,.65,vTerrainFeatures.x)*(1.-smoothstep(.06,.55,vTerrainFeatures.w));
 float eLawn=eDry*(1.-pathMask)*(1.-rockMask)*eOwn;
 vec4 r6F=r6Field(vEPoint);
 float r6Damp=1.-smoothstep(.06,.72,vR6RootAltitude);
 vec3 eMeadow=r6Meadow(r6F,r6Damp);
 diffuseColor.rgb=mix(diffuseColor.rgb,eMeadow,eLawn*.88);
 float r6Contact=r6Footprint(eChart(vEPoint));
 diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.77,.86,.79),r6Contact*eOwn*.23);
 terrainMicroRelief+=eLawn*((r6F.z-.5)*.0035+r6F.w*.0014+(r6F.y-.5)*.003);
`;
const groundcoverPaint=String.raw`
 float eOwn=eOwnership(vEPoint);
 vec4 r6F=r6Field(vEPoint);
 float r6Damp=1.-smoothstep(.06,.72,vR6RootAltitude);
 vec3 eMeadow=r6Meadow(r6F,r6Damp);
 diffuseColor.rgb=mix(diffuseColor.rgb,eMeadow,eOwn*.94);
 r6Relief=((r6F.z-.5)*.0035+r6F.w*.0014+(r6F.y-.5)*.003)*eOwn;
`;
const rockPaint=String.raw`
 float eOwn=eOwnership(vEPoint);
 float eValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
 vec2 r6Q=vec2(dot(vEPoint,vec3(.83,.16,.55)),dot(vEPoint,vec3(-.30,.94,.18)));
 float r6Large=r6Noise(r6Q*1.6+vec2(8,3));
 vec2 r6Warp=vec2(r6Large,r6Noise(r6Q*2.+4.))-.5;
 float r6Plane=eNoise(vEPoint*vec3(6.2,7.5,5.1)+vec3(r6Warp*.7,2.));
 float r6Grit=eNoise(vEPoint*vec3(23.,19.,21.)+vec3(8,1,3));
 float r6Seam=smoothstep(.58,.80,eNoise(vEPoint*vec3(10.,2.,8.)+vec3(r6Warp,4.)))*smoothstep(.30,.65,r6Large);
 float r6Facing=smoothstep(-.18,.82,dot(normalize(vR4StoneNormal),r6Key));
 float r6Detail=1.-smoothstep(.025,.12,length(fwidth(vEPoint)));
 vec3 eMineral=mix(eStone*.91,eStoneWarm,.10+.26*r6Facing+.30*smoothstep(.28,.75,r6Large));
 eMineral*=.80+.28*r6Plane+.13*r6Large-r6Seam*.09+r6Detail*(r6Grit-.5)*.045;
 eMineral*=.74+eValue*.90;
 float r6Foot=1.-smoothstep(.015,.25,vR6Clearance+(r6Plane-.5)*.09);
 vec3 r6Earth=mix(eRoot,terrainSoil,.40+.20*r6Large);
 eMineral=mix(eMineral,r6Earth,r6Foot*.34);
 r4StoneRelief=r6Detail*((r6Plane-.5)*.014-r6Seam*.001+(r6Grit-.5)*.0035)*eOwn;
 diffuseColor.rgb=mix(diffuseColor.rgb,eMineral,eOwn*.80 R6_WET);
`;
const vec=a=>'vec3('+a.map(x=>Number(x).toFixed(7)).join(',')+')';
function windowGLSL(field){
 const terms=field.emitters.map(e=>{
  const n=new T.Vector3(...e.normal),tangent=new T.Vector3().crossVectors(field.houseUp,n).normalize();
  return `s+=r6Area(p,n,${vec(e.position)},${vec(e.normal)},${vec(tangent.toArray())},${vec(field.houseUp.toArray())},vec2(${e.extent.map(x=>(x*.44).toFixed(7)).join(',')}),${e.role==='fanlight'?'1.55':'1.95'})*${Number(e.strength).toFixed(7)};`;
 });
 return `
 float r6Area(vec3 p,vec3 n,vec3 c,vec3 outN,vec3 tangent,vec3 up,vec2 extent,float cutoff){
  vec3 delta=p-c;
  vec3 source=c+tangent*clamp(dot(delta,tangent),-extent.x,extent.x)+up*clamp(dot(delta,up),-extent.y,extent.y)+outN*.13;
  vec3 l=source-p;float d2=dot(l,l);
  float facade=smoothstep(-.08,.14,dot(delta,outN));
  float reach=1.-smoothstep(cutoff*.68,cutoff,sqrt(d2));
  return facade*reach*max(0.,dot(n,normalize(l)))/(1.+d2/.52);
 }
 float r6Window(vec3 p,vec3 n){
  if(distance(p,${vec(field.houseCenter.toArray())})>3.8)return 0.;
  float s=0.;${terms.join('\n')}
  return min(.13,s*1.35);
 }`;
}
export function createMaterial(original,kind,field,planes,record){
 if(planes&&planes.length>GROUND_PLANE_CAPACITY)throw new RangeError('R6 ground plane batch exceeds fixed capacity');
 const m=original.clone(),callback=original.onBeforeCompile,key=original.customProgramCacheKey;
 if(original.userData.ecosystemWind)m.userData.ecosystemWind=original.userData.ecosystemWind;
 m.userData.r6Ground={revision:REVISION,kind};
 m.name=original.name+' / R6 '+kind;
 m.customProgramCacheKey=()=>key.call(original)+'|'+REVISION+'|'+kind+'|'+(planes?GROUND_PLANE_CAPACITY:0);
 const stone=['rock','shore-rock'].includes(kind),plant=['grass','fern','flowers','understory'].includes(kind);
 if(stone)m.roughness=.93;
 m.onBeforeCompile=function(shader,renderer){
  callback.call(original,shader,renderer);record.sourceCalls++;
  const wind=original.userData.ecosystemWind?.time;
  if(wind&&shader.uniforms.ecosystemTime!==wind)throw Error('R6 lost source wind time');
  shader.uniforms.r6Key={value:field.key.clone()};
  shader.uniforms.r6SeaRadius={value:field.seaRadius};
  shader.uniforms.r6WindowGain={value:1};
  // Keep R5 colors; changes concern spatial pigment and light response.
  if(stone)shader.uniforms.terrainSoil={value:new T.Color('#9b8b7b')};
  once(shader,'vertexShader','#include <common>','#include <common>\nvarying vec3 vR6Normal;\nvarying float vR6RootAltitude;\nuniform float r6SeaRadius;\n'+(stone?'varying float vR6Clearance;\n':'')+(planes?`uniform vec4 r6GroundPlane[${GROUND_PLANE_CAPACITY}];\n`:''));
  once(shader,'vertexShader','#include <begin_vertex>',`#include <begin_vertex>
   vec3 r6N=normal,r6P=position,r6Root=position;
   #ifdef USE_INSTANCING
    mat3 r6I=mat3(instanceMatrix);
    r6N/=vec3(dot(r6I[0],r6I[0]),dot(r6I[1],r6I[1]),dot(r6I[2],r6I[2]));
    r6N=r6I*r6N;r6P=(instanceMatrix*vec4(position,1.)).xyz;r6Root=instanceMatrix[3].xyz;
   #endif
   vR6Normal=normalize(r6N);vR6RootAltitude=length(r6Root)-r6SeaRadius;
   ${stone?(planes?'vec4 r6Plane=r6GroundPlane[gl_InstanceID];vR6Clearance=dot(r6P,r6Plane.xyz)-r6Plane.w;':'vR6Clearance=1.;'):''}
  `);
  if(planes)shader.uniforms.r6GroundPlane={value:Array.from({length:GROUND_PLANE_CAPACITY},(_,i)=>planes[i]?.clone()??new T.Vector4(0,0,0,0))};
  let extras=stone?'varying float vR6Clearance;\nuniform vec3 terrainSoil;\n':'';
  if(kind==='terrain'){
   shader.uniforms.r6Footprints={value:field.footprint.map(p=>p.clone())};
   extras+=`uniform vec4 r6Footprints[${field.footprint.length}];
    float r6Footprint(vec2 q){float f=0.;for(int i=0;i<${field.footprint.length};i++){vec4 c=r6Footprints[i];f=max(f,1.-smoothstep(.68,1.12,length((q-c.xy)/c.zw)));}return f;}\n`;
  }
  if(kind==='terrain'||kind==='groundcover'||plant)extras+=windowGLSL(field);
  once(shader,'fragmentShader',uniformHook,uniformHook+'\n'+common+extras);
  if(kind==='terrain'){
   once(shader,'fragmentShader','float pigment = .96 + .07*broad + .045*middle;','float pigment = .97 + .045*broad + .025*middle;');
   once(shader,'fragmentShader','vec3 earth = terrainPath*(.87+.18*middle+.065*broad);',`
    vec4 r6Road=r6Field(vEPoint);
    vec2 r6Cell=vTerrainChart*23.,r6Id=floor(r6Cell),r6Local=fract(r6Cell)-.5;
    r6Local-=vec2(r6Hash(r6Id+2.3),r6Hash(r6Id+7.2))*.46-.23;
    float r6GrainAA=max(.04,length(fwidth(r6Cell))*.6);
    float r6Pebble=(1.-smoothstep(.11-r6GrainAA,.19+r6GrainAA,length(r6Local)))*step(.76,r6Hash(r6Id+9.3));
    float r6Worn=1.-smoothstep(.08,.31,pathDistance);
    vec3 earth=mix(terrainPath,terrainSoil,.12)*(.88+.12*r6Road.x+.08*r6Road.y+.035*r6Worn);
    earth*=.86+.17*r6Road.z+.11*r6Noise(vTerrainChart*38.+vec2(3,7));
    earth=mix(earth,terrainSoil*.72,r6Pebble*.12*mix(1.,.22,r6Worn));
   `);
   once(shader,'fragmentShader','earth = mix(earth,terrainSoil*.78,grit*.17);','earth = mix(earth,terrainSoil*.78,grit*.035);');
   once(shader,'fragmentShader','terrainMicroRelief = detailFade*(.004*(fine-.5) + rockMask*(.008*mineral-.004*fissure)\n          + pathMask*.002*(fine-.5));',`terrainMicroRelief = detailFade*((1.-pathMask)*.0012*(fine-.5)+rockMask*(.008*mineral-.004*fissure)+pathMask*(r6Pebble*.00045*mix(1.,.22,r6Worn)+.0035*(fine-.5)*mix(1.,.55,r6Worn)+(r6Road.z-.5)*.002+(r6Road.y-.5)*.0018));`);
   span(shader,' // Original r5 feature masks and wet-bank shading remain authoritative.','#include <roughnessmap_fragment>',terrainPaint);
   once(shader,'fragmentShader','#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor-.08*pathMask*(1.-r6Contact),.84,1.);');
  }else if(kind==='groundcover'){
   span(shader,' float eOwn=eOwnership(vEPoint);','#include <roughnessmap_fragment>',groundcoverPaint);
   once(shader,'fragmentShader','#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=r6Perturb(normal,r6Relief);');
  }else if(plant){
   once(shader,'fragmentShader','vec3 eLeaf=mix(eRoot,eBody,.23+.53*eBlade+.16*eBroad);',`
    vec4 r6LeafField=r6Field(vEPoint);
    float r6Wet=1.-smoothstep(.06,.62,vR6RootAltitude);
    vec3 r6Root=mix(eRoot,eRoot*vec3(.87,1.05,1.14),r6Wet*.6);
    vec3 eLeaf=mix(r6Root,eBody,.18+.58*eBlade+.13*eBroad);
    eLeaf=mix(eLeaf,eBody*vec3(1.10,1.01,.84),r6LeafField.y*eBlade*.24*(1.-r6Wet));
   `);
   once(shader,'fragmentShader','eLeaf*=.90+.14*eBroad;','eLeaf*=.87+.12*eBroad+.13*r6LeafField.x;');
   once(shader,'fragmentShader','#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor-.13*eBlade,.79,1.);');
  }else if(stone){
   span(shader,' float eOwn=eOwnership(vEPoint),eWash=eNoise(vEPoint*2.7+vec3(5,1,9));','#include <roughnessmap_fragment>',rockPaint.replace('R6_WET',kind==='shore-rock'?'*smoothstep(vWater-.015,vWater+.10,length(vPlanet))':''));
   once(shader,'fragmentShader','#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(.86+.10*r6Large-.06*r6Foot,.78,.98);');
  }else if(kind==='sand'){
   once(shader,'fragmentShader','grain*sand*.14','grain*sand*.19');
   once(shader,'fragmentShader','diffuseColor.rgb*=1.+sand*(mottling-.5)*.055;','diffuseColor.rgb*=1.+sand*(mottling-.5)*.09;');
  }
  if(kind==='terrain'||kind==='groundcover'||plant){
   once(shader,'fragmentShader','#include <opaque_fragment>',`
    outgoingLight+=diffuseColor.rgb*vec3(1.,.57,.26)*r6Window(vEPoint,normalize(vR6Normal))*eOwnership(vEPoint)*r6WindowGain;
    #include <opaque_fragment>`);
  }
  record.compiles++;record.uniforms=shader.uniforms;record.vertexShader=shader.vertexShader;record.fragmentShader=shader.fragmentShader;
 };
 return m;
}
