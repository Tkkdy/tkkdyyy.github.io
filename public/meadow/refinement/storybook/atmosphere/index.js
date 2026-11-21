import {tintGround} from './ground.js';
import * as T from 'three';

const skyVertex = `
 varying vec2 vUv;
 varying vec3 bookWorld;
 void main(){
  vUv=uv;
  vec4 pt=modelMatrix*vec4(position,1.);
  bookWorld=pt.xyz;
  gl_Position=projectionMatrix*viewMatrix*pt;
 }`;
const air = `
 varying vec3 bookWorld;
 uniform vec3 bookSun;
 vec3 dusk(){
  vec3 ray=normalize(bookWorld-cameraPosition);
  vec3 sun=normalize(bookSun-cameraPosition);
  vec3 side=normalize(cross(sun,vec3(0.,1.,0.)));
  vec3 up=cross(side,sun);
  float x=dot(ray,side), y=dot(ray,up);
  float front=smoothstep(.5,.88,dot(ray,sun));
  float veil=exp(-x*x*4.-y*y*13.);
  float rose=exp(-x*x*18.-y*y*70.);
  float amber=exp(-x*x*85.-y*y*330.);
  return front*(vec3(.028,.018,.050)*veil+vec3(.103,.039,.040)*rose+vec3(.29,.115,.040)*amber);
 }`;
export async function install(ctx){
 const {cosmic,scene,world,water,signal}=ctx;
 const {sun,galaxy,stars}=cosmic.exports.nodes;
 const field=galaxy.getObjectByName('sky-field');
 const resources=[],bindings=[],undo=[];
 const sunPosition=new T.Vector3();
 function replace(mesh,mat){
  bindings.push([mesh,mesh.material]);resources.push(mat);mesh.material=mat;
 }
 const common={bookSun:{value:sunPosition}};
 undo.push(await tintGround(ctx));
 const painted=galaxy.material.clone();
 Object.assign(painted.uniforms,common);
 painted.vertexShader=skyVertex;
 const dust=`
 float starHash(vec2 x){return fract(sin(dot(x,vec2(127.1,311.7)))*43758.5453);}
 float skyNoise(vec2 x){
  vec2 a=floor(x),u=fract(x);u=u*u*(3.-2.*u);
  return mix(mix(starHash(a),starHash(a+vec2(1.,0.)),u.x),mix(starHash(a+vec2(0.,1.)),starHash(a+1.),u.x),u.y);
 }
 vec3 granulate(vec3 p,vec2 uv){
  float dust=.50*skyNoise(uv*53.)+.31*skyNoise(uv*137.)+.19*skyNoise(uv*402.);
  vec3 base=p*(.68+.68*dust);
  vec2 grid=uv*vec2(710.,420.),cell=floor(grid),loc=fract(grid);
  vec2 anchor=.18+.64*vec2(starHash(cell+92.),starHash(cell+193.));
  float amp=starHash(cell+617.),size=.09+.11*amp;
  float blur=max(.045,length(fwidth(grid))*.28);
  float spark=(1.-smoothstep(size-blur,size+blur,length(loc-anchor)))*smoothstep(.985,1.,amp);
  return base+spark*vec3(.88,.83,1.)*(.22+.8*smoothstep(.025,.25,p.b));
 }`;
 painted.fragmentShader=air+dust+painted.fragmentShader
  .replace('texture2D(uMap,vUv)','texture2D(uMap,vec2(vUv.x,clamp(vUv.y-.14,0.,1.)))')
  .replace('vec4(paint.rgb,edge)','vec4(granulate(paint.rgb*vec3(.41,.40,.54),vUv)+vec3(.003,.005,.013)+dusk(),edge)');
 replace(galaxy,painted);
 // A closed twilight vault also covers oblique inspection and narrow framing.
 const domeGeo=new T.SphereGeometry(78,40,24);
 const back=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,depthTest:false,toneMapped:false,uniforms:common,
  vertexShader:skyVertex.replace('projectionMatrix*viewMatrix*pt;','projectionMatrix*viewMatrix*pt;gl_Position.z=gl_Position.w*.99999;'),
  fragmentShader:air+`void main(){
   vec3 ray=normalize(bookWorld-cameraPosition);
   vec3 blue=mix(vec3(.009,.014,.040),vec3(.0013,.003,.011),smoothstep(-.32,.55,ray.y));
   gl_FragColor=vec4(blue+dusk(),1.);
   #include <colorspace_fragment>
  }`});
 const dome=new T.Mesh(domeGeo,back);dome.name='Storybook twilight vault';dome.renderOrder=-60;dome.frustumCulled=false;
 scene.add(dome);const wasVisible=field.visible;field.visible=false;
 undo.push(()=>{field.visible=wasVisible;dome.removeFromParent();domeGeo.dispose();back.dispose();});
 const starMat=stars.material.clone();
 starMat.vertexShader=starMat.vertexShader.replace('aCenter+vec3(position.xy*aSize,0.)','aCenter+vec3(0.,aPainted*.14*'+galaxy.geometry.parameters.height.toFixed(4)+',0.)+vec3(position.xy*aSize,0.)');
 starMat.fragmentShader=starMat.fragmentShader.replace('vTint,','vTint*.82,');
 // Preserve the upstream twinkle clock.
 starMat.uniforms=stars.material.uniforms;painted.uniforms.uTime=bindings[0][1].uniforms.uTime;painted.uniforms.uMotion=bindings[0][1].uniforms.uMotion;
 replace(stars,starMat);
 const sync=()=>sun.getWorldPosition(sunPosition);
 const previousCallback=dome.onBeforeRender;
 dome.onBeforeRender=function(...args){sync();previousCallback.apply(this,args);};
 undo.push(()=>dome.onBeforeRender=previousCallback);sync();
 for(const [name,color,factor] of [['R1 twilight key','#ffdaa6',1.30],['R1 twilight rim','#ffc6a5',1.08],['R1 twilight fill','#b8b4ef',1.10]]){
  const light=world.getObjectByName(name);const old=light.color.clone(),level=light.intensity;
  light.color.set(color);light.intensity*=factor;undo.push(()=>{light.color.copy(old);light.intensity=level;});
 }
 const fog=scene.fog;scene.fog=new T.Fog('#807392',21,130);undo.push(()=>scene.fog=fog);
 const mesh=water.group.children.find(o=>o.isMesh),source=mesh.material,mat=source.clone();
 if(Object.hasOwn(source,'onBeforeRender'))mat.onBeforeRender=source.onBeforeRender;
 mat.customProgramCacheKey=()=>source.customProgramCacheKey()+'|storybook-dusk-water-1';
 mat.onBeforeCompile=(shader,r)=>{
  source.onBeforeCompile(shader,r);
  shader.uniforms.bookSun=common.bookSun;
  shader.fragmentShader='uniform vec3 bookSun;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`
   vec3 bookL=normalize((viewMatrix*vec4(bookSun,1.)).xyz+vViewPosition);
   vec3 bookH=normalize(bookL+normalize(vViewPosition));
   float lobe=pow(max(0.,dot(normal,bookH)),28.);
   float flashes=smoothstep(.16,.66,r9Crest*r9Broken);
   outgoingLight*=mix(vec3(.69,.73,.93),vec3(.88,.90,1.),stream);
   outgoingLight+=vec3(.53,.225,.094)*lobe*(.11+.89*flashes)*(1.-stream);
   #include <opaque_fragment>`);
 };
 replace(mesh,mat);
 let disposed=false;
 function dispose(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);for(const f of undo.reverse())f();for(const [o,m]of bindings)o.material=m;resources.forEach(m=>m.dispose());ctx.invalidate();}
 signal?.addEventListener('abort',dispose,{once:true});
 return {dispose,inspect:()=>({sky:'world anchored dusk, retained painted sky',water:'wave-broken sun reflection, one mesh',skyDrawsReplaced:1,disposed})};
}
