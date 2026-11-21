import * as T from 'three';
import {CONFIG} from './config.js';

// Pigment and sub-centimetre shading relief only. No vertex displacement:
// placement and hydrology always see the actual heightfield in surface.js.
export function createTerrainMaterial() {
  const material = new T.MeshStandardMaterial({vertexColors: true, roughness: 1, metalness: 0});
  const palette = Object.fromEntries(Object.entries(CONFIG.palette).map(([key,hex]) => [key,new T.Color(hex)]));
  material.onBeforeCompile = shader => {
    shader.uniforms.terrainSoil = {value: palette.soil};
    shader.uniforms.terrainPath = {value: palette.path};
    shader.uniforms.terrainRock = {value: palette.rock};
    shader.uniforms.terrainRockLight = {value: palette.rockLight};
    shader.uniforms.terrainRockShadow = {value: palette.rockShadow};
    shader.uniforms.terrainBed = {value: palette.bed};
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 terrainFeatures;
        varying vec3 vTerrainPoint;
        varying vec2 vTerrainChart;
        varying vec4 vTerrainFeatures;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vTerrainPoint = position;
        vTerrainChart = uv;
        vTerrainFeatures = terrainFeatures;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 terrainSoil;
        uniform vec3 terrainPath;
        uniform vec3 terrainRock;
        uniform vec3 terrainRockLight;
        uniform vec3 terrainRockShadow;
        uniform vec3 terrainBed;
        varying vec3 vTerrainPoint;
        varying vec2 vTerrainChart;
        varying vec4 vTerrainFeatures;

        float terrainHash(vec3 p) {
          p = fract(p * .1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }
        float pigmentNoise(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(terrainHash(i), terrainHash(i+vec3(1,0,0)),f.x),
                         mix(terrainHash(i+vec3(0,1,0)),terrainHash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(terrainHash(i+vec3(0,0,1)),terrainHash(i+vec3(1,0,1)),f.x),
                         mix(terrainHash(i+vec3(0,1,1)),terrainHash(i+vec3(1,1,1)),f.x),f.y),f.z);
        }
        vec2 rockCell(vec2 p) {
          vec2 grid = floor(p), f = fract(p);
          float first = 10.0, second = 10.0;
          for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) {
            vec2 cell = vec2(float(x),float(y));
            vec2 jitter = vec2(terrainHash(vec3(grid+cell,2.3)),terrainHash(vec3(grid+cell,7.1)));
            float d = length(cell + .20 + jitter*.60 - f);
            if(d < first) {second = first; first = d;} else second = min(second,d);
          }
          return vec2(first,second-first);
        }
        float terrainMicroRelief;
      `)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float coast = vTerrainFeatures.x;
        float pathDistance = vTerrainFeatures.y;
        float rockExposure = vTerrainFeatures.z;
        float channelBank = vTerrainFeatures.w;
        vec3 p = vTerrainPoint;
        float broad = pigmentNoise(p * .8);
        float middle = pigmentNoise(p * 3.4 + vec3(2.1,5.3,1.7));
        float fine = pigmentNoise(p * 17.0);
        float pigment = .90 + .14*broad + .11*middle;
        diffuseColor.rgb *= pigment;

        // Exposed soil has varied widths: it does not draw a uniform beige rim.
        float shore = 1.0-smoothstep(.10,.78,abs(coast + (middle-.5)*.30));
        diffuseColor.rgb = mix(diffuseColor.rgb,terrainSoil*(.89+.21*middle),shore*.50);
        float submerged = 1.0-smoothstep(-.48,.06,coast);
        diffuseColor.rgb = mix(diffuseColor.rgb,terrainBed*(.9+.15*middle),submerged*.86);
        diffuseColor.rgb = mix(diffuseColor.rgb,terrainSoil*(.78+.20*middle),channelBank*.47);

        // Muted warm-grey mineral planes sit below moss shoulders. The cells describe
        // joints in one continuous bedrock shelf, not scattered rock instances.
        float rockMask = smoothstep(.16,.66,rockExposure + (middle-.5)*.16);
        vec2 joint = rockCell(vTerrainChart*vec2(2.9,3.8) + vec2(broad*.3,middle*.22));
        float seamAA = max(fwidth(joint.y),.007);
        float fissure = (1.0-smoothstep(.010-seamAA,.026+seamAA,joint.y))*smoothstep(.27,.65,middle);
        float mineral = .5+.5*sin(vTerrainChart.x*4.1+vTerrainChart.y*8.2+middle*2.4);
        vec3 mineralColor = mix(terrainRockShadow,terrainRock,.38+.50*middle);
        mineralColor = mix(mineralColor,terrainRockLight,smoothstep(.55,.98,mineral)*.17);
        mineralColor *= 1.0-.13*fissure;
        // A small ground-colour contribution ties exposed rock to its mossy bank.
        mineralColor = mix(mineralColor,diffuseColor.rgb,.16);
        diffuseColor.rgb = mix(diffuseColor.rgb,mineralColor,rockMask*.94);

        // Fragment-width antialiasing removes the former vertex-colour sawtooth.
        float wornDistance = pathDistance + (middle-.5)*.065;
        float pathAA = max(fwidth(wornDistance),.018);
        float pathMask = 1.0-smoothstep(.285-pathAA,.325+pathAA,wornDistance);
        float grit = smoothstep(.66,.84,fine);
        vec3 earth = terrainPath*(.83+.21*middle+.08*broad);
        earth = mix(earth,terrainSoil*.72,grit*.24);
        earth *= 1.0-.13*smoothstep(.13,.32,pathDistance);
        diffuseColor.rgb = mix(diffuseColor.rgb,earth,pathMask*.96);

        // Matte, shallow pigment relief. High-frequency terms fade with pixels.
        float detailFade = 1.0-smoothstep(.10,.35,length(fwidth(p)));
        terrainMicroRelief = detailFade*(.006*(fine-.5) + rockMask*(.013*mineral-.007*fissure)
          + pathMask*.003*(fine-.5));
      `)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 terrainDx = dFdx(-vViewPosition);
        vec3 terrainDy = dFdy(-vViewPosition);
        vec3 terrainR1 = cross(terrainDy,normal);
        vec3 terrainR2 = cross(normal,terrainDx);
        float terrainDet = dot(terrainDx,terrainR1);
        vec3 terrainGradient = sign(terrainDet)*(dFdx(terrainMicroRelief)*terrainR1 + dFdy(terrainMicroRelief)*terrainR2);
        normal = normalize(abs(terrainDet)*normal-terrainGradient);
      `);
  };
  material.customProgramCacheKey = () => CONFIG.revision+'-mineral-pigment';
  return material;
}
