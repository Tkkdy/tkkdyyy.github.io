// Bounded local bending, driven only by the controller's update(frame).
// Rest positions, instance transforms and root contact remain immutable.
export function createWind(){
  const time={value:0};
  function bind(material,kind){
    const amplitude={grass:.075,fern:.055,flowers:.065}[kind];
    material.onBeforeCompile=shader=>{
      shader.uniforms.ecosystemTime=time;
      shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
        uniform float ecosystemTime;
        vec2 ecosystemWind() {
          vec3 anchor = instanceMatrix[3].xyz;
          float phase = dot(anchor, vec3(1.71, 2.13, .93));
          float t = ecosystemTime;
          float wave = .68 * sin(t * 1.18 + phase) + .32 * sin(t * .63 + phase * 1.37);
          float gust = .76 + .24 * sin(t * .31 + phase * .23);
          float onset = 1.0 - exp(-t * .8);
          return vec2(wave, .36 * sin(t * .91 + phase + 1.2)) * gust * onset * ${amplitude};
        }
      `);
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        vec2 windNormal = ecosystemWind();
        objectNormal.y -= 2.0 * max(position.y, 0.0) * dot(windNormal, objectNormal.xz);
        objectNormal = normalize(objectNormal);
      `);
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float windHeight = max(position.y, 0.0);
        transformed.xz += ecosystemWind() * windHeight * windHeight;
      `);
    };
    material.customProgramCacheKey=()=>`ecosystem-wind-v1-${kind}`;
    material.userData.ecosystemWind={time,amplitude,rootPinned:true};
  }
  return {bind,update(frame){
    if(frame.reducedMotion||!Number.isFinite(frame.delta)||frame.delta<=0)return false;
    // Accumulate bounded active time so resume never jumps ahead.
    time.value+=Math.min(.05,frame.delta);return true;
  }};
}
