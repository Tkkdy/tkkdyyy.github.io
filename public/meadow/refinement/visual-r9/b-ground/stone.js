import * as T from 'three';
// Geometry and instance placement remain owned by A/R3. This adapter only
// describes sediment, fissures and moss in the existing planet coordinates.
export function stoneMaterial(source,kind,record){
 const m=source.clone(),compile=source.onBeforeCompile,key=source.customProgramCacheKey();
 m.name=source.name+' / R9 weathered mineral';m.roughness=.96;
 m.customProgramCacheKey=()=>key+'|r9-stratified-stone-1|'+kind;
 m.onBeforeCompile=(s,r)=>{
  compile.call(source,s,r);record.sourceCalls++;
  s.uniforms.eStone={value:new T.Color('#7d8090')};s.uniforms.eStoneWarm={value:new T.Color('#b2a18e')};
  function change(a,b){if(!s.fragmentShader.includes(a))throw Error('R9 stone source changed: '+a);s.fragmentShader=s.fragmentShader.replace(a,b);}
  change('float r6Plane=eNoise(vEPoint*vec3(6.2,7.5,5.1)+vec3(r6Warp*.7,2.));',`float r6Plane=eNoise(vEPoint*vec3(6.2,7.5,5.1)+vec3(r6Warp*.7,2.));
   float bLayerPhase=dot(vEPoint,vec3(2.1,16.,3.7))+r6Large*2.1+r6Noise(r6Q*3.)*.9;
   float bResolved=1.-smoothstep(.35,1.2,fwidth(bLayerPhase));
   float bLayer=pow(.5+.5*sin(bLayerPhase),12.)*bResolved;
   float bBroken=smoothstep(.31,.69,r6Noise(r6Q*4.7+2.));
   float bFracture=bLayer*bBroken;
   float bMottle=r6Noise(r6Q*7.1+vec2(3,1));`);
  change('eMineral*=.80+.28*r6Plane+.13*r6Large-r6Seam*.09+r6Detail*(r6Grit-.5)*.045;',`eMineral*=.77+.30*r6Plane+.16*r6Large-bFracture*.24+r6Detail*(r6Grit-.5)*.065;
   eMineral=mix(eMineral,eStoneWarm*1.03,bLayer*(1.-bBroken)*.13);`);
  change('eMineral=mix(eMineral,r6Earth,r6Foot*.34);',`eMineral=mix(eMineral,r6Earth,r6Foot*.34);
   float bMoss=r6Foot*smoothstep(.46,.75,bMottle)*smoothstep(-.05,.65,dot(normalize(vR4StoneNormal),normalize(vEPoint)));
   eMineral=mix(eMineral,mix(eRoot,eBody,bMottle)*.83,bMoss*.48);`);
  change('r4StoneRelief=r6Detail*((r6Plane-.5)*.014-r6Seam*.001+(r6Grit-.5)*.0035)*eOwn;', 'r4StoneRelief=r6Detail*((r6Plane-.5)*.019-bFracture*.007+(r6Grit-.5)*.0045)*eOwn;');
  record.compiles++;record.uniforms=s.uniforms;record.fragmentShader=s.fragmentShader;record.vertexShader=s.vertexShader;
 };return m;
}
