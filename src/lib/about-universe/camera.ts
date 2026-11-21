export interface WorldPoint { x: number; y: number; z: number }
export interface Camera { x: number; y: number; z: number; zoom: number }
export const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
export const smooth = (n: number) => { const p = clamp(n); return p * p * (3 - 2 * p); };
export function cameraAt(progress: number, entryZoom = 1): Camera {
  const p = smooth(progress);
  return { x: 0.035 * p, y: -0.8 * p, z: 1500 * p, zoom: entryZoom };
}
/** Positions use viewport fractions at a focal distance of 1000 world units. */
export function project(point: WorldPoint, camera: Camera, width: number, height: number) {
  const scale = 1000 / Math.max(120, point.z - camera.z) * camera.zoom;
  return { x: width * (0.5 + (point.x - camera.x) * scale),
    y: height * (0.5 + (point.y - camera.y) * scale), scale };
}
