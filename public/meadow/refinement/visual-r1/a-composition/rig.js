import * as T from 'three';

// These cameras frame the frozen r5 world; they never move, rescale or hide it.
export const COMPOSITIONS = Object.freeze({
  horizon: {target: [-5.6, 13.5, -.6], distance: 27.5, azimuth: .5, elevation: .34, fov: 41},
  garden: {target: [-3.8, 11.8, 0], distance: 34, azimuth: .24, elevation: .48, fov: 41},
});

// Shared lighting contract. Colours are sRGB input to Three; intensities are
// renderer units. B/C should calibrate cloned materials against these lights.
export const LIGHTING = Object.freeze({
  revision: 'astra-twilight-1',
  exposure: 1.05,
  hemisphere: {sky: '#a8b8df', ground: '#303953', intensity: .95},
  key: {color: '#ffd4a4', intensity: 2.2, position: [-16, 20, 7], target: [-1, 9, -2]},
  rim: {color: '#c4a7df', intensity: .8, position: [7, 18, -14], target: [0, 10, -2]},
  fill: {color: '#9fb8e1', intensity: .55, position: [8, 13, 19], target: [0, 9, 0]},
  shadow: {size: 2048, intensity: .42, bias: -.00015, normalBias: .035, radius: 3},
});
export const REFERENCE = Object.freeze({radius: 12, seed: 4141, exposure: LIGHTING.exposure, near: .1, far: 180});
export function getComposition() {
  const id = new URLSearchParams(globalThis.location?.search ?? '').get('composition');
  return COMPOSITIONS[id] ?? COMPOSITIONS.horizon;
}
// Continuous framing through portrait, tablet and landscape aspect ratios.
export function viewportBlend(width, height) {
  const x = Math.max(0, Math.min(1, (width / height - .75) / .85));
  return x * x * (3 - 2 * x);
}
export function viewPose(name, width, height = width < 650 ? 844 : 900) {
  const t = viewportBlend(width, height), base = getComposition();
  const mix = (a, b) => a + (b - a) * t;
  if (name === 'close') return {
    target: [mix(0, -1.5), mix(14, 13.9), mix(-1.4, -1.3)],
    distance: mix(29, 20.5), azimuth: mix(.32, .44), elevation: .34,
    fov: mix(43, 39), yaw: 0,
  };
  return {...base, target: [mix(0, base.target[0]), mix(12.7, base.target[1]), mix(-.5, base.target[2])],
    distance: mix(42, base.distance), azimuth: mix(.32, base.azimuth),
    fov: mix(43, base.fov), yaw: name === 'rotate' ? Math.PI / 2 : 0};
}
export function applyPose(camera, world, pose, width, height) {
  const target = new T.Vector3(...pose.target);
  camera.position.copy(target).add(new T.Vector3(
    Math.sin(pose.azimuth) * Math.cos(pose.elevation), Math.sin(pose.elevation),
    Math.cos(pose.azimuth) * Math.cos(pose.elevation)).multiplyScalar(pose.distance));
  camera.up.set(0, 1, 0); camera.lookAt(target);
  camera.aspect = width / height; camera.fov = pose.fov;
  camera.near = REFERENCE.near; camera.far = REFERENCE.far; camera.updateProjectionMatrix();
  world.rotation.set(0, pose.yaw ?? 0, 0);
}
export function applyView(camera, world, name, width, height) {
  if (!['default', 'close', 'rotate'].includes(name)) throw Error('Unknown composition view');
  applyPose(camera, world, viewPose(name, width, height), width, height);
}
export function addLights(world) {
  const h = LIGHTING.hemisphere;
  const ambient = new T.HemisphereLight(h.sky, h.ground, h.intensity);
  ambient.name = 'R1 twilight hemisphere'; world.add(ambient);
  for (const id of ['key', 'rim', 'fill']) {
    const p = LIGHTING[id], light = new T.DirectionalLight(p.color, p.intensity);
    light.name = 'R1 twilight ' + id; light.position.set(...p.position); light.target.position.set(...p.target);
    if (id === 'key') {
      light.castShadow = true; light.shadow.mapSize.set(LIGHTING.shadow.size, LIGHTING.shadow.size);
      Object.assign(light.shadow.camera, {left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 65});
      const {size, ...shadow} = LIGHTING.shadow; Object.assign(light.shadow, shadow);
    }
    world.add(light, light.target);
  }
  world.userData.compositionLighting = LIGHTING;
}
