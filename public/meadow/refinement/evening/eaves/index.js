import * as T from 'three';
export const REVISION='evening-eaves-3';
// Original house.py roofpoint, converted from Blender Z-up to normalized GLB Y-up.
const Y=-.00371445;
function roof(x,t,s){return [x,3.34-1.11*t-.16*t*t+.065*Math.sin(Math.PI*t)-.035*Math.cos(x*1.4)+.018*Math.sin(x*2.1+t*1.7)+.035*(Math.abs(x)/2.02)**3+Y,-(.025+s*(1.62*t)+s*.035*Math.sin(x*1.7)*t*t)];}
export function install(ctx){
 const {assets,debug,invalidate}=ctx;
 if(!assets?.cottage)throw Error('Eaves require the retained cottage');
 const group=new T.Group();group.name='Evening / solid gable eave returns';
 const material=new T.MeshStandardMaterial({color:'#665344',roughness:.96,emissive:'#61432e',emissiveIntensity:.25,side:T.DoubleSide});
  // Grain runs along the verge; slight cross-grain waviness avoids a stripe pattern.
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vEavePoint;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvEavePoint=position;');
  shader.fragmentShader='varying vec3 vEavePoint;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float crossGrain=abs(vEavePoint.x)+.009*sin(vEavePoint.z*3.4)+.004*sin(vEavePoint.z*8.1+vEavePoint.x*7.);
   float fiber=sin(crossGrain*370.+sin(crossGrain*69.)*2.2);
   float fine=sin(crossGrain*913.+vEavePoint.z*1.7);
   float wash=sin(crossGrain*41.+vEavePoint.z*.8)*sin(vEavePoint.z*2.3+1.4);
   float pore=pow(max(0.,fiber),7.);
   diffuseColor.rgb*=.97+.075*wash+.025*fine-.115*pore;
   float worn=smoothstep(2.000,2.017,abs(vEavePoint.x));
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.12,1.09,1.06),worn*.45);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance*=.94+.1*wash-.18*pore;');
 };
 material.customProgramCacheKey=()=>REVISION;
 const vertices=[];
 const tri=(a,b,c)=>vertices.push(...a,...b,...c);
 const quad=(a,b,c,d)=>{tri(a,b,c);tri(a,c,d)};
 // Four closed shaped wood returns: tucked into the limewash at the inner edge,
 // terminating inside the original weathered verge, never moving roof or wall.
 for(const end of [-1,1])for(const side of [-1,1]){
  const rings=[];
  for(let i=0;i<=24;i++){
   const t=i/24;
   const ring=[];
   for(const x of [end*1.665,end*2.017]){
    const p=roof(x,t,side);p[1]-=.026;
    // Existing gable shell is straight. Overlap it by .035 to close bevel cracks.
    const by=-p[2],slope=side===1?(3.25-2.13)/(1.32-.025):(3.25-2.10)/(.025+1.33);
    const shell=3.25-Math.abs(by-.025)*slope+Y-.035;
    const bottom=Math.abs(x)>1.9?p[1]-.075:Math.min(shell,p[1]-.065);
    ring.push(p,[p[0],bottom,p[2]]);
   }
      const [innerTop,innerBottom,outerTop,outerBottom]=ring;
   const inset=p=>[p[0]-end*.009,p[1],p[2]];
   // Closed six-sided cross section: a 9 mm bevel inside the original verge.
   rings.push([innerTop,inset(outerTop),[outerTop[0],outerTop[1]-.009,outerTop[2]],[outerBottom[0],outerBottom[1]+.009,outerBottom[2]],inset(outerBottom),innerBottom]);
  }
  for(let i=0;i<24;i++){const a=rings[i],b=rings[i+1];for(let j=0;j<6;j++)quad(a[j],b[j],b[(j+1)%6],a[(j+1)%6]);}
  for(const a of [rings[0],rings[24]])for(let j=1;j<5;j++)tri(a[0],a[j],a[j+1]);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
 const mesh=new T.Mesh(geometry,material);mesh.name='Four curved solid walnut gable returns';mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);assets.cottage.add(group);
 const inspect=()=>({revision:REVISION,triangles:vertices.length/9,source:'prototype-astra-world/blender-study/house.py roofpoint + shell section',originalGeometryUntouched:true,originalTransformsUntouched:true,returns:4});
 debug.eaves=inspect();invalidate?.();let disposed=false;
 return {group,inspect,dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometry.dispose();material.dispose();delete debug.eaves;invalidate?.();}};
}




