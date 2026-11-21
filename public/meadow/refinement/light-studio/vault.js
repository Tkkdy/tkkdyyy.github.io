import {uniforms as study} from './engine.js';
import * as T from 'three';
import {install as installEvening} from './air.js';
import {install as installGesture} from '../night-sky/gesture/index.js';

// Align the painted sky to the stable default camera. Once in world space the
// vault stays put while the visitor moves, rotates the planet or scrolls.
const orientation=new T.Quaternion(-.1204323993,.1679145394,.020673043,.9781990441);
const toPlate = new T.Matrix3().setFromMatrix4(new T.Matrix4().makeRotationFromQuaternion(orientation)).transpose();
const paintSky = `
uniform mat3 toPlate;
uniform sampler2D skyArt;
uniform float skyEnabled, portrait,studyHaze,studyGalaxy;
uniform vec3 studyHazeTint;
vec3 storySky(vec3 ray, vec3 fallback) {
  vec3 p=toPlate*ray;
  vec2 xy=p.xy/max(.05,-p.z);
  vec2 uv=vec2(.5)+xy/vec2(1.4,.788)+portrait*vec2(.043,.067);
  // Reflect only the soft margins outside the painted view and dissolve them
  // into the closed sky. This avoids dragging the last row into long streaks.
  vec2 outside=max(max(-uv,uv-1.),0.);
  vec2 mirrored=1.-abs(mod(uv,2.)-1.);
  float margin=max(outside.x,outside.y);
  vec3 colour=texture2D(skyArt,mirrored).rgb;
  if(margin>0.) colour=mix(colour,textureLod(skyArt,clamp(uv,.006,.994),6.).rgb,smoothstep(0.,.037,margin));
  if(portrait>.001 && uv.x>.53){
    float spine=.514+.535*uv.x;
    float strip=(1.-smoothstep(.023,.096,abs(uv.y-spine)))*smoothstep(.53,.62,uv.x)*portrait;
    vec3 clearBlue=mix(textureLod(skyArt,vec2(mirrored.x,clamp(spine-.105,0.,1.)),5.).rgb,
                       textureLod(skyArt,vec2(mirrored.x,clamp(spine+.105,0.,1.)),5.).rgb,
                       smoothstep(spine-.105,spine+.105,uv.y));
    colour=mix(colour,clearBlue,strip);
  }
  float edge=1.-smoothstep(.0,.26,max(outside.x,outside.y));
  float horizon=exp(-pow((xy.y+.24)/.36,2.));
  vec3 vault=mix(vec3(.008,.015,.048),vec3(.096,.077,.181),horizon);
  vec3 albedo=mix(vault,colour,edge*smoothstep(.25,.69,-p.z));
  vec3 sunRay=normalize(bookSun-cameraPosition);
  vec3 delta=toPlate*(ray-sunRay);
  float front=smoothstep(.35,.8,dot(ray,sunRay));
  float halo=front*exp(-dot(delta.xy*vec2(4.8,8.2),delta.xy*vec2(4.8,8.2)));
  float ember=front*exp(-dot(delta.xy*vec2(11.,17.),delta.xy*vec2(11.,17.)));
  float wing=exp(-pow((uv.y-(.514+.535*uv.x))/.047,2.))*edge*smoothstep(.25,.69,-p.z);
  albedo*=1.+(studyGalaxy-1.)*wing;
  albedo+=studyHaze*studyHazeTint*front*exp(-dot(delta.xy*vec2(2.4,4.8),delta.xy*vec2(2.4,4.8)));
  return mix(fallback,albedo+vec3(.52,.205,.077)*halo+vec3(.36,.14,.032)*ember,skyEnabled);
}`;

export async function install(ctx) {
  const asset=ctx.quality==='mobile'?'vault-mobile.webp':'vault.webp';
  const texture=await new T.TextureLoader().loadAsync(new URL('../vesper/art/'+asset,import.meta.url).href);
  if(ctx.signal?.aborted){texture.dispose();throw new DOMException('Aborted','AbortError');}
  texture.colorSpace=T.SRGBColorSpace;
  const air=installEvening(ctx);
  const dome=ctx.scene.getObjectByName('Storybook twilight vault'),mat=dome.material;
  const galaxy=ctx.cosmic.exports.nodes.galaxy,visible=galaxy.visible;
  const prior={fragment:mat.fragmentShader,uniforms:mat.uniforms,render:dome.onBeforeRender,update:ctx.cosmic.update};
  const gesture=installGesture(ctx);
  const stars=ctx.cosmic.exports.nodes.stars, starMaterial=stars.material;
  const previousVertex=starMaterial.vertexShader;
  const tint=stars.geometry.getAttribute('aTint');
  const marker='vec4(blue+dusk(),1.)';
  if(!prior.fragment.includes(marker)){gesture.dispose();air.dispose();texture.dispose();throw Error('Twilight vault shader changed');}
  // The previous painting supplied the bright cores of its interactive stars.
  // Reveal only the tint increment from the frozen hover controller on this brighter sky.
  const restRed=Float32Array.from({length:tint.count},(_,i)=>tint.getX(i));
  stars.geometry.setAttribute('aRestRed',new T.InstancedBufferAttribute(restRed,1));
  starMaterial.vertexShader='attribute float aRestRed;\n'+previousVertex.replace('gl_Position=',
    'vGain+=.21*clamp(aTint.r/max(aRestRed,.01)-1.,0.,.65);\n    gl_Position=');
  starMaterial.needsUpdate=true;
  mat.uniforms={...prior.uniforms,studyHaze:study.studyHaze,studyHazeTint:study.studyHazeTint,studyGalaxy:study.studyGalaxy,toPlate:{value:toPlate},skyArt:{value:texture},skyEnabled:{value:1},portrait:{value:0}};
  mat.fragmentShader=prior.fragment.replace('void main(){',paintSky+'\nvoid main(){').replace(marker,'vec4(storySky(ray,blue+dusk()),1.)');
  mat.needsUpdate=true;
  galaxy.visible=false;
  dome.onBeforeRender=function(...args){
    prior.render.apply(this,args);
    mat.uniforms.skyEnabled.value=ctx.cosmic.group.visible?1:0;
    mat.uniforms.portrait.value=1-T.MathUtils.smoothstep(ctx.camera.aspect,.60,1.02);
  };
  ctx.cosmic.update=function(frame){
    const changed=prior.update.call(this,frame);
    return gesture.update(frame)||changed;
  };
  ctx.debug.art.gesture=gesture;
  ctx.debug.art.night={inspect:()=>({asset,variant:'final',size:[texture.image.width,texture.image.height]})};
  ctx.debug.version='柔暮星野';
  ctx.debug.baseline='881e69c';
  let disposed=false;
  function dispose(){
    if(disposed)return;
    disposed=true;
    ctx.signal?.removeEventListener('abort',dispose);
    ctx.cosmic.update=prior.update;
    gesture.dispose();
    starMaterial.vertexShader=previousVertex;starMaterial.needsUpdate=true;
    stars.geometry.deleteAttribute('aRestRed');
    dome.onBeforeRender=prior.render;
    mat.fragmentShader=prior.fragment;mat.uniforms=prior.uniforms;mat.needsUpdate=true;
    galaxy.visible=visible;
    air.dispose();texture.dispose();ctx.invalidate();
  }
  ctx.signal?.addEventListener('abort',dispose,{once:true});
  return {inspect:air.inspect,dispose};
}
