import {stoneMaterial} from './stone.js';
import * as T from 'three';
import {REVISION} from './field.js';
function once(shader,from,to){const s=shader.fragmentShader;if(s.split(from).length!==2)throw Error('R7 B shader contract changed: '+from.slice(0,90));shader.fragmentShader=s.replace(from,to);}
const common=String.raw`
uniform float bRootRadii[24];
uniform vec3 bAuxRoot;
uniform vec4 bRockContacts[12];
float bContact(vec2 q){float f=0.;for(int i=0;i<12;i++){vec4 c=bRockContacts[i];float d=length((q-c.xy)/c.zw);f=max(f,1.-smoothstep(.73,1.24,d));}return f;}
vec2 bClump(vec2 q){vec2 warp=vec2(r6Noise(q*.9+vec2(6,3)),r6Noise(q*.7+vec2(4,9)))-.5;return vec2(r6Noise(q*3.8+warp*.8+vec2(11,2)),r6Noise(q*8.7+warp*1.2+vec2(3,5)));}
vec3 bGrain(vec2 q,float worn){
 vec2 p=q*18.,id=floor(p),f=fract(p)-.5;
 f-=(vec2(r6Hash(id+vec2(8,2)),r6Hash(id+vec2(3,6)))-.5)*.42;
 float seed=r6Hash(id+vec2(6,13)),angle=seed*6.2831853;
 f=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*f;
 float radius=.12+.13*r6Hash(id+vec2(11,9));
 float shape=max(abs(f.x)*.86,abs(f.y)*1.37)+.24*length(f);
 float aa=max(length(fwidth(p))*.47,.018);
 float grain=(1.-smoothstep(radius-aa,radius+aa,shape))*step(.44+worn*.48,seed);
 float pit=(1.-smoothstep(.07-aa,.10+aa,length(f+vec2(.19,-.16))))*step(.79,r6Hash(id+vec2(7,5)));
 return vec3(grain,pit,r6Hash(id+vec2(13,1)));
}
float bSward(vec2 q){
 vec2 p=q*27.,id=floor(p),f=fract(p)-.5;
 float angle=r6Hash(id+vec2(14,9))*6.2831853;
 f=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*f;
 float along=(f.y+.32)/.68;
 float width=.085*(1.-clamp(along,0.,1.));
 float curve=.18*along*along-.07;
 float aa=max(fwidth(f.x),.018);
 float blade=(1.-smoothstep(width-aa,width+aa,abs(f.x-curve)))*smoothstep(0.,.12,along)*(1.-smoothstep(.83,1.,along));
 return blade*(.52+.48*r6Hash(id+3.))*(.35+.65*smoothstep(.32,.69,r6Noise(q*2.7+vec2(12,4))));
}
float bTurf(vec2 q){return bSward(q)+.65*bSward(mat2(.81,.59,-.59,.81)*q+vec2(5.1,2.7));}
float bRelief(vec2 q){vec2 clump=bClump(q);return .005*(clump.x-.5)+.0016*(clump.y-.5)+bTurf(q)*.00016;}
float bEdge(vec2 q){return .315+.035*sin(q.x*3.7+q.y*2.1)+.018*sin(q.y*6.1-q.x*1.4)+.018*sin(q.x*12.+q.y*7.+.8*sin(q.y*5.))+.012*sin(q.y*19.-q.x*7.)-.045*smoothstep(-.84,-.25,q.y)*(1.-smoothstep(.6,1.25,q.y));}
float bRootFoot(vec2 q){
 vec2 d=q-vec2(1.4,-2.7);float a=mod(atan(d.y,d.x)+6.283185307,6.283185307)*3.819718634;
 int i=int(floor(a));float radius=mix(bRootRadii[i],bRootRadii[(i+1)%24],fract(a));
 float edge=length(d)-radius;
 float root=1.-smoothstep(-.035,.21,edge+.025*sin(a*2.));
 float aux=1.-smoothstep(bAuxRoot.z-.04,bAuxRoot.z+.17,distance(q,bAuxRoot.xy));
 return max(root,aux);
}
vec3 bMeadow(vec4 f,float damp,vec2 q){
 float cover=r6Noise(q*.84+vec2(9,4));
 float hollow=smoothstep(.26,.68,r6Noise(q*.61+vec2(2,13)));
 vec2 clump=bClump(q);
 vec3 field=mix(eRoot,eBody,.31+.38*f.x+.11*cover);
 field=mix(field,eBody*vec3(1.045,1.025,.88),smoothstep(.45,.75,cover)*.25*(1.-damp));
 field=mix(field,eRoot*vec3(.95,1.04,1.10),hollow*damp*.14);
 field*=.79+.17*cover+.18*clump.x+(clump.y-.5)*.10;
 field=mix(field,eTip,f.w*.075+bTurf(q)*.018);
 field=mix(field,eTip,smoothstep(.56,.82,clump.x)*.10*(1.-damp*.5));
 return field;
}
`;
export function createMaterial(original,kind,field,record){
 if(['rock','shore-rock'].includes(kind))return stoneMaterial(original,kind,record);
 const material=original.clone(),callback=original.onBeforeCompile,key=original.customProgramCacheKey;
 if(original.userData.ecosystemWind)material.userData.ecosystemWind=original.userData.ecosystemWind;
 material.name=original.name+' / R9 B';material.userData.r7B={revision:REVISION,kind};
 material.customProgramCacheKey=()=>key.call(original)+'|'+REVISION+'|'+kind;
 material.onBeforeCompile=function(shader,renderer){
  callback.call(original,shader,renderer);record.sourceCalls++;
  for(const [name,color]of Object.entries(field.groundPalette))if(shader.uniforms[name])shader.uniforms[name]={value:new T.Color(color)};
  if(kind==='terrain'){shader.uniforms.terrainPath={value:new T.Color('#aa9477')};shader.uniforms.terrainSoil={value:new T.Color('#81755e')};}
  shader.uniforms.bRockContacts={value:Array.from({length:12},(_,i)=>field.rockContacts[i]?.clone()??new T.Vector4(1000,1000,1,1))};
  shader.uniforms.bRootRadii={value:field.mainRoot.radii.slice()};shader.uniforms.bAuxRoot={value:field.auxRoot.clone()};
  once(shader,'void main() {',common+'\nvoid main() {');
  once(shader,'vec3 eMeadow=r6Meadow(r6F,r6Damp);','vec3 eMeadow=bMeadow(r6F,r6Damp,eChart(vEPoint));');
  if(kind==='terrain'){
   once(shader,'float wornDistance = pathDistance + (middle-.5)*.065 + (brush-.5)*.055*dryEdge;',`float wornDistance=pathDistance-bEdge(vTerrainChart)+.315;`);
   once(shader,'float pathAA = max(fwidth(wornDistance),.018);','float pathAA = max(fwidth(wornDistance),.004);');
   once(shader,'float pathMask = 1.0-smoothstep(.268-pathAA,.354+pathAA,wornDistance);',`float bTuft=smoothstep(.34,.72,r6Noise(vTerrainChart*11.+vec2(3,8)));
    float pathMask=1.-smoothstep(.274-pathAA,.306+pathAA,wornDistance+bTuft*.028);`);
   once(shader,'float r6Worn=1.-smoothstep(.08,.31,pathDistance);','float r6Worn=1.-smoothstep(.13,.28,pathDistance);');
   once(shader,'vec3 earth=mix(terrainPath,terrainSoil,.12)*(.88+.12*r6Road.x+.08*r6Road.y+.035*r6Worn);',`vec3 earth=mix(terrainPath,terrainSoil,.38)*(.69+.10*r6Road.x+.06*r6Road.y+.06*r6Worn);`);
   once(shader,'float r6Contact=r6Footprint(eChart(vEPoint));','float r6Contact=bContact(eChart(vEPoint));');
   once(shader,'earth*=.86+.17*r6Road.z+.11*r6Noise(vTerrainChart*38.+vec2(3,7));',`vec2 bRoadClump=bClump(vTerrainChart);
    earth*=.80+.19*bRoadClump.x+.10*bRoadClump.y;
    float bDust=r6Noise(vTerrainChart*vec2(42.,19.)+3.);
    earth*=.94+.12*bDust;
    earth=mix(earth,terrainPath*vec3(.94,.96,.98),r6Worn*.08);
    vec3 bDirt=bGrain(vTerrainChart,r6Worn);
    vec3 bStone=mix(terrainSoil*.66,terrainPath*1.18,bDirt.z);
    earth=mix(earth,bStone,bDirt.x*.76);
    earth*=1.-bDirt.y*.18;
    float bShoulder=smoothstep(bEdge(vTerrainChart)-.13,bEdge(vTerrainChart),pathDistance);
    earth=mix(earth,bMeadow(r6Road,1.-smoothstep(.06,.72,vR6RootAltitude),vTerrainChart)*1.06,bShoulder*.48);`);
   once(shader,'r6Pebble*.00045*mix(1.,.22,r6Worn)+.0035*(fine-.5)*mix(1.,.55,r6Worn)+(r6Road.z-.5)*.002+(r6Road.y-.5)*.0018','bDirt.x*.0018-bDirt.y*.0012+.0032*(fine-.5)*mix(1.,.45,r6Worn)+(r6Road.y-.5)*.0014');
   once(shader,'earth *= 1.0-.13*smoothstep(.13,.32,pathDistance);','earth *= 1.0-.08*smoothstep(.19,.40,pathDistance);');
   once(shader,'terrainMicroRelief+=eLawn*((r6F.z-.5)*.0035+r6F.w*.0014+(r6F.y-.5)*.003);',`terrainMicroRelief=mix(terrainMicroRelief,terrainMicroRelief*.94,pathMask);
    terrainMicroRelief+=eLawn*(bRelief(eChart(vEPoint))+r6F.w*.00036+(r6F.z-.5)*.00045);
    diffuseColor.rgb=mix(diffuseColor.rgb,mix(terrainSoil,eRoot,.63)*(.85+.10*r6F.x),r6Contact*eOwn*.24);
    vec2 bQ=eChart(vEPoint);
    float bRoot=bRootFoot(bQ);
    vec3 bSoil=mix(terrainSoil,eRoot,.43)*(.88+.10*r6F.x);
    diffuseColor.rgb=mix(diffuseColor.rgb,bSoil,bRoot*.62);
    float bStep=exp(-pow((bQ.x+2.2)/.55,4.)-pow((bQ.y+.99)/.21,2.));
    diffuseColor.rgb=mix(diffuseColor.rgb,mix(terrainPath,terrainSoil,.3)*.85,bStep*.28);
   `);
  }else if(kind==='groundcover'){
   once(shader,'r6Relief=((r6F.z-.5)*.0035+r6F.w*.0014+(r6F.y-.5)*.003)*eOwn;',`r6Relief=(bRelief(eChart(vEPoint))+r6F.w*.00036+(r6F.z-.5)*.00045)*eOwn;
    float bRock=bContact(eChart(vEPoint));
    diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.3278,.2582,.1981),eRoot,.63)*(.85+.10*r6F.x),bRock*eOwn*.24);
    float bRoot=bRootFoot(eChart(vEPoint));
    diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.3278,.2582,.1981),eRoot,.43)*(.88+.10*r6F.x),bRoot*.62);`);
  }
  record.compiles++;record.uniforms=shader.uniforms;record.fragmentShader=shader.fragmentShader;record.vertexShader=shader.vertexShader;
 };
 return material;
}
