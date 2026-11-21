import * as T from 'three';

export const REVISION = 'astra-garden-2';

function direction(light, inverse, fallback) {
  return light ? light.getWorldPosition(new T.Vector3())
    .sub(light.target.getWorldPosition(new T.Vector3())).transformDirection(inverse)
    : new T.Vector3(...fallback).normalize();
}
export function treeLighting(tree, world) {
  world.updateMatrixWorld(true);
  tree.updateWorldMatrix(true, true);
  const inverse = tree.matrixWorld.clone().invert();
  const key = world.children.find(o => o.name === 'R1 twilight key')
    ?? world.children.find(o => o.isDirectionalLight && o.castShadow);
  const rim = world.children.find(o => o.name === 'R1 twilight rim');
  return {
    key: direction(key, inverse, [-.7, .6, .3]),
    rim: direction(rim, inverse, [.4, .7, -.5]),
    revision: world.userData.compositionLighting?.revision ?? 'scene-lights',
  };
}

// The authored COLOR_0 already carries each bouquet's depth and pigment.
// Keep it as the image; add a bounded form response, never another canopy.
export function paintedTreeMaterial(original, kind, lighting) {
  const material = original.clone();
  material.name = 'C garden / retained ' + kind + ' pigment';
  material.toneMapped = true;
  material.onBeforeCompile = shader => {
    const varying = 'varying vec3 vGardenNormal;\nvarying vec3 vGardenPoint;\n';
    shader.vertexShader = varying + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvGardenNormal=normal;vGardenPoint=position;');
    shader.fragmentShader = varying
      + 'uniform vec3 gardenKey,gardenRim;\n' + shader.fragmentShader;
    shader.uniforms.gardenKey = {value: lighting.key};
    shader.uniforms.gardenRim = {value: lighting.rim};
    const common = [
      'vec3 pigment=diffuseColor.rgb,n=normalize(vGardenNormal);',
      'float key=smoothstep(-.38,.86,dot(n,gardenKey));',
      'float rim=smoothstep(.12,.90,dot(n,gardenRim));',
      'float value=dot(pigment,vec3(.2126,.7152,.0722));',
    ];
    const response = kind === 'blossom' ? [
      // Green leaves retain their hue; the pink flower pigment gets the
      // peach/violet temperature separation, including dark flower throats.
      'float flower=smoothstep(-.008,.026,pigment.r-pigment.g);',
      'float outer=smoothstep(.055,.28,value);',
      'vec3 cool=vec3(.79,.77,1.12);',
      'vec3 warm=vec3(1.19,.93,.93);',
      'vec3 light=mix(cool,warm,.19+.54*outer+.19*key);',
      'light+=vec3(.10,.065,.14)*rim*(.22+.78*outer);',
      'vec3 pink=pigment*light*(.88+.20*outer);',
      'vec3 leaf=pigment*mix(vec3(.71,.85,.96),vec3(.99,1.02,.87),key)*.83;',
      'diffuseColor.rgb=mix(leaf,pink,flower);',
    ] : [
      // Wood's Cycles pigment includes grain and occlusion. Keep its dark
      // folds; cooler recesses and a narrow warm face reveal the S bend.
      'vec3 light=mix(vec3(.72,.78,1.04),vec3(.86,.87,.90),key);',
      'light+=vec3(.10,.08,.16)*rim;',
      'vec3 wood=mix(pigment,vec3(value)*vec3(1.,.96,1.12),.16*(1.-key));',
      'diffuseColor.rgb=wood*light+vec3(.008,.012,.023)*(1.-key);',
    ];
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n' + common.concat(response).join('\n'));
  };
  material.customProgramCacheKey = () => REVISION + '-' + kind;
  return material;
}
