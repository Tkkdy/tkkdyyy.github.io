import * as T from 'three';

export const REVISION = 'r4-warm-night-lighting-1';
export const PROFILES = Object.freeze({
  'warm-night': {
    exposure: 1.02,
    hemisphere: {sky: '#a4b9d8', ground: '#34445f', intensity: 1.10},
    key: {color: '#ffe0b5', intensity: 1.65, position: [-16, 26, 10], target: [-1, 9, -2], shadowIntensity: .24},
    rim: {color: '#ffc38a', intensity: 1.05, position: [-22, 16, -14], target: [0, 10, -2]},
    fill: {color: '#a3c2ed', intensity: .62, position: [9, 21, 16], target: [0, 9, 0]},
    porch: {color: '#ffd09a', intensity: 17, distance: 4.2},
    air: {color: '#142f4b', density: .004},
  },
  'blue-hour': {
    exposure: .98,
    hemisphere: {sky: '#7fa4d8', ground: '#182c46', intensity: .70},
    key: {color: '#ffcc91', intensity: 2.20, position: [-23, 18, -5], target: [-1, 9, -2], shadowIntensity: .38},
    rim: {color: '#9cbdf2', intensity: .48, position: [8, 21, -12], target: [0, 10, -2]},
    fill: {color: '#83a9e3', intensity: .24, position: [7, 14, 20], target: [0, 9, 0]},
    porch: {color: '#ffd09a', intensity: 12, distance: 4.2},
    air: {color: '#142f4b', density: .004},
  },
});

export const LIGHTING = PROFILES['warm-night'];

// Installation is deliberately after R1/R3. This changes actual scene lights,
// not retained material pigments or the baked house/tree lighting uniforms.
export function install(ctx) {
  const {world, scene, renderer, debug, signal, invalidate} = ctx;
  signal?.throwIfAborted();
  const query = new URLSearchParams(globalThis.location?.search ?? '');
  const profileId = Object.hasOwn(PROFILES, query.get('lightProfile')) ? query.get('lightProfile') : 'warm-night';
  const profile = PROFILES[profileId], airEnabled = query.get('air') !== 'off';
  const saved = [], previousExposure = renderer.toneMappingExposure, previousFog = scene.fog;
  const previousContract = world.userData.r4Lighting, previousDebug = debug.r4Lighting;
  let disposed = false, published, air;
  const render = () => { if (debug.refreshShadows) debug.refreshShadows(); else { renderer.shadowMap.needsUpdate = true; invalidate?.(); } };
  function remember(light) {
    const state = {color: light.color.clone(), intensity: light.intensity, position: light.position.clone()};
    if (light.groundColor) state.groundColor = light.groundColor.clone();
    if (light.target) state.targetPosition = light.target.position.clone();
    if (light.shadow) state.shadowIntensity = light.shadow.intensity;
    if ('distance' in light) state.distance = light.distance;
    saved.push([light, state]);
  }
  function dispose() {
    if (disposed) return; disposed = true; signal?.removeEventListener('abort', dispose);
    for (const [light, state] of [...saved].reverse()) {
      light.color.copy(state.color); light.intensity = state.intensity; light.position.copy(state.position);
      if (state.groundColor) light.groundColor.copy(state.groundColor);
      if (state.targetPosition) light.target.position.copy(state.targetPosition);
      if (state.shadowIntensity !== undefined) light.shadow.intensity = state.shadowIntensity;
      if (state.distance !== undefined) light.distance = state.distance;
    }
    renderer.toneMappingExposure = previousExposure;
    if (!air || scene.fog === air) scene.fog = previousFog;
    if (world.userData.r4Lighting === published) {
      if (previousContract === undefined) delete world.userData.r4Lighting; else world.userData.r4Lighting = previousContract;
    }
    if (debug.r4Lighting === published) {
      if (previousDebug === undefined) delete debug.r4Lighting; else debug.r4Lighting = previousDebug;
    }
    render();
  }
  try {
    const ambient = world.children.find(o => o.isHemisphereLight);
    const lights = Object.fromEntries(['key','rim','fill'].map(id => [id, world.children.find(o => o.name === 'R1 twilight ' + id)]));
    if (!ambient || Object.values(lights).some(o => !o)) throw Error('R4 lighting requires the retained A light rig');
    remember(ambient); ambient.color.set(profile.hemisphere.sky); ambient.groundColor.set(profile.hemisphere.ground); ambient.intensity = profile.hemisphere.intensity;
    for (const id of ['key','rim','fill']) {
      const light = lights[id], p = profile[id]; remember(light);
      light.color.set(p.color); light.intensity = p.intensity; light.position.set(...p.position); light.target.position.set(...p.target);
      if (p.shadowIntensity !== undefined) light.shadow.intensity = p.shadowIntensity;
    }
    const porch = world.getObjectByName('Astra cottage / outward porch light');
    if (porch?.isSpotLight) { remember(porch); porch.color.set(profile.porch.color); porch.intensity = profile.porch.intensity; porch.distance = profile.porch.distance; }
    renderer.toneMappingExposure = profile.exposure;
    if (airEnabled) { air = new T.FogExp2(profile.air.color, profile.air.density); scene.fog = air; }
    world.updateWorldMatrix(true,true);
    const planetInverse = world.matrixWorld.clone().invert();
    const point = node => node.getWorldPosition(new T.Vector3()).applyMatrix4(planetInverse).toArray();
    published = {revision: REVISION, profile: profileId, space: 'planet-local world group', colorSpace: 'sRGB input; Three converts to linear',
      ...profile, porch: {...profile.porch, position: porch ? point(porch) : null, target: porch ? point(porch.target) : null, angle: porch?.angle, penumbra: porch?.penumbra, decay: porch?.decay, castsShadow: porch?.castShadow ?? false}, air: {...profile.air, enabled: airEnabled, implementation: 'very low-density blue depth attenuation on fog-capable surfaces; cosmic shaders unchanged'},
      roles: {key: 'soft warm upper-left modelling light', rim: 'restrained warm left-back edge', fill: 'cool moon/front bounce', porch: 'existing outward-only warm cone'},
      directions: Object.fromEntries(Object.entries(lights).map(([id,l]) => [id,l.position.clone().sub(l.target.position).normalize().toArray()])),
      porchPresent: !!porch, addedLights: 0, addedObjects: 0, addedShadowMaps: 0,
      materialsUnchanged: true, cameraUnchanged: true,
      limitation: 'R1 house/tree painted light uniforms were captured before this module; later material adapters must consume this contract.'};
    world.userData.r4Lighting = published; debug.r4Lighting = published;
    signal?.addEventListener('abort', dispose, {once: true}); render();
    return {dispose};
  } catch (error) { dispose(); throw error; }
}
