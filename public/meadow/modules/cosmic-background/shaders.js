export const vertex = /* glsl */ `
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
export const galaxyFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uMotion;
  varying vec2 vUv;
  void main(){
    vec4 paint=texture2D(uMap,vUv);
    float light=dot(paint.rgb,vec3(.2126,.7152,.0722));
    float mask=smoothstep(.018,.15,light)*(1.-smoothstep(.35,.75,light));
    float wave=sin(uTime*.26+vUv.x*4.5);
    paint.rgb*=1.+uMotion*.025*mask*wave;
    float edge=smoothstep(0.,.12,vUv.x)*(1.-smoothstep(.88,1.,vUv.x))*smoothstep(0.,.12,vUv.y)*(1.-smoothstep(.86,1.,vUv.y));
    // The new painting owns its pale palette and luminance; no darkening grade.
    gl_FragColor=vec4(paint.rgb,edge);
    #include <colorspace_fragment>
  }
`;
export const sunFragment = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  void main(){
    vec4 paint=texture2D(uMap,vUv);
    vec2 p=(vUv-.5)*vec2(2.,1.);
    float r=length(p);
    float core=1.-smoothstep(.041,.051,r);
    float ellipse=length(p*vec2(1.,2.8));
    float warm=exp(-ellipse*ellipse*14.);
    float blueHour=exp(-ellipse*ellipse*4.);
    float amber=exp(-r*r*110.);
    float edge=(1.-smoothstep(.65,.95,abs(p.x)))*(1.-smoothstep(.30,.49,abs(p.y)));
    // Layer apricot, rose and twilight blue; the source still supplies fine paint variation.
    vec3 atmosphere=mix(vec3(.045,.080,.19),vec3(.56,.18,.115),warm);
    atmosphere=mix(atmosphere,vec3(.95,.49,.20),amber*.78);
    float brush=dot(paint.rgb,vec3(.2126,.7152,.0722));
    atmosphere*=.94+.12*brush;
    float center=pow(clamp(1.-r/.052,0.,1.),.58);
    float elevation=clamp(.5+p.y*8.,0.,1.);
    vec3 disc=mix(vec3(.98,.48,.17),vec3(1.,.91,.63),center*.72+elevation*.24);
    disc=mix(disc,paint.rgb*vec3(1.,.90,.75),.30);
    disc*=.85+.18*brush;
    float alpha=paint.a*mix(.36*warm+.13*blueHour,1.,core)*edge;
    gl_FragColor=vec4(mix(atmosphere,disc,core),alpha);
    #include <colorspace_fragment>
  }
`;
export const moonFragment = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  void main(){
    vec4 paint=texture2D(uMap,vUv);
    // Discard faint matte residue beyond the globe, without replacing its painted edge.
    if(paint.a<.012)discard;
    gl_FragColor=vec4(paint.rgb*.94,paint.a);
    #include <colorspace_fragment>
  }
`;
export const starVertex = /* glsl */ `
  attribute vec3 aCenter;
  attribute float aSize;
  attribute vec3 aTint;
  attribute float aPhase;
  attribute float aPainted;
  uniform float uTime;
  uniform float uMotion;
  uniform float uAmplitude;
  varying vec2 vUv;
  varying vec3 vTint;
  varying float vGain;
  varying float vPainted;
  void main(){
    vUv=uv;vTint=aTint;vPainted=aPainted;
    float wave=.5+.5*sin(uTime*.785398+aPhase);
    vGain=aPainted>.5?(.035+uMotion*.12*wave*wave):(.42+uMotion*uAmplitude*(wave-.5));
    gl_Position=projectionMatrix*modelViewMatrix*vec4(aCenter+vec3(position.xy*aSize,0.),1.);
  }
`;
export const starFragment = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vTint;
  varying float vGain;
  varying float vPainted;
  void main(){
    vec2 p=(vUv-.5)*2.;float r=length(p);
    float light=exp(-r*r*22.)+exp(-r*r*4.)*.12;
    float cross=(exp(-abs(p.x)*38.-abs(p.y)*6.)+exp(-abs(p.y)*38.-abs(p.x)*6.))*.13*vPainted;
    gl_FragColor=vec4(vTint,(light+cross)*vGain*(1.-smoothstep(.7,1.,r)));
    #include <colorspace_fragment>
  }
`;

export const skyFieldFragment = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uTop;
  uniform vec3 uBottom;
  void main(){
    vec3 color=mix(uBottom,uTop,smoothstep(.08,.91,vUv.y));
    gl_FragColor=vec4(color,1.);
    #include <colorspace_fragment>
  }
`;
