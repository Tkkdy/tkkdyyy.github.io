import type { WorldPoint } from './camera';
export interface CelestialNode {
  id: string; kind: 'reading' | 'scene'; position: WorldPoint;
  label: string; title: string; radius: number; asset: string;
}
/** Add content and scene nodes here; Pixi and accessible HTML share these identities. */
export const celestialNodes: CelestialNode[] = [
  { id: 'little-note', kind: 'reading', position: { x: 0.61, y: -1.06, z: 3800 },
    label: '音乐星球', title: '走近音乐星球，听一会儿', radius: 14, asset: 'about-universe/planet-music.webp' },
  { id: 'quiet-orbit', kind: 'scene', position: { x: 0.81, y: -0.09, z: 4700 },
    label: '摄影星球', title: '走近摄影星球，看看光留下的片刻', radius: 21, asset: 'about-universe/planet-photography.webp' },
];
/** Quiet scenery on separate depth planes; content targets remain the two named nodes above. */
export const distantBodies = [
  { id: 'quiet-body', title: '安静的轨道', text: '不必一直发亮，也可以有自己的轨道。', position: { x: -1.25, y: -0.65, z: 5200 }, radius: 16, tint: 0xb4c9eb, opacity: 0.42, ring: false },
  { id: 'far-orbit', title: '很远的一站', text: '把一闪而过的念头，轻轻留在这里。', position: { x: -1.65, y: 1.3, z: 7800 }, radius: 13, tint: 0xd4b7cc, opacity: 0.34, ring: true },
];
/** Cassiopeia's five principal stars, with one unmistakable W silhouette. */
export const cassiopeia = [[-116, -30], [-64, 20], [-14, -18], [35, 30], [93, -42]];
/** Coordinates of existing bright stars in the approved source image. */
export const paintedStars = [
  [0.343, 0.097], [0.486, 0.108], [0.281, 0.218], [0.407, 0.191],
  [0.55, 0.062], [0.358, 0.389], [0.717, 0.158], [0.56, 0.289],
  [0.784, 0.248], [0.926, 0.289], [0.107, 0.136], [0.164, 0.068],
];

/** Anchor these reading spots to the same bright stars in each painted plate. */
export const skyWhispers = [
  { id: 'first-light', kind: 'star', title: '一束远光', text: '隔着很远的距离，也有光慢慢抵达。',
    hero: { x: 640 / 1697, y: 106 / 927 }, deep: { x: 581 / 1697, y: 114 / 927 } },
  { id: 'passing-light', kind: 'star', title: '经过的光', text: '偶尔停下来，看看平常没有留意的光。',
    hero: { x: 1243 / 1697, y: 468 / 927 }, deep: { x: 1294 / 1697, y: 509 / 927 } },
] as const;
