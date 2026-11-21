import * as T from 'three';
export async function tintGround(ctx){
 const mesh=ctx.terrain.group.children.find(m=>m.isMesh&&m.material.userData.eGround?.kind==='terrain');
 const ink=await new T.TextureLoader().loadAsync(new URL('./turf-strokes.webp',import.meta.url).href);
 ink.wrapS=ink.wrapT=T.RepeatWrapping;ink.colorSpace=T.NoColorSpace;ink.anisotropy=4;
 const source=mesh.material,mat=source.clone();
 if(Object.hasOwn(source,'onBeforeRender'))mat.onBeforeRender=source.onBeforeRender;
 mat.customProgramCacheKey=()=>source.customProgramCacheKey()+'|storybook-turf-1';
 mat.onBeforeCompile=(s,r)=>{
  source.onBeforeCompile(s,r);s.uniforms.bookTurf={value:ink};
  s.fragmentShader='uniform sampler2D bookTurf;\n'+s.fragmentShader.replace('#include <roughnessmap_fragment>',`
   vec2 bookQ=eChart(vEPoint);
   float bookDry=(1.-pathMask)*(1.-rockMask)*smoothstep(.12,.64,vTerrainFeatures.x)*(1.-smoothstep(12.,19.,length(bookQ)));
   float pocket=r6Noise(bookQ*.65+.52*vec2(r6Noise(bookQ*.83),r6Noise(bookQ*.67+9.)));
   vec2 weave=mat2(.94,-.34,.34,.94)*bookQ*.37+vec2(.042*sin(bookQ.y*1.8),.037*cos(bookQ.x*1.2));
   vec3 stroke=texture2D(bookTurf,weave).rgb;
   float fleck=dot(stroke,vec3(.31,.55,.14))-.46;
   vec3 sage=mix(vec3(.068,.124,.095),vec3(.215,.231,.104),smoothstep(.27,.72,pocket));
   // Wide cool and sun-warmed patches support the actual stems. The stamped
   // grass strokes provide small-scale pigment between those rooted clumps.
   sage*=.89+fleck*2.3;
   diffuseColor.rgb=mix(diffuseColor.rgb,mix(diffuseColor.rgb,sage,.61),bookDry*.96);
   diffuseColor.rgb+=bookDry*vec3(.085,.067,.035)*smoothstep(.015,.11,fleck);
   #include <roughnessmap_fragment>`);
 };
 mesh.material=mat;
 return ()=>{if(mesh.material===mat)mesh.material=source;mat.dispose();ink.dispose();};
}
