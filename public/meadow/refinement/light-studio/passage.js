import {Color,FramebufferTexture,LinearFilter,Mesh,NoBlending,PlaneGeometry,ShaderMaterial} from 'three';
// A straight dolly towards a point just above the horizon. The camera keeps the
// approved landing orientation and the planet stays at its authored world scale.
export function createPassage(d) {
  const {camera,renderer,scene,world}=d;
  // Copy the painted sky on the GPU, then composite it behind the actual world
  // in the same render. Only the offline artwork baker needs a readable canvas.
  const embedded=parent!==window,sky=embedded?null:document.createElement('canvas');
  let plate=null,pixelWidth=0,pixelHeight=0;
  const material=new ShaderMaterial({
    uniforms:{image:{value:null},amount:{value:0},zoom:{value:1},shift:{value:[0,0]}},
    vertexShader:'varying vec2 coord; void main(){coord=uv;gl_Position=vec4(position.xy,1.,1.);}',
    fragmentShader:'uniform sampler2D image; uniform float amount,zoom; uniform vec2 shift; varying vec2 coord; void main(){vec3 c=texture2D(image,(coord-.5-shift)/zoom+.5).rgb;gl_FragColor=vec4(c*amount,amount);}',
    blending:NoBlending,depthWrite:false,depthTest:false,toneMapped:false
  });
  const quad=new Mesh(new PlaneGeometry(2,2),material);
  quad.frustumCulled=false;quad.visible=false;quad.renderOrder=-1e6;
  if(embedded)scene.add(quad);
  let landing=null,ray=null,focusDepth=1,width=0,height=0,progress=1;
  let outside=[],background,clear,alpha,fog;
  function restore() {
    if(!landing)return;
    camera.copy(landing);camera.updateMatrixWorld();
    for(const [object,visible] of outside)object.visible=visible;
    scene.background=background;renderer.setClearColor(clear,alpha);
    if(fog){scene.fog.near=fog[0];scene.fog.far=fog[1]}
    quad.visible=false;landing=null;
  }
  function prepare(){
    const yaw=world.rotation.y;
    d.viewTo('default');d.rotate(yaw);camera.updateMatrixWorld(true);landing=camera.clone();
    width=innerWidth;height=innerHeight;
    const tangent=Math.tan(camera.fov*Math.PI/360);
    ray=camera.position.clone().set(.08*tangent*camera.aspect,.16*tangent,-1).applyQuaternion(camera.quaternion);
    focusDepth=-world.getWorldPosition(camera.position.clone()).applyMatrix4(camera.matrixWorldInverse).z;
    outside=scene.children.filter(node=>node!==world&&node!==quad).map(node=>[node,node.visible]);
    background=scene.background;clear=renderer.getClearColor(new Color());alpha=renderer.getClearAlpha();
    fog=scene.fog?.isFog?[scene.fog.near,scene.fog.far]:null;
    // Only sky is in this backing canvas. Cottage, crown and globe all stay
    // together in the one live WebGL foreground, including the hand-off frame.
    if(pixelWidth!==renderer.domElement.width||pixelHeight!==renderer.domElement.height){
      const hidden=[];
      world.traverseVisible(o=>{if(o.isMesh||o.isLine||o.isPoints||o.isSprite)hidden.push(o)});
      const skyCamera=landing.clone();skyCamera.fov=2*Math.atan(tangent*1.10)*180/Math.PI;skyCamera.updateProjectionMatrix();
      const needsShadow=renderer.shadowMap.needsUpdate;renderer.shadowMap.needsUpdate=false;
      try{
        hidden.forEach(o=>o.visible=false);renderer.render(scene,skyCamera);
        pixelWidth=renderer.domElement.width;pixelHeight=renderer.domElement.height;
        if(embedded){
          plate?.dispose();plate=new FramebufferTexture(pixelWidth,pixelHeight);
          plate.minFilter=plate.magFilter=LinearFilter;
          renderer.copyFramebufferToTexture(plate);material.uniforms.image.value=plate;
        }else{
          sky.width=pixelWidth;sky.height=pixelHeight;sky.getContext('2d').drawImage(renderer.domElement,0,0);
        }
      }finally{hidden.forEach(o=>o.visible=true);renderer.shadowMap.needsUpdate=needsShadow}
    }
    outside.forEach(([o])=>o.visible=false);
    scene.background=null;renderer.setClearColor(0,0);
    quad.visible=embedded;
  }
  let skyPose=null;
  function set(value,registration=null) {
    skyPose=registration;
    const p=Math.max(0,Math.min(1,value));
    progress=p;
    if(p===1){restore();d.invalidate();return}
    if(landing&&(width!==innerWidth||height!==innerHeight))restore();
    if(!landing)prepare();
    const ease=p*p*(3-2*p),scale=.009**(1-ease),distance=focusDepth*(1/scale-1);
    camera.position.copy(landing.position).addScaledVector(ray,-distance);
    camera.quaternion.copy(landing.quaternion);camera.far=landing.far+distance;
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
    if(fog){scene.fog.near=fog[0]+distance;scene.fog.far=fog[1]+distance}
    const mix=Math.max(0,Math.min(1,(p-.31)/.53));
    material.uniforms.amount.value=registration?.blend??mix*mix*(3-2*mix);
    material.uniforms.zoom.value=registration?.incomingZoom??1+.10*ease;
    material.uniforms.shift.value[0]=registration?.newX??0;
    material.uniforms.shift.value[1]=-(registration?.newY??0);
    d.invalidate();
  }
  function dispose(){restore();quad.removeFromParent();quad.geometry.dispose();material.dispose();plate?.dispose()}
  return {set,dispose,resize(){if(landing){restore();set(progress,skyPose)}},get active(){return !!landing},sky};
}
