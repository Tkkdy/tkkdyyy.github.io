// All distances are scene metres; local surface coordinates are east u / south v.
export const PLANET = Object.freeze({
  radius: 12,
  widthSegments: 256,
  heightSegments: 192,
});
export const SITES = Object.freeze({
  cottage: { u: -2.2, v: -2.4, height: 0.72, halfWidth: 2.35, halfDepth: 2.55 },
  tree: { u: 1.4, v: -2.7, height: 0.76, radius: 1.35 },
});
export const BAY = Object.freeze({
  u: -3.8,
  v: 5.1,
  rx: 4.3,
  rz: 3.2,
  waterLevel: -0.55,
});
export const STREAM = Object.freeze([
  [4.4, -5.8],
  [4.8, -4.1],
  [4.25, -2.25],
  [3.1, -0.3],
  [2.2, 1.2],
  [1.7, 2.7],
  [0.35, 3.7],
  [-1.25, 4.5],
]);
export const PATH = Object.freeze([
  [-2.2, -0.95],
  [-2.15, -0.3],
  [-1.15, 0.35],
  [0.1, 0.8],
  [0.55, 1.65],
  [0.1, 2.9],
]);
export const ASSET = new URL(
  "../blender-study/art/storybook-study.glb.bin",
  import.meta.url,
);

// Broad receiving water basin, connected to the bay mouth.
export const SEA = { u: -7, v: 11, rx: 8, rz: 8 };
