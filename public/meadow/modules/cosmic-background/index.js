import * as T from 'three';
import {PARAMETERS} from './config.js';
import {samplePainting} from './painted-stars.js';
import {vertex,galaxyFragment,sunFragment,moonFragment,starVertex,starFragment,skyFieldFragment} from './shaders.js';

function randomSource(seed){let x=seed>>>0;return()=>{x+=0x6D2B79F5;let t=Math.imul(x^x>>>15,x|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const abortError=()=>new DOMException('CosmicBackground loading aborted','AbortError');

/** Artwork owns local meshes; the host continues to own rendering, pose and time. */
export async function createModule(context, options={}) {
  const group=new T.Group();group.name='CosmicBackground';
  const nodes={},resources=new Set();
  let disposed=false,unregister;
  function dispose(){
    if(disposed)return;
    disposed=true;context.signal?.removeEventListener('abort',dispose);unregister?.();
    for(const resource of resources)resource.dispose();
    resources.clear();group.clear();group.removeFromParent();
  }
  if(context.signal?.aborted)throw abortError();
  context.signal?.addEventListener('abort',dispose,{once:true});
  const mobile=context.quality==='mobile';
  const assets=mobile?['sky-painted-v7-mobile.png','sun-painted-v2-mobile.png','moon-painted-v2-mobile.png']
    :['sky-painted-v7.png','sun-painted-v2-display.png','moon-painted-v2-display.png'];
  async function loadTexture(file){
    const texture=await new T.TextureLoader().loadAsync(new URL(`./art/${file}`,import.meta.url).href);
    if(disposed){texture.dispose();throw abortError();}
    texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearMipmapLinearFilter;
    texture.magFilter=T.LinearFilter;texture.generateMipmaps=true;texture.anisotropy=1;
    resources.add(texture);return texture;
  }
  try {
    // Each late load frees itself if a sibling fails or the host aborts.
    const [skyTexture,sunTexture,moonTexture]=await Promise.all(assets.map(loadTexture));
    if(disposed)throw abortError();
    const {azimuth,elevation}=PARAMETERS;
    const right=new T.Vector3(Math.cos(azimuth),0,-Math.sin(azimuth));
    const outward=new T.Vector3(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation));
    const up=new T.Vector3().crossVectors(outward,right);
    const orientation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,outward));
    const origin=new T.Vector3(...PARAMETERS.origin);
    const presentation=mobile?PARAMETERS.mobile:{galaxy:PARAMETERS.galaxy,sun:PARAMETERS.sun,moon:PARAMETERS.moon};
    const place=(x,y,depth)=>origin.clone().addScaledVector(right,x).addScaledVector(up,y).addScaledVector(outward,-depth);
    function material(fragmentShader,uniforms,transparent=true){
      const result=new T.ShaderMaterial({vertexShader:vertex,fragmentShader,uniforms,transparent,depthWrite:false,depthTest:true,toneMapped:false});
      resources.add(result);return result;
    }
    function panel(name,shader,texture,order,transparent=true){
      const config=presentation[name],geometry=new T.PlaneGeometry(config.width,config.height);resources.add(geometry);
      const mesh=new T.Mesh(geometry,material(shader,{uMap:{value:texture},uTime:{value:0},uMotion:{value:0}},transparent));
      mesh.name=name;mesh.position.copy(place(config.x,config.y,config.depth));mesh.quaternion.copy(orientation);mesh.renderOrder=order;
      nodes[name]=mesh;group.add(mesh);return mesh;
    }
    // A finite distant art plane, not CSS, a camera-locked overlay, or scene.background.
    const galaxy=panel('galaxy',galaxyFragment,skyTexture,-40);
    // A finite dark-blue backing lets the smaller painting retain sharpness and quiet margins.
    const fieldGeometry=new T.PlaneGeometry(152,100);resources.add(fieldGeometry);
    const field=new T.Mesh(fieldGeometry,material(skyFieldFragment,{
      uTop:{value:new T.Color('#020a18')},uBottom:{value:new T.Color('#0a1c35')},
    },false));
    field.name='sky-field';field.renderOrder=-42;
    field.position.set(-presentation.galaxy.x,-presentation.galaxy.y,-4);galaxy.add(field);
    panel('sun',sunFragment,sunTexture,-38);
    panel('moon',moonFragment,moonTexture,-37);
    const anchors=samplePainting(skyTexture.image,mobile?30:48);
    const random=randomSource(context.seed??PARAMETERS.seed);
    const count=Math.min(mobile?PARAMETERS.mobileStarCount:PARAMETERS.starCount,anchors.length+(mobile?80:160));
    const centers=[],sizes=[],tints=[],phases=[],painted=[];
    for(let i=0;i<count;i++){
      const anchor=anchors[i];
      if(anchor){
        centers.push(presentation.galaxy.x+(anchor.u-.5)*presentation.galaxy.width,
          presentation.galaxy.y+(anchor.v-.5)*presentation.galaxy.height,-presentation.galaxy.depth+.012);
        sizes.push(.13+anchor.strength*.20);tints.push(.84,.78,.95);painted.push(1);
      } else {
        centers.push((random()-.5)*PARAMETERS.stars.width,(random()-.5)*PARAMETERS.stars.height,
          -PARAMETERS.stars.depthMin-random()*(PARAMETERS.stars.depthMax-PARAMETERS.stars.depthMin));
        sizes.push(.035+random()*.065);tints.push(.57,.65,.85);painted.push(0);
      }
      phases.push(random()*Math.PI*2);
    }
    const base=new T.PlaneGeometry(2,2),geometry=new T.InstancedBufferGeometry();
    geometry.index=base.index.clone();geometry.setAttribute('position',base.attributes.position.clone());geometry.setAttribute('uv',base.attributes.uv.clone());base.dispose();
    for(const [name,array,size] of [['aCenter',centers,3],['aSize',sizes,1],['aTint',tints,3],['aPhase',phases,1],['aPainted',painted,1]]) {
      geometry.setAttribute(name,new T.InstancedBufferAttribute(new Float32Array(array),size));
    }
    geometry.instanceCount=count;resources.add(geometry);
    const starMaterial=material(starFragment,{uTime:{value:0},uMotion:{value:0},uAmplitude:{value:PARAMETERS.twinkleAmplitude}});
    starMaterial.vertexShader=starVertex;starMaterial.blending=T.AdditiveBlending;
    const stars=new T.Mesh(geometry,starMaterial);stars.name='stars';stars.position.copy(origin);stars.quaternion.copy(orientation);
    stars.frustumCulled=false;stars.renderOrder=-39;nodes.stars=stars;group.add(stars);
    unregister=context.registerMotion?.(stars,'cosmic-painted-star-luminance');
    let motionEnabled=options.motion===true,lastStep=-1;
    const animated=[starMaterial,galaxy.material];
    function setMotionEnabled(enabled){
      if(disposed)return;motionEnabled=Boolean(enabled);lastStep=-1;
      for(const m of animated){m.uniforms.uMotion.value=motionEnabled?1:0;if(!motionEnabled)m.uniforms.uTime.value=0;}
      context.invalidate?.();
    }
    return {
      id:'cosmic-background',status:'READY_FOR_REVIEW',group,
      exports:{nodes,parameters:PARAMETERS,presentation,setMotionEnabled,
        artwork:{revision:'painted-v7',assets,anchorCount:anchors.length,textureSizes:[skyTexture,sunTexture,moonTexture].map(t=>[t.image.width,t.image.height])}},
      update({elapsed,reducedMotion}){
        if(disposed)return false;
        if(reducedMotion){
          if(animated.every(m=>m.uniforms.uMotion.value===0))return false;
          for(const m of animated){m.uniforms.uMotion.value=0;m.uniforms.uTime.value=0;}lastStep=-1;return true;
        }
        if(!motionEnabled)return false;
        const step=Math.floor(elapsed*12);if(step===lastStep)return false;lastStep=step;
        for(const m of animated){m.uniforms.uMotion.value=1;m.uniforms.uTime.value=step/12;}return true;
      },dispose,
    };
  }catch(error){dispose();throw error;}
}
