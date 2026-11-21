import * as T from 'three';
export const REVISION='r4-ground-wash-4';
// sRGB inputs. Three.Color converts these to working linear space.
export const PALETTE=Object.freeze({
 eRoot:'#33534d',eBody:'#6b8575',eTip:'#a9b695',
 eCream:'#e4ddcf',ePink:'#cda9b5',eLilac:'#aaa0c1',
 eStone:'#727f8a',eStoneWarm:'#a39d8e',
 terrainSoil:'#95897d',terrainPath:'#ae9782',
 terrainRock:'#737e82',terrainRockLight:'#a29d90',terrainRockShadow:'#485c69',
});
function once(shader,part,from,to){
 const source=shader[part],first=source.indexOf(from);
 if(first<0||source.indexOf(from,first+from.length)>=0)throw Error('R4 ground shader contract changed: '+from.slice(0,90));
 shader[part]=source.slice(0,first)+to+source.slice(first+from.length);
}
const rockNormal=String.raw`
varying vec3 vR4StoneNormal;
`;
const rockVertex=String.raw`
#include <begin_vertex>
vec3 r4StoneN=normal;
#ifdef USE_INSTANCING
 mat3 r4Instance=mat3(instanceMatrix);
 r4StoneN/=vec3(dot(r4Instance[0],r4Instance[0]),dot(r4Instance[1],r4Instance[1]),dot(r4Instance[2],r4Instance[2]));
 r4StoneN=r4Instance*r4StoneN;
#endif
vR4StoneNormal=normalize(r4StoneN);
`;
export function createGroundMaterial(original,kind,lighting,record){
 if(original.userData.eGround?.kind!==kind)throw Error('R4 ground requires retained R1 pigment kind: '+kind);
 const material=original.clone(),compile=original.onBeforeCompile,sourceKey=original.customProgramCacheKey();
 // .clone() JSON-copies userData and drops the custom callbacks. Reattach the
 // exact source wind owner/time, call the retained chain once, own only new colors.
 if(original.userData.ecosystemWind)material.userData.ecosystemWind=original.userData.ecosystemWind;
 material.userData.r4Ground={revision:REVISION,kind,source:original.uuid};
 material.customProgramCacheKey=()=>sourceKey+'|'+REVISION+'|'+kind;
 const stone=kind==='rock'||kind==='shore-rock';
 if(stone){
  material.roughness=.96;
  if(material.bumpMap)material.bumpScale=.012;
  material.emissiveIntensity=Math.min(material.emissiveIntensity,.008);
 }
 material.onBeforeCompile=(shader,renderer)=>{
  compile.call(material,shader,renderer);record.sourceCalls++;
  const expected=original.userData.ecosystemWind?.time;
  if(expected&&shader.uniforms.ecosystemTime!==expected)throw Error('R4 ground lost original shared wind uniform');
  for(const [name,value]of Object.entries(PALETTE))if(shader.uniforms[name]){
   // Never mutate the value object returned by the source closure.
   shader.uniforms[name]={value:new T.Color(value)};
  }
  if(kind==='terrain'){
   once(shader,'fragmentShader','float pigment = .90 + .14*broad + .11*middle;','float pigment = .96 + .07*broad + .045*middle;');
   once(shader,'fragmentShader','float eStroke=pow(max(0.,sin(dot(vEPoint,vec3(108.,7.,51.))+eMiddle*5.)),10.)*smoothstep(.38,.7,eWeave);',
    'float eStroke=pow(max(0.,sin(dot(vEPoint,vec3(83.,7.,41.))+eMiddle*5.)),6.)*smoothstep(.44,.75,eWeave);');
   once(shader,'fragmentShader','eMeadow*=.91+.14*eMiddle+eDetail*(eStroke*.095+(eWeave-.5)*.075);',
    'eMeadow*=.93+.11*eMiddle+eDetail*(eStroke*.064+(eWeave-.5)*.052);');
   once(shader,'fragmentShader','eMeadow,eLawn*.78','eMeadow,eLawn*.82');
   once(shader,'fragmentShader','terrainMicroRelief+=eLawn*eDetail*((eWeave-.5)*.0028+eStroke*.0017);',
    'terrainMicroRelief+=eLawn*eDetail*((eWeave-.5)*.0018+eStroke*.0010);');
   once(shader,'fragmentShader','vec3 earth = terrainPath*(.83+.21*middle+.08*broad);','vec3 earth = terrainPath*(.87+.18*middle+.065*broad);');
   once(shader,'fragmentShader','earth = mix(earth,terrainSoil*.72,grit*.24);','earth = mix(earth,terrainSoil*.78,grit*.17);');
   once(shader,'fragmentShader','mineralColor *= 1.0-.13*fissure;','mineralColor *= 1.0-.055*fissure;');
   once(shader,'fragmentShader','terrainMicroRelief = detailFade*(.006*(fine-.5) + rockMask*(.013*mineral-.007*fissure)\n          + pathMask*.003*(fine-.5));',
    'terrainMicroRelief = detailFade*(.004*(fine-.5) + rockMask*(.008*mineral-.004*fissure)\n          + pathMask*.002*(fine-.5));');
  }else if(kind==='groundcover'){
   once(shader,'fragmentShader','eMeadow*=.91+.14*eMiddle;','eMeadow*=.93+.11*eMiddle;');
  }else if(['grass','fern','flowers','understory'].includes(kind)){
   once(shader,'fragmentShader','eLeaf*=.88+.18*eBroad;','eLeaf*=.90+.14*eBroad;');
   once(shader,'fragmentShader',kind==='fern'?'smoothstep(.48,.97,eBlade)*.25':'smoothstep(.48,.97,eBlade)*.63',
    kind==='fern'?'smoothstep(.48,.97,eBlade)*.20':'smoothstep(.48,.97,eBlade)*.38');
   once(shader,'fragmentShader','outgoingLight=mix(outgoingLight,diffuseColor.rgb*vec3(.66,.73,.83),.10*eOwnership(vEPoint));',
    'outgoingLight=mix(outgoingLight,diffuseColor.rgb*vec3(.66,.73,.83),.045*eOwnership(vEPoint));');
  }else if(stone){
   // Tiny orientation-dependent pigment warmth; actual illumination, shadows,
   // reflected energy and specular still come from the selected standard lights.
   shader.uniforms.r4GroundKey={value:new T.Vector3(...lighting.directions.key).normalize()};
   once(shader,'vertexShader','#include <common>','#include <common>\n'+rockNormal);
   once(shader,'vertexShader','#include <begin_vertex>',rockVertex);
   once(shader,'fragmentShader','#include <common>','#include <common>\n'+rockNormal+'\nuniform vec3 r4GroundKey;\nfloat r4StoneRelief;');
   once(shader,'fragmentShader','vec3 eMineral=mix(eStone,eStoneWarm,smoothstep(.48,.84,eWash)*.45);',
    `float r4Facing=smoothstep(-.12,.82,dot(normalize(vR4StoneNormal),r4GroundKey));
 float r4StoneBroad=eNoise(vEPoint*vec3(1.6,.9,1.2)+vec3(2,7,3));
 float r4StoneBrush=eNoise(vEPoint*vec3(5.,11.,4.)+vec3(4,1,6));
 float r4StoneGrain=eNoise(vEPoint*vec3(22.,19.,17.)+vec3(8,3,1));
 float r4StoneVein=smoothstep(.37,.48,eWash)*(1.-smoothstep(.52,.66,eWash));
 float r4StoneDetail=1.-smoothstep(.035,.16,length(fwidth(vEPoint)));
 r4StoneRelief=r4StoneDetail*((eWash-.5)*.009+(r4StoneBrush-.5)*.010+(r4StoneGrain-.5)*.0035);
 vec3 eMineral=mix(eStone,eStoneWarm,.08+.30*r4Facing+.08*smoothstep(.48,.84,eWash));
 eMineral=mix(eMineral,eStoneWarm*(.94+.12*r4StoneBroad),r4StoneVein*.25);
 eMineral*=.88+.15*eWash+.12*r4StoneBroad+r4StoneDetail*((r4StoneBrush-.5)*.16+(r4StoneGrain-.5)*.055);`);
   once(shader,'fragmentShader','eMineral*=.62+eValue*1.30;','eMineral*=.74+eValue*.90;');
   once(shader,'fragmentShader','eMineral,eOwn*.56','eMineral,eOwn*.74');
   once(shader,'fragmentShader','#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 vec3 r4Dx=dFdx(-vViewPosition),r4Dy=dFdy(-vViewPosition);
 vec3 r4R1=cross(r4Dy,normal),r4R2=cross(normal,r4Dx);
 float r4Det=dot(r4Dx,r4R1);
 vec3 r4Gradient=sign(r4Det)*(dFdx(r4StoneRelief)*r4R1+dFdy(r4StoneRelief)*r4R2);
 normal=normalize(abs(r4Det)*normal-r4Gradient);`);
   if(kind==='shore-rock'){
    once(shader,'fragmentShader','diffuseColor.rgb*=.88+.24*wash;','diffuseColor.rgb*=.96+.08*wash;');
    once(shader,'fragmentShader','vec3(.16,.20,.12),moss*.45','vec3(.12,.19,.17),moss*.25');
    once(shader,'fragmentShader','diffuseColor.rgb*=1.+(fine-.5)*.055*aa;','diffuseColor.rgb*=1.+(fine-.5)*.018*aa;');
   }
  }else if(kind==='sand'){
   once(shader,'fragmentShader','diffuseColor.rgb*=1.+sand*(mottling-.5)*.12;','diffuseColor.rgb*=1.+sand*(mottling-.5)*.055;');
   once(shader,'fragmentShader','diffuseColor.rgb*=1.-sand*shadow*.13;','diffuseColor.rgb*=1.-sand*shadow*.055;');
   once(shader,'fragmentShader','grain*sand*.38','grain*sand*.14');
  }
  record.compiles++;record.uniforms=shader.uniforms;
  record.vertexShader=shader.vertexShader;record.fragmentShader=shader.fragmentShader;
 };
 return material;
}
