import { PLANET, SITES, BAY, SEA, STREAM, PATH } from "./config.js";
const R = PLANET.radius;
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const normalize = (a) => {
  const n = Math.hypot(...a) || 1;
  return a.map((x) => x / n);
};
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const sub = (a, b) => a.map((x, i) => x - b[i]);
export function directionFromUV(u, v) {
  const d = Math.hypot(u, v),
    t = d / R,
    s = d ? Math.sin(t) / d : 1 / R;
  return [u * s, Math.cos(t), v * s];
}
export function uvFromDirection(n) {
  const t = Math.acos(clamp(n[1], -1, 1)),
    d = Math.hypot(n[0], n[2]);
  return d > 1e-8
    ? [(R * t * n[0]) / d, (R * t * n[2]) / d]
    : [0, n[1] < 0 ? Math.PI * R : 0];
}
function curve(points, count) {
  const out = [];
  for (let j = 0; j <= count; j++) {
    const q = (j / count) * (points.length - 1),
      i = Math.min(points.length - 2, Math.floor(q)),
      t = q - i,
      p0 = points[Math.max(0, i - 1)],
      p1 = points[i],
      p2 = points[i + 1],
      p3 = points[Math.min(points.length - 1, i + 2)];
    out.push(
      [0, 1].map(
        (k) =>
          0.5 *
          (2 * p1[k] +
            (-p0[k] + p2[k]) * t +
            (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t +
            (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t),
      ),
    );
  }
  return out;
}
export const riverLine = curve(STREAM, 96),
  pathLine = curve(PATH, 64);
export function nearest(line, u, v) {
  let best = { distance: Infinity, t: 0, u: 0, v: 0 };
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i],
      b = line[i + 1],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      f = clamp(((u - a[0]) * dx + (v - a[1]) * dz) / (dx * dx + dz * dz));
    const x = a[0] + f * dx,
      z = a[1] + f * dz,
      d = Math.hypot(u - x, v - z);
    if (d < best.distance)
      best = { distance: d, t: (i + f) / (line.length - 1), u: x, v: z };
  }
  return best;
}
export const waterStage = (t) =>
  1.18 - 1.73 * smooth(0, 0.9, t) - 0.008 * smooth(0.9, 1, t);
export const channelWidth = (t) => 0.19 + 0.15 * t;
export function features(u, v) {
  return {
    sea: Math.hypot((u - SEA.u) / SEA.rx, (v - SEA.v) / SEA.rz),
    bay: Math.hypot((u - BAY.u) / BAY.rx, (v - BAY.v) / BAY.rz),
    river: nearest(riverLine, u, v),
    path: nearest(pathLine, u, v),
  };
}
function gaussian(u, v, x, z, sx, sz) {
  return Math.exp(-(((u - x) / sx) ** 2) - ((v - z) / sz) ** 2);
}
export function heightAt(u, v, n = directionFromUV(u, v), f = features(u, v)) {
  let h =
    0.13 * Math.sin(n[0] * 8 + n[2] * 3) * Math.cos(n[1] * 7) +
    0.09 * Math.sin(n[2] * 11 - n[1] * 4) +
    0.045 * Math.cos(n[0] * 19 + n[1] * 8);
  h +=
    1.35 * gaussian(u, v, 4.6, -6.1, 3.3, 3.0) +
    0.62 * gaussian(u, v, -5.4, -4.8, 3.6, 2.8) +
    0.38 * gaussian(u, v, 6.0, 1, 2.5, 4);
  h = mix(
    h,
    -1.05 + 0.07 * Math.sin(u * 1.5 + v),
    Math.max(1 - smooth(0.72, 1.17, f.bay), 1 - smooth(0.8, 1.12, f.sea)),
  );
  const width = channelWidth(f.river.t),
    incision = 1 - smooth(width * 0.8, width + 0.48, f.river.distance);
  h = mix(h, waterStage(f.river.t) - 0.23, incision);
  // A house is rigid. Its compact terrace is tangent to the globe, feathered into it.
  const s = SITES.cottage,
    du = (u - s.u) / s.halfWidth,
    dv = (v - s.v) / s.halfDepth;
  const rect = (Math.abs(du) ** 6 + Math.abs(dv) ** 6) ** (1 / 6),
    weight = 1 - smooth(0.91, 1.42, rect);
  const d = dot(n, directionFromUV(s.u, s.v));
  if (weight > 0 && d > 0.5) h = mix(h, (R + s.height) / d - R, weight);
  const tree = SITES.tree,
    td = Math.hypot(u - tree.u, v - tree.v),
    tw = 1 - smooth(tree.radius, tree.radius + 0.6, td);
  const tn = dot(n, directionFromUV(tree.u, tree.v));
  if (tw > 0 && tn > 0.5) h = mix(h, (R + tree.height) / tn - R, tw);
  h -= 0.025 * (1 - smooth(0.23, 0.42, f.path.distance));
  return h;
}
export function sampleSurface(u, v) {
  const direction = directionFromUV(u, v),
    zones = features(u, v),
    height = heightAt(u, v, direction, zones);
  return {
    u,
    v,
    height,
    direction,
    zones,
    position: direction.map((x) => x * (R + height)),
  };
}
export function surfaceFrame(u, v) {
  const s = sampleSurface(u, v),
    e = 0.025,
    dx = sub(
      sampleSurface(u + e, v).position,
      sampleSurface(u - e, v).position,
    ),
    dz = sub(
      sampleSurface(u, v + e).position,
      sampleSurface(u, v - e).position,
    );
  const normal = normalize(cross(dz, dx)),
    east = normalize(dx),
    south = normalize(cross(east, normal));
  return { ...s, normal, east, south };
}
export function radialClearance(point) {
  const n = normalize(point),
    [u, v] = uvFromDirection(n);
  return Math.hypot(...point) - R - heightAt(u, v, n);
}
