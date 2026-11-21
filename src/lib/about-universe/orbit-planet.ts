import {GlProgram,Mesh,MeshGeometry,Shader,Texture} from 'pixi.js';

// Shade the sphere in screen pixels. Rotation changes longitude only; lighting
// stays in camera space and every longitude has its own painted surface.
export function createOrbitPlanet(texture:Texture){
  texture.source.style.addressModeU='repeat';
  const geometry=new MeshGeometry({
    positions:new Float32Array([-.5,-.5,.5,-.5,.5,.5,-.5,.5]),
    uvs:new Float32Array([0,0,1,0,1,1,0,1]),indices:new Uint32Array([0,1,2,0,2,3])
  });
  const shader=new Shader({
    glProgram:GlProgram.from({
      vertex:`in vec2 aPosition; in vec2 aUV; out vec2 disc;
        uniform mat3 uProjectionMatrix,uWorldTransformMatrix,uTransformMatrix;
        void main(){disc=(aUV-.5)/.485;
          gl_Position=vec4((uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(aPosition,1.)).xy,0.,1.);}`,
      fragment:`in vec2 disc; out vec4 finalColor;
        uniform sampler2D surface; uniform float turn,discRadius; uniform vec4 uColor;
        void main(){
          float radius=length(disc);
          if(radius>=1.)discard;
          float z=sqrt(max(0.,1.-radius*radius));
          vec2 uv=vec2(.5+(atan(disc.x,z)+turn)/6.2831853,.5+asin(clamp(disc.y,-1.,1.))/3.14159265);
          float light=.57+.53*max(0.,dot(vec3(disc,z),vec3(-.48,-.38,.78)));
          float edge=clamp((1.-radius)*discRadius,0.,1.);
          finalColor=vec4(texture(surface,uv).rgb*light*edge,edge)*uColor;
        }`
    }),
    resources:{surface:texture.source,spin:{turn:{value:0,type:'f32'},discRadius:{value:256,type:'f32'}}}
  });
  const mesh=new Mesh({geometry,shader,texture});
  return {mesh,update(seconds:number){const angle=seconds*.055;shader.resources.spin.uniforms.turn=angle;shader.resources.spin.uniforms.discRadius=Math.max(1,mesh.width*.485);return angle},
    dispose(){shader.destroy();geometry.destroy(true)}};
}
