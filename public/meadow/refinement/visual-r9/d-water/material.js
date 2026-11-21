import * as T from 'three';
export const REVISION='r9-water-broken-light-2';
const PALETTE={water_deep:'#164459',water_shallow:'#548e94',water_lavender:'#526c8b',water_stroke:'#94b3bc'};
function replace(source,anchor,next){
 if(source.indexOf(anchor)<0||source.indexOf(anchor)!==source.lastIndexOf(anchor))throw Error('R8 D shader anchor changed: '+anchor.slice(0,80));
 return source.replace(anchor,next);
}

// Static chart-space footprints are measured from the final candidate rock matrices.
// Their wash is additionally clipped to real water depth in the fragment shader.
function rockContacts(ctx){
 const found=[],matrix=new T.Matrix4(),v=new T.Vector3();
 ctx.shore.group.updateWorldMatrix(true,true);
 ctx.shore.group.traverse(mesh=>{
  if(!mesh.isInstancedMesh||!mesh.name.startsWith('fractured-shore-stones'))return;
  const p=mesh.geometry.getAttribute('position');
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);const us=[],vs=[];
   for(let j=0;j<p.count;j++){
    v.fromBufferAttribute(p,j).applyMatrix4(matrix).applyMatrix4(mesh.matrixWorld);
    ctx.world.worldToLocal(v);const uv=ctx.surface.uvFromDirection(v.toArray());us.push(uv[0]);vs.push(uv[1]);
   }
   const u=(Math.min(...us)+Math.max(...us))*.5,vv=(Math.min(...vs)+Math.max(...vs))*.5;
   const ru=(Math.max(...us)-Math.min(...us))*.5,rv=(Math.max(...vs)-Math.min(...vs))*.5;
   let wet=0;
   for(let k=0;k<16;k++){
    const a=k*Math.PI/8,uu=u+(ru+.12)*Math.cos(a),w=vv+(rv+.12)*Math.sin(a);
    const water=ctx.hydrology.waterAt(uu,w);if(water&&water.depth>=.002&&water.depth<.40)wet++;
   }
   if(wet)found.push({u,v:vv,ru,rv,wetSamples:wet,name:mesh.name,instance:i});
  }
 });
 return found.slice(0,12);
}

// Value and exact chart gradient. No screen-height derivatives, extra texture,
// clock or four additional height-field evaluations per pixel.
const declarations=/* glsl */`
uniform vec4 r8Rocks[R8_ROCK_COUNT];
uniform vec3 r8FoamColor;
vec3 r8NoiseD(vec2 q){
 vec2 i=floor(q),f=fract(q),w=f*f*(3.-2.*f),dw=6.*f*(1.-f);
 float a=waterHash(i),b=waterHash(i+vec2(1.,0.)),c=waterHash(i+vec2(0.,1.)),d=waterHash(i+vec2(1.,1.));
 float h=a+(b-a)*w.x+(c-a)*w.y+(a-b-c+d)*w.x*w.y;
 return vec3(h,dw.x*mix(b-a,d-c,w.y),dw.y*mix(c-a,d-b,w.x));
}
`;

export function createLook(source,ctx){
 const contacts=rockContacts(ctx),count=Math.max(1,contacts.length);
 const owned={r8Rocks:{value:Array.from({length:count},(_,i)=>{const c=contacts[i];return c?new T.Vector4(c.u,c.v,c.ru,c.rv):new T.Vector4(100,100,.001,.001)})},r8FoamColor:{value:new T.Color('#b4c6c2')}};
 const material=source.clone(),compile=source.onBeforeCompile,key=source.customProgramCacheKey;
 material.name='R9 / open sea, short reflected facets and tidal feather';
 material.roughness=.43;material.specularIntensity=.16;material.onBeforeRender=source.onBeforeRender;
 let shader=null,upstream=null,sourceFragment=null,sourceVertex=null;
 material.onBeforeCompile=function(s,renderer){
  compile.call(source,s,renderer);upstream={...s.uniforms};sourceFragment=s.fragmentShader;sourceVertex=s.vertexShader;
  Object.assign(s.uniforms,owned);
  for(const [name,color]of Object.entries(PALETTE))s.uniforms[name]={value:new T.Color(color)};
  s.fragmentShader=replace(s.fragmentShader,'      // Periodic components have unrelated directions and wavelengths.',
   '#define R8_ROCK_COUNT '+count+'\n'+declarations+'\n      // Periodic components have unrelated directions and wavelengths.');
  // The retained coordinate squeeze was stretching the river normal field into
  // long glossy ribbons. Use metre-like aspect and shorter, independently broken
  // cells while retaining the source clock and its entire optical chain.
  s.fragmentShader=replace(s.fragmentShader,'waterSlope(vec2(vWater.w*.23,vWater.y),time)*.55',
   'waterSlope(vec2(vWater.w*.92,vWater.y),time)*.32');
  s.fragmentShader=replace(s.fragmentShader,'q*vec2(5.0,24.0)','q*vec2(12.0,19.0)');
  s.fragmentShader=replace(s.fragmentShader,'swell*.005+ripple*.0028+fractured*.012+fine*.003*fineFade',
   'swell*.0016+ripple*.0015+fractured*.009+fine*.0022*fineFade');
  s.fragmentShader=replace(s.fragmentShader,'r6LaneGradient*.0038*cos(r6Lane)',
   'r6LaneGradient*.0007*cos(r6Lane)');
  // Keep the earlier periodic filament, but stop it defining full-width lanes.
  s.fragmentShader=replace(s.fragmentShader,'stream*r6FilamentFace*(.18*r6Filament*r6Filament)',
   'stream*r6FilamentFace*(.022*r6Filament*r6Filament)');
  s.fragmentShader=replace(s.fragmentShader,'      diffuseColor.rgb*=pigment;',/* glsl */`
      // Optical attenuation follows the final mesh's water-to-bed depth.
      // The source pigment, bank lace and every old wave field remain present.
      float r8Transmission=exp(-depth*(1.9+.65*wash));
      vec3 r8Body=mix(water_deep*(.64+.24*wash),water_shallow*(.66+.18*wash),r8Transmission);
      pigment=mix(pigment,r8Body,.45);
      // Material coordinates follow the real downstream arc length and width.
      vec2 r8River=vec2(vWater.w,r6Travel);
      vec3 r8Warp=r8NoiseD(r8River*vec2(2.2,1.15));
      vec2 r8ThreadQ=vec2(r8River.x*8.+(r8Warp.x-.5)*6.,r8River.y*3.2);
      vec3 r8Thread=r8NoiseD(r8ThreadQ);
      vec3 r8Fine=r8NoiseD(r8ThreadQ*vec2(1.7,1.4)+vec2(17.3,5.6));
      float r8Filament=smoothstep(.56,.81,r8Thread.x)*smoothstep(.28,.66,r8Fine.x);
      pigment=mix(pigment,water_stroke,stream*r8Filament*.035*detailFade);
      // A second bay scale interrupts the regular cross-wave cadence without
      // removing the inherited swell/ripple/fracture/fine components.
      vec2 r8BayQ=vec2(p.x*.72+.18*sin(p.y*.64),p.y*5.4-time*.43);
      vec3 r8Bay=r8NoiseD(r8BayQ);
      float r8BayMark=smoothstep(.56,.80,r8Bay.x)*(.35+.65*waterNoise(p*vec2(.9,2.1)));
      pigment=mix(pigment,water_stroke,(1.-stream)*r8BayMark*.027*detailFade);
      // Finite wave faces: every crest is broken across its length by two
      // independent material-space fields. No view-fixed painted reflection.
      vec2 r9FacetQ=p*vec2(3.7,7.9)+vec2(time*.035,-time*.21);
      vec3 r9Facet=r8NoiseD(r9FacetQ);
      float r9Crest=pow(.5+.5*sin(p.y*17.+p.x*2.4-time*.8+r9Facet.x*3.7),10.);
      float r9Broken=smoothstep(.47,.78,r9Facet.x)*smoothstep(.30,.68,waterNoise(p*vec2(8.3,4.1)));
      pigment=mix(pigment,water_stroke,r9Crest*r9Broken*.035*detailFade);
      float r8RockProximity=0.;
      for(int i=0;i<R8_ROCK_COUNT;i++){
       vec2 q=(p-r8Rocks[i].xy)/max(r8Rocks[i].zw+vec2(.10),vec2(.04));
       float rim=abs(length(q)-1.);
       r8RockProximity=max(r8RockProximity,1.-smoothstep(.04,.27,rim));
      }
      float r8FoamBreak=smoothstep(.46,.73,waterNoise(p*vec2(9.,12.)+vec2(0.,-time*.16)));
      float r8FoamDepth=smoothstep(.004,.025,depth)*(1.-smoothstep(.13,.30,depth));
      float r8RockWash=r8RockProximity*r8FoamDepth*r8FoamBreak;
      float r8MouthWash=r6MouthArea*r6MouthCrest*smoothstep(.40,.72,r8Thread.x)*r8FoamBreak;
      float r8BankWash=stream*smoothstep(.72,.92,abs(vWater.w))*r8FoamDepth
        *smoothstep(.64,.84,r8Fine.x)*smoothstep(.52,.76,r8Thread.x);
      // A shallow translucent wash is continuous in depth, with broken foam
      // islands inside it. Broad soft feather prevents a white contour outline.
      float r9Tide=smoothstep(.002,.018,depth)*(1.-smoothstep(.023,.085,depth));
      float r9Lace=r9Tide*(.24+.76*smoothstep(.38,.69,waterNoise(p*vec2(11.,8.)+vec2(time*.035,-time*.08))));
      pigment=mix(pigment,r8FoamColor,(r9Lace*.11+r8RockWash*.30+r8MouthWash*.14+r8BankWash*.16)*detailFade);
      diffuseColor.rgb*=pigment;`);
  s.fragmentShader=replace(s.fragmentShader,'      slope*=smoothstep(.005,.12,depth);',/* glsl */`
      // Explicit amplitude rebalance: the retained R6 normal is .68 at sea and
      // .32 in the river; all functions/frequencies remain, with new irregular
      // longitudinal currents supplying the previously missing directional scale.
      slope*=mix(.52,.24,stream);
      vec2 r8WarpD=r8Warp.yz*vec2(2.2,1.15);
      vec2 r8ThreadD=vec2(r8Thread.y*(8.+6.*r8WarpD.x),r8Thread.y*6.*r8WarpD.y+r8Thread.z*3.2);
      vec2 r8FineD=vec2(r8Fine.y*1.7*(8.+6.*r8WarpD.x),r8Fine.y*1.7*6.*r8WarpD.y+r8Fine.z*1.4*3.2);
      vec2 r8CurrentGradient=r8ThreadD*.0028+r8FineD*.0012;
      vec2 r8CurrentSlope=vec2(dot(r8CurrentGradient,dFdx(r8River)),dot(r8CurrentGradient,dFdy(r8River)));
      vec2 r8BayGradient=vec2(r8Bay.y*.72,r8Bay.y*.1152*cos(p.y*.64)+r8Bay.z*5.4)*.004;
      vec2 r8BaySlope=vec2(dot(r8BayGradient,dFdx(p)),dot(r8BayGradient,dFdy(p)));
      vec2 r9FacetGradient=r9Facet.yz*vec2(3.7,7.9)*.005;
      vec2 r9FacetSlope=vec2(dot(r9FacetGradient,dFdx(p)),dot(r9FacetGradient,dFdy(p)));
      slope+=mix(r8BaySlope,r8CurrentSlope,stream)+r9FacetSlope;
      slope*=smoothstep(.005,.12,depth);`);
  s.fragmentShader=replace(s.fragmentShader,'roughnessFactor=clamp(roughness+.045*wash+.08*shore+.05*stream+.07*r6Wash,.36,.74);',
   'roughnessFactor=clamp(roughness+.035*wash+.055*shore+.025*stream+.08*r8RockWash,.34,.68);');
  s.fragmentShader=replace(s.fragmentShader,'vec3 r6ReflectionNormal=normalize(mix(normal,geometryNormal,.24));',
   'vec3 r6ReflectionNormal=normalize(mix(normal,geometryNormal,.62));');
  // The inherited waterData arc resets outside the river ownership ribbon.
  // A derivative across that seam is not a physical current and can create
  // a fine grid of reflected normals. Keep the original continuous chart wave
  // already evaluated above, and use it only where the arc is over-stretched.
  s.fragmentShader=replace(s.fragmentShader,'vec2 slope=waterSlope(p,time);',
   'vec2 slope=waterSlope(p,time); vec2 r9ChartSlope=slope;');
  s.fragmentShader=replace(s.fragmentShader,'normal=waterPerturb(-vViewPosition,normal,slope);',/* glsl */`
      float r9FlowStretch=length(vec2(dFdx(vWater.y),dFdy(vWater.y)))/max(length(fwidth(p)),1e-5);
      vec2 r9ContinuousSlope=r9ChartSlope*.38*smoothstep(.005,.12,depth);
      vec2 r9SafeSlope=mix(slope,r9ContinuousSlope,smoothstep(2.5,6.,r9FlowStretch));
      normal=waterPerturb(-vViewPosition,normal,r9SafeSlope);`);
  shader=s;
 };
 material.customProgramCacheKey=()=>key.call(source)+'|'+REVISION+'|rocks-'+count;
 return {material,contacts,palette:PALETTE,inspect:()=>({shader,upstream,owned,sourceFragment,sourceVertex,clock:shader?.uniforms.waterTime})};
}
