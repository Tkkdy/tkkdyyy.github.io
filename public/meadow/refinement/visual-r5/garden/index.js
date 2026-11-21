import * as T from 'three';

export const REVISION = 'r5-garden-directional-color-3';

function lightingFor(object, world) {
  world.updateMatrixWorld(true);
  object.updateWorldMatrix(true, false);
  const inverse = object.matrixWorld.clone().invert();
  const contract = world.userData.r5Lighting ?? world.userData.r4Lighting;
  const tint = (color, amount) => {
    const c = color.clone();
    const y = c.r * .2126 + c.g * .7152 + c.b * .0722;
    return new T.Color(1, 1, 1).lerp(c.multiplyScalar(1 / Math.max(.001, y)), amount);
  };
  const read = (id, referenceIntensity, amount) => {
    const light = world.getObjectByName('R1 twilight ' + id);
    if (!light?.isDirectionalLight) throw Error('R5 garden requires actual directional light: ' + id);
    return {
      direction: light.getWorldPosition(new T.Vector3())
        .sub(light.target.getWorldPosition(new T.Vector3())).transformDirection(inverse),
      tint: tint(light.color, amount),
      strength: T.MathUtils.clamp(Math.sqrt(Math.max(0, light.intensity) / referenceIntensity), 0, 1.8),
      color: '#' + light.color.getHexString(), intensity: light.intensity,
    };
  };
  const hemi = world.children.find(o => o.isHemisphereLight);
  if (!hemi) throw Error('R5 garden requires retained hemisphere light');
  const bounds = new T.Box3().setFromBufferAttribute(object.geometry.attributes.position);
  return {
    center: bounds.getCenter(new T.Vector3()), halfSize: bounds.getSize(new T.Vector3()).multiplyScalar(.5),
    key: read('key', 1.65, .68), rim: read('rim', 1.05, .65),
    fill: read('fill', .62, .26), sky: tint(hemi.color, .22),
    revision: contract?.revision ?? 'actual-world-lights',
    profile: contract?.r5Profile ?? contract?.profile ?? 'actual-world-lights',
  };
}

function adapt(source, kind, lights) {
  const sourceKey = source.customProgramCacheKey();
  if (!sourceKey.endsWith('|r4-garden-soft-pigment-1|' + kind))
    throw Error('R5 garden requires retained R4 tree response: ' + sourceKey);
  const compileSource = source.onBeforeCompile;
  const copy = source.clone();
  copy.name = 'R5 garden / ' + kind + ' / directional color';
  if (Object.hasOwn(source, 'onBeforeRender')) copy.onBeforeRender = source.onBeforeRender;
  copy.onBeforeCompile = function (shader, renderer) {
    // Execute the complete R1 -> R4 callback chain, without editing its owners.
    compileSource.call(this, shader, renderer);
    const finish = '#include <alphatest_fragment>';
    if (!shader.fragmentShader.includes('vec3 r4AuthoredPigment=')
      || !shader.vertexShader.includes('varying vec3 vGardenNormal;')
      || !shader.fragmentShader.includes(finish))
      throw Error('R4 tree shader anchors changed; incomplete R5 adapter refused');

    // New records and values belong to this installation. No writes into
    // source-captured light vectors, colors, clock records, or shader strings.
    shader.uniforms.gardenKey = {value: lights.key.direction};
    shader.uniforms.gardenRim = {value: lights.rim.direction};
    for (const id of ['key', 'rim', 'fill']) {
      const label = id[0].toUpperCase() + id.slice(1);
      shader.uniforms['r5Garden' + label] = {value: lights[id].direction};
      shader.uniforms['r5Garden' + label + 'Tint'] = {value: lights[id].tint};
      shader.uniforms['r5Garden' + label + 'Strength'] = {value: lights[id].strength};
    }
    shader.uniforms.r5GardenSky = {value: lights.sky};
    shader.uniforms.r5GardenCenter = {value: lights.center};
    const extent = lights.halfSize, direction = lights.key.direction;
    const span = extent.x * Math.abs(direction.x) + extent.y * Math.abs(direction.y) + extent.z * Math.abs(direction.z);
    shader.uniforms.r5GardenSpan = {value: Math.max(.001, span)};
    shader.fragmentShader = [
      'uniform vec3 r5GardenKey,r5GardenRim,r5GardenFill;',
      'uniform vec3 r5GardenKeyTint,r5GardenRimTint,r5GardenFillTint,r5GardenSky,r5GardenCenter;',
      'uniform float r5GardenSpan;',
      'uniform float r5GardenKeyStrength,r5GardenRimStrength,r5GardenFillStrength;',
      shader.fragmentShader,
    ].join('\n');
    const common = [
      'vec3 r5Normal=normalize(vGardenNormal);',
      'float r5Value=dot(r4AuthoredPigment,vec3(.2126,.7152,.0722));',
      // Existing pigment carries bouquet overlap, not a new detail texture.
      'float r5Open=smoothstep(.035,.26,r5Value);',
      'float r5Key=smoothstep(-.12,.84,dot(r5Normal,r5GardenKey))*r5GardenKeyStrength;',
      'float r5Rim=smoothstep(.0,.84,dot(r5Normal,r5GardenRim))*r5GardenRimStrength;',
      'float r5Moon=smoothstep(-.18,.90,dot(r5Normal,r5GardenFill))*r5GardenFillStrength;',
    ];
    const response = kind === 'blossom' ? [
      // A broad light-facing envelope separates existing bouquets in the
      // small default view. It samples existing positions; no noise/detail.
      'float r5Side=smoothstep(-.48,.62,dot(vGardenPoint-r5GardenCenter,r5GardenKey)/r5GardenSpan);',
      'float r5Flower=smoothstep(-.008,.026,r4AuthoredPigment.r-r4AuthoredPigment.g);',
      'vec3 r5Cool=vec3(.72,.75,1.06)*r5GardenSky;',
      'vec3 r5Form=mix(r5Cool,vec3(.92,.91,.99),(.12+.28*r5Side)*r5Open);',
      'vec3 r5Direct=r5GardenKeyTint*(.16+.22*r5Open)*r5Key*(.20+.80*r5Side);',
      'r5Direct+=r5GardenRimTint*(.10+.44*r5Open)*r5Rim*(.30+.70*r5Side);',
      'r5Direct+=r5GardenFillTint*.05*r5Moon;',
      'vec3 r5Petal=r4AuthoredPigment*(r5Form+r5Direct);',
      'r5Petal+=r5GardenKeyTint*.022*r5Side*r5Open*clamp(r5Key,0.,1.);',
      'r5Petal+=vec3(.002,.002,.005)*(1.-r5Open);',
      'diffuseColor.rgb=mix(diffuseColor.rgb,r5Petal,.86*r5Flower);',
    ] : [
      'float r5Warm=clamp(.45*r5Key+.65*r5Rim,0.,1.);',
      'vec3 r5Wood=mix(r4AuthoredPigment,vec3(r5Value)*vec3(.90,.92,1.08),.32*(1.-r5Warm));',
      'vec3 r5WoodLight=r5GardenSky*.66+r5GardenFillTint*.11*r5Moon;',
      'r5WoodLight+=r5GardenKeyTint*.28*r5Key+r5GardenRimTint*.60*r5Rim;',
      'vec3 r5WoodResponse=r5Wood*r5WoodLight+vec3(.006,.008,.015)*(1.-r5Warm);',
      'diffuseColor.rgb=mix(diffuseColor.rgb,r5WoodResponse,.72);',
    ];
    shader.fragmentShader = shader.fragmentShader.replace(finish, common.concat(response, finish).join('\n'));
  };
  copy.customProgramCacheKey = () => sourceKey + '|' + REVISION + '|' + kind;
  return copy;
}

export function install(ctx) {
  const {assets, world, debug, signal, invalidate} = ctx;
  signal?.throwIfAborted();
  const installed = [], previous = debug?.r5Garden;
  let disposed = false, published;
  function dispose() {
    if (disposed) return;
    disposed = true;
    signal?.removeEventListener('abort', dispose);
    for (const item of [...installed].reverse()) {
      if (item.mesh.material === item.copy) item.mesh.material = item.source;
      item.copy.dispose();
    }
    if (debug?.r5Garden === published) {
      if (previous === undefined) delete debug.r5Garden;
      else debug.r5Garden = previous;
    }
    invalidate?.();
  }
  try {
    const lightRecords = [];
    for (const [name, kind] of [['blossom_painted_scene', 'wood'], ['blossom_painted_petals', 'blossom']]) {
      const mesh = assets.tree.getObjectByName(name);
      if (!mesh?.isMesh || Array.isArray(mesh.material)) throw Error('Unexpected protected tree mesh: ' + name);
      const source = mesh.material, lights = lightingFor(mesh, world);
      const copy = adapt(source, kind, lights);
      installed.push({mesh, source, copy});
      mesh.material = copy;
      lightRecords.push({kind, revision: lights.revision, profile: lights.profile,
        key: {direction: lights.key.direction.toArray(), color: lights.key.color, intensity: lights.key.intensity},
        rim: {direction: lights.rim.direction.toArray(), color: lights.rim.color, intensity: lights.rim.intensity},
        fill: {direction: lights.fill.direction.toArray(), color: lights.fill.color, intensity: lights.fill.intensity}});
    }
    published = {revision: REVISION, stage: 'S1', materialCopies: installed.length,
      addedObjects: 0, addedGeometry: 0, addedTextures: 0, addedLights: 0, addedMotionOwners: 0,
      gardenMaterialsUnchanged: true, lights: lightRecords,
      callbackPolicy: 'retained R1/R4 chain first; independent light uniforms; unchanged clock owner',
      limitation: 'Directional color over existing baked pigment; no new scattering, texture, geometry or post-processing'};
    if (debug) debug.r5Garden = published;
    signal?.addEventListener('abort', dispose, {once: true});
    invalidate?.();
    return {dispose};
  } catch (error) {dispose(); throw error;}
}
