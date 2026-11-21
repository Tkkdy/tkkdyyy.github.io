import * as T from 'three';

export const REVISION = 'r5-grazing-night-lighting-1';
export const PROFILE = 'golden-grazing-night';
// sRGB colour inputs; Three converts to linear. Existing lights only.
export const LIGHTING = Object.freeze({
  exposure: 1.0,
  hemisphere: {sky: '#95a9cd', ground: '#354d6b', intensity: 1.15},
  key: {color: '#ffd0a0', intensity: 3.80, position: [-25, 20, 4], target: [-1, 9, -2], shadowIntensity: .30},
  rim: {color: '#ffb76e', intensity: 4.50, position: [-30, 10, 8], target: [0, 10, -2]},
  fill: {color: '#a4bff0', intensity: .72, position: [12, 24, 13], target: [0, 9, 0]},
  porch: {color: '#ffd09a', intensity: 23, distance: 5.2, targetLocal: [.20, .02, 3.50], angle: .64, penumbra: .94, decay: 2},
});
const active = new WeakSet();

// Install after R4 lighting and before the dependent house/tree adapters.
// This module owns neither materials, fog, clock nor renderer lifetime.
export function install(ctx) {
  const {world, renderer, debug, signal, invalidate} = ctx;
  signal?.throwIfAborted();
  if (active.has(world)) throw Error('R5 lighting already installed on this world');
  const previousContract = world.userData.r4Lighting;
  if (previousContract?.profile !== 'warm-night') throw Error('R5 lighting requires the R4 warm-night contract');
  const ambient = world.children.find(o => o.isHemisphereLight);
  const lights = Object.fromEntries(['key', 'rim', 'fill'].map(id => [id, world.children.find(o => o.name === 'R1 twilight ' + id)]));
  const porch = world.getObjectByName('Astra cottage / outward porch light');
  if (!ambient || Object.values(lights).some(o => !o?.isDirectionalLight) || !porch?.isSpotLight) {
    throw Error('R5 lighting requires the retained hemisphere, three directional lights and porch spotlight');
  }
  const previousDebug = debug?.r5Lighting, previousExposure = renderer.toneMappingExposure;
  const saved = [];
  let disposed = false, published, publishedDebug;
  function refresh() {
    world.updateWorldMatrix(true, true);
    renderer.shadowMap.needsUpdate = true;
    debug?.refreshShadows?.();
    invalidate?.();
  }
  function remember(light) {
    saved.push([light, {
      color: light.color.clone(), intensity: light.intensity, position: light.position.clone(),
      groundColor: light.groundColor?.clone(), target: light.target?.position.clone(),
      shadowIntensity: light.shadow?.intensity,
      distance: light.distance, angle: light.angle, penumbra: light.penumbra, decay: light.decay,
    }]);
  }
  function dispose() {
    if (disposed) return;
    disposed = true; signal?.removeEventListener('abort', dispose);
    for (const [light, state] of [...saved].reverse()) {
      light.color.copy(state.color); light.intensity = state.intensity; light.position.copy(state.position);
      if (state.groundColor) light.groundColor.copy(state.groundColor);
      if (state.target) light.target.position.copy(state.target);
      if (state.shadowIntensity !== undefined) light.shadow.intensity = state.shadowIntensity;
      for (const key of ['distance', 'angle', 'penumbra', 'decay']) if (state[key] !== undefined) light[key] = state[key];
    }
    renderer.toneMappingExposure = previousExposure;
    if (world.userData.r4Lighting === published) world.userData.r4Lighting = previousContract;
    if (debug && debug.r5Lighting === publishedDebug) {
      if (previousDebug === undefined) delete debug.r5Lighting; else debug.r5Lighting = previousDebug;
    }
    active.delete(world); refresh();
  }
  try {
    active.add(world);
    remember(ambient);
    ambient.color.set(LIGHTING.hemisphere.sky); ambient.groundColor.set(LIGHTING.hemisphere.ground); ambient.intensity = LIGHTING.hemisphere.intensity;
    for (const id of ['key', 'rim', 'fill']) {
      const light = lights[id], p = LIGHTING[id]; remember(light);
      light.color.set(p.color); light.intensity = p.intensity;
      light.position.set(...p.position); light.target.position.set(...p.target);
      if (p.shadowIntensity !== undefined) light.shadow.intensity = p.shadowIntensity;
    }
    remember(porch);
    porch.color.set(LIGHTING.porch.color); porch.intensity = LIGHTING.porch.intensity; porch.distance = LIGHTING.porch.distance;
    porch.target.position.set(...LIGHTING.porch.targetLocal);
    porch.angle = LIGHTING.porch.angle; porch.penumbra = LIGHTING.porch.penumbra; porch.decay = LIGHTING.porch.decay;
    // The inherited non-shadowing cone must remain entirely outside the facade.
    const localDirection = porch.target.position.clone().sub(porch.position).normalize();
    const forwardConeMinimum = localDirection.z * Math.cos(porch.angle)
      - Math.sqrt(Math.max(0, 1 - localDirection.z * localDirection.z)) * Math.sin(porch.angle);
    if (forwardConeMinimum <= 0) throw Error('R5 porch cone crosses behind the front facade');
    renderer.toneMappingExposure = LIGHTING.exposure;
    world.updateWorldMatrix(true, true);
    const inverse = world.matrixWorld.clone().invert();
    const point = node => node.getWorldPosition(new T.Vector3()).applyMatrix4(inverse).toArray();
    const directions = Object.fromEntries(Object.entries(lights).map(([id, light]) => [id,
      light.getWorldPosition(new T.Vector3()).sub(light.target.getWorldPosition(new T.Vector3())).transformDirection(inverse).toArray(),
    ]));
    published = {
      ...previousContract, ...structuredClone(LIGHTING), revision: REVISION,
      profile: 'warm-night', r5Profile: PROFILE,
      space: 'planet-local world group', colorSpace: 'sRGB input; Three converts to linear', directions,
      porch: {...LIGHTING.porch, position: point(porch), target: point(porch.target), local: porch.position.toArray(),
        targetLocal: porch.target.position.toArray(), forwardConeMinimum, castsShadow: porch.castShadow},
      roles: {key: 'left golden grazing light models slope and rock faces', rim: 'restrained warm horizon edge',
        fill: 'weak cool upper-right moon modelling', porch: 'wide soft outward cone with physical distance attenuation'},
      // Retain R4 air metadata, but never install, alter or remove a fog here.
      air: previousContract.air ? structuredClone(previousContract.air) : undefined,
      addedLights: 0, addedObjects: 0, addedShadowMaps: 0, materialsUnchanged: true, cameraUnchanged: true,
      limitation: 'Baked house/tree pigments require downstream light-response adapters; one existing porch cone is not per-window global illumination.',
    };
    publishedDebug = {...published, profile: PROFILE, compatibilityProfile: 'warm-night',
      sourceRevision: previousContract.revision, fogChanged: false, toneMappingChanged: false,
      shadow: {intensity: lights.key.shadow.intensity, mapSize: lights.key.shadow.mapSize.toArray(),
        bias: lights.key.shadow.bias, normalBias: lights.key.shadow.normalBias, radius: lights.key.shadow.radius},
      installOrder: 'R4 lighting -> R5 lighting -> R4 house/garden -> respective R5 response adapters',
    };
    world.userData.r4Lighting = published;
    if (debug) debug.r5Lighting = publishedDebug;
    signal?.addEventListener('abort', dispose, {once: true}); refresh();
    return {dispose};
  } catch (error) { dispose(); throw error; }
}
