import {Color, MeshPhysicalMaterial} from 'three';

// All detail is material-space: the provider's water levels/shore are untouched.
// Physical water IOR and broad rough highlights; no mirrored render target/bloom.
export function createWaterMaterial(config, clock) {
  const material = new MeshPhysicalMaterial({
    color: '#ffffff', roughness: config.roughness, metalness: 0,
    ior: 1.333, specularIntensity: .7,
  });
  material.name = 'Water / gentle moving ripples R4';
  material.onBeforeCompile = shader => {
    shader.uniforms.waterTime = clock;
    shader.uniforms.waterSpeed = {value: config.flowMetresPerSecond};
    shader.uniforms.waterRippleSpeed = {value: config.rippleTimeScale};
    for (const [name, hex] of Object.entries(config.palette)) shader.uniforms['water_' + name] = {value: new Color(hex)};
    shader.vertexShader = `
      attribute vec2 chart;
      attribute vec4 waterData;
      attribute float stageDelta;
      varying vec2 vChart;
      varying vec4 vWater;
      varying float vStage;
    ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vChart = chart;
      vWater = waterData;
      vStage = stageDelta;
    `);
    shader.fragmentShader = `
      uniform float waterTime, waterSpeed, waterRippleSpeed;
      uniform vec3 water_deep, water_shallow, water_lavender, water_stroke, water_warm;
      varying vec2 vChart;
      varying vec4 vWater;
      varying float vStage;
      float waterHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
      }
      float waterNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(waterHash(i),waterHash(i+vec2(1,0)),f.x),
          mix(waterHash(i+vec2(0,1)),waterHash(i+vec2(1,1)),f.x),f.y);
      }
      // Periodic components have unrelated directions and wavelengths.
      // The amplitude never displaces a vertex; derivatives only change normals.
      float waterRelief(vec2 p, float time) {
        vec2 q=mat2(.94,-.342,.342,.94)*p;
        q+=vec2(.22*sin(p.y*.66),.16*sin(p.x*.8+p.y*.32));
        float swell=sin(q.y*11.0+sin(q.x*2.4)*1.4-time*1.2);
        float ripple=sin(q.y*24.0+q.x*5.1+sin(q.x*7.0-q.y*1.3)-time*2.3);
        float fineFade=1.0-smoothstep(.45,1.4,length(fwidth(p))*40.0);
        float fractured=waterNoise(q*vec2(5.0,24.0)+vec2(time*.13,-time*.7))-.5;
        float fine=waterNoise(q*vec2(17.0,47.0)+vec2(-time*.19,time*.8))-.5;
        return (swell*.005+ripple*.0028+fractured*.012+fine*.003*fineFade)
          *(.72+.4*waterNoise(p*.55));
      }
      // Evaluate the height gradient per fragment in chart space. Screen-space
      // dFdx(height) shares a slope across 2x2 pixels, producing square glints.
      // Coordinate derivatives only transform this continuous gradient to screen space.
      vec2 waterSlope(vec2 p, float time) {
        const float epsilon=.0015;
        vec2 gradient=vec2(
          waterRelief(p+vec2(epsilon,0),time)-waterRelief(p-vec2(epsilon,0),time),
          waterRelief(p+vec2(0,epsilon),time)-waterRelief(p-vec2(0,epsilon),time)
        )/(2.0*epsilon);
        return vec2(dot(gradient,dFdx(p)),dot(gradient,dFdy(p)));
      }
      vec3 waterPerturb(vec3 position, vec3 n, vec2 slope) {
        vec3 dx=dFdx(position),dy=dFdy(position);
        vec3 r1=cross(dy,n),r2=cross(n,dx);
        float determinant=dot(dx,r1);
        vec3 gradient=sign(determinant)*(slope.x*r1+slope.y*r2);
        return normalize(abs(determinant)*n-gradient);
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float depth=mix(max(0.0,vWater.x-vStage),max(0.0,vWater.x),smoothstep(.12,.32,vStage));
      float stream=smoothstep(.12,.32,vStage);
      float time=waterTime*waterRippleSpeed;
      vec2 p=vChart;
      float wash=waterNoise(p*.78);
      float fineWash=waterNoise(p*vec2(4.4,8.7)+vec2(0.0,-time*.4));
      float shallows=exp(-depth*(5.8+wash*3.2));
      float streamBank=pow(abs(vWater.w),5.0)*stream;
      float shore=max(shallows*(.48+.52*wash),streamBank*.30);
      vec3 pigment=mix(water_deep,water_shallow,clamp(shore*.62+.07,0.0,1.0));
      pigment=mix(pigment,water_lavender,(.04+.10*wash)*(1.0-shore));
      pigment*=.83+.27*wash+.06*fineWash;

      // Small irregular wave faces, not equidistant painted dashes.
      float phase=dot(p,vec2(1.5,13.8))-time*1.9
        + 1.8*waterNoise(p*vec2(1.2,2.1)) + .6*sin(p.x*4.0+p.y*2.3);
      float ridge=pow(.5+.5*sin(phase),10.0);
      float broken=smoothstep(.30,.74,waterNoise(p*vec2(5.1,2.8)+vec2(time*.3,0)));
      float detailFade=1.0-smoothstep(.25,.8,length(fwidth(p))*13.8);
      float downstream=vWater.y-waterTime*waterSpeed;
      float streamWave=pow(.5+.5*sin(downstream*17.0
        +sin(vWater.w*5.1+downstream*.7)),12.0);
      float waveMark=mix(ridge*broken,streamWave*(.2+.8*fineWash),stream);
      pigment=mix(pigment,water_stroke,waveMark*.018*detailFade);

      // Broken narrow lace at the real shore and sparse bank eddies.
      float lace=(1.0-smoothstep(.012,.045,depth))*smoothstep(.001,.013,depth);
      lace*=smoothstep(.27,.76,waterNoise(p*vec2(8.0,12.0)+vec2(0,-time*.25)));
      float bankEddy=smoothstep(.76,.98,abs(vWater.w))*stream
        *pow(.5+.5*sin(downstream*12.0+sin(downstream*2.2)*2.0),8.0);
      pigment=mix(pigment,water_stroke,max(lace*.30,bankEddy*.045)*detailFade);
      diffuseColor.rgb*=pigment;
      vec2 slope=waterSlope(p,time);
      if(stream>.001) slope=mix(slope,waterSlope(vec2(vWater.w*.23,vWater.y),time),stream);
      slope*=smoothstep(.005,.12,depth);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor=clamp(roughness+.08*wash+.08*shore,.25,.60);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      normal=waterPerturb(-vViewPosition,normal,slope);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      // A restrained sky-tinted grazing sheen. It follows the current view,
      // instead of a bright stripe painted at a fixed chart coordinate.
      vec3 viewDirection=normalize(vViewPosition);
      float fresnel=.025+.32*pow(1.0-max(0.0,dot(normal,viewDirection)),3.0);
      vec3 reflected=reflect(-viewDirection,normal);
      vec3 worldReflected=inverseTransformDirection(reflected,viewMatrix);
      vec3 sky=mix(water_deep,water_lavender,smoothstep(-.3,.8,worldReflected.y)*.42);
      outgoingLight+=sky*fresnel*.65;
      #if NUM_DIR_LIGHTS > 0
        // Use the existing rig's warm key direction/color. No invented sun/light.
        float keyReflection=pow(max(0.0,dot(reflected,directionalLights[0].direction)),30.0);
        float glimmer=(.3+.7*waveMark)*detailFade;
        outgoingLight+=directionalLights[0].color*keyReflection*glimmer*.075
          *smoothstep(.012,.15,depth);
      #endif
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey = () => 'water-gentle-motion-r4';
  return material;
}
