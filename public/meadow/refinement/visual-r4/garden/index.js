import * as T from 'three';

export const REVISION = 'r4-garden-soft-pigment-1';

function lightFrame(tree, world) {
  const contract = world.userData.r4Lighting;
  if (!contract) throw Error('R4 garden requires the reviewed lighting module first');
  world.updateMatrixWorld(true); tree.updateWorldMatrix(true, true);
  const inverse = tree.matrixWorld.clone().invert();
  const direction = id => {
    const light = world.getObjectByName('R1 twilight ' + id);
    if (!light?.isDirectionalLight) throw Error('Missing retained light: ' + id);
    return light.getWorldPosition(new T.Vector3()).sub(light.target.getWorldPosition(new T.Vector3())).transformDirection(inverse);
  };
  function tint(hex, strength) {
    const c = new T.Color(hex), luminance = .2126*c.r + .7152*c.g + .0722*c.b;
    c.multiplyScalar(1 / Math.max(.001, luminance));
    return new T.Color(1,1,1).lerp(c,strength);
  }
  return {key:direction('key'),rim:direction('rim'),
    keyTint:tint(contract.key.color,.34),rimTint:tint(contract.rim.color,.22),
    skyTint:tint(contract.hemisphere.sky,.20),revision:contract.revision,profile:contract.profile};
}

function adapt(original, kind, lighting) {
  const previousCompile = original.onBeforeCompile;
  const previousKey = original.customProgramCacheKey;
  const sourceKey = previousKey.call(original);
  if (sourceKey !== 'astra-garden-2-' + kind) throw Error('Unsupported retained tree shader: ' + sourceKey);
  const copy = original.clone();
  copy.name = 'R4 garden / ' + kind + ' / soft pigment';
  // Material.clone does not retain application callbacks. The source callback
  // remains the owner of its existing varyings and source pigment expression.
  if (Object.hasOwn(original,'onBeforeRender')) copy.onBeforeRender=original.onBeforeRender;
  copy.onBeforeCompile = function(shader, renderer) {
    previousCompile.call(this,shader,renderer);
    const snapshot='#include <color_fragment>';
    const finish='#include <alphatest_fragment>';
    if (!shader.fragmentShader.includes(snapshot) || !shader.fragmentShader.includes(finish)
      || !shader.vertexShader.includes('varying vec3 vGardenNormal;')
      || !shader.uniforms.gardenKey || !shader.uniforms.gardenRim)
      throw Error('Retained tree shader hooks changed; refusing an incomplete adapter');

    // Own the replacement records and vectors. Never .copy() into the source
    // callback's captured vectors: the original material must restore exactly.
    shader.uniforms.gardenKey={value:lighting.key};
    shader.uniforms.gardenRim={value:lighting.rim};
    shader.uniforms.r4GardenWarm={value:lighting.keyTint};
    shader.uniforms.r4GardenRimTint={value:lighting.rimTint};
    shader.uniforms.r4GardenSky={value:lighting.skyTint};
    shader.fragmentShader='uniform vec3 r4GardenWarm,r4GardenRimTint,r4GardenSky;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace(snapshot,
      snapshot+'\nvec3 r4AuthoredPigment=diffuseColor.rgb;');
    const common=[
      'vec3 r4Normal=normalize(vGardenNormal);',
      'float r4Value=dot(r4AuthoredPigment,vec3(.2126,.7152,.0722));',
      'float r4Key=smoothstep(-.62,.96,dot(r4Normal,gardenKey));',
      'float r4Edge=smoothstep(.48,.96,dot(r4Normal,gardenRim));',
    ];
    const response=kind==='blossom'?[
      'float r4Flower=smoothstep(-.008,.026,r4AuthoredPigment.r-r4AuthoredPigment.g);',
      'float r4Outer=smoothstep(.055,.28,r4Value);',
      'float r4Bright=smoothstep(.22,.52,r4Value);',
      // Lift the smallest dark throats while gently rolling off pale tips.
      // Branch-scale depth stays in the retained per-bouquet pigment.
      'vec3 r4Soft=r4AuthoredPigment*(1.-.085*r4Bright)+vec3(.008,.006,.011)*(1.-.6*r4Bright);',
      'vec3 r4Temperature=mix(r4GardenSky,r4GardenWarm,.24+.38*r4Outer+.10*r4Key);',
      'vec3 r4Petal=r4Soft*r4Temperature*(.99+.12*r4Key);',
      'r4Petal+=r4AuthoredPigment*r4GardenRimTint*.045*r4Edge;',
      'diffuseColor.rgb=mix(diffuseColor.rgb,r4Petal,.62*r4Flower);',
    ]:[
      // Narrow the warm face without turning the baked wood into a dark
      // silhouette; the cool midtone and small edge response retain its bend.
      'float r4WoodKey=smoothstep(.30,.93,dot(r4Normal,gardenKey));',
      'vec3 r4Wood=mix(r4AuthoredPigment,vec3(r4Value)*vec3(1.08,.99,1.02),.12);',
      'vec3 r4WoodLight=r4GardenSky*.83+r4GardenWarm*.20*r4WoodKey+r4GardenRimTint*.085*r4Edge;',
      'vec3 r4WoodResponse=r4Wood*r4WoodLight+vec3(.007,.009,.014)*(1.-r4WoodKey);',
      'float r4Root=1.-smoothstep(.03,.38,vGardenPoint.y);',
      'r4WoodResponse*=1.-.06*r4Root;',
      'diffuseColor.rgb=mix(diffuseColor.rgb,r4WoodResponse,.68);',
    ];
    shader.fragmentShader=shader.fragmentShader.replace(finish,common.concat(response,finish).join('\n'));
  };
  copy.customProgramCacheKey=()=>sourceKey+'|'+REVISION+'|'+kind;
  return copy;
}

export function install(ctx) {
  const {assets,world,debug,signal,invalidate}=ctx;
  signal?.throwIfAborted();
  const saved=[],owned=[],previous=debug?.r4Garden;
  let disposed=false,published;
  function dispose() {
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);
    for(const item of [...saved].reverse())if(item.mesh.material===item.copy)item.mesh.material=item.original;
    for(const material of owned)material.dispose();
    if(debug?.r4Garden===published) {
      if(previous===undefined)delete debug.r4Garden;else debug.r4Garden=previous;
    }
    invalidate?.();
  }
  try {
    const lighting=lightFrame(assets.tree,world);
    for(const [name,kind] of [['blossom_painted_scene','wood'],['blossom_painted_petals','blossom']]) {
      const mesh=assets.tree.getObjectByName(name);
      if(!mesh?.isMesh||Array.isArray(mesh.material))throw Error('Unexpected protected tree mesh: '+name);
      const original=mesh.material,copy=adapt(original,kind,lighting);
      saved.push({mesh,original,copy});owned.push(copy);mesh.material=copy;
    }
    published={revision:REVISION,lightingRevision:lighting.revision,profile:lighting.profile,
      materialCopies:owned.length,geometryCopies:0,addedObjects:0,addedTextures:0,addedLights:0,
      addedMotionOwners:0,gardenMaterialsUnchanged:true,
      keyDirection:lighting.key.toArray(),rimDirection:lighting.rim.toArray(),
      callbackPolicy:'source callback first; independent light uniform records and vectors; source callbacks never mutated',
      limitation:'Painted pigment response with retained occlusion; no new transmission or contact-shadow geometry'};
    if(debug)debug.r4Garden=published;
    signal?.addEventListener('abort',dispose,{once:true});invalidate?.();
    return {dispose};
  }catch(error){dispose();throw error;}
}
