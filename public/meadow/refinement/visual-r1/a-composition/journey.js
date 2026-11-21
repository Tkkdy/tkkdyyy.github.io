import {viewPose, applyPose, viewportBlend} from './rig.js';

const ARRIVAL = .55;
// A monotone cubic passes through arrival with a shared velocity. Unlike two
// separate easing ramps it does not halt the camera in the middle of the trip.
function travel(a, b, c, progress) {
  const h0 = ARRIVAL, h1 = 1 - ARRIVAL;
  const d0 = (b - a) / h0, d1 = (c - b) / h1;
  const w0 = 2 * h1 + h0, w1 = h1 + 2 * h0;
  const middle = d0 * d1 <= 0 ? 0 : (w0 + w1) / (w0 / d0 + w1 / d1);
  const first = progress <= ARRIVAL, span = first ? h0 : h1;
  const t = (progress - (first ? 0 : ARRIVAL)) / span;
  const y0 = first ? a : b, y1 = first ? b : c;
  const m0 = first ? 0 : middle, m1 = first ? middle : 0;
  return (2*t**3-3*t*t+1)*y0 + (t**3-2*t*t+t)*span*m0
    + (-2*t**3+3*t*t)*y1 + (t**3-t*t)*span*m1;
}
export function journeyPose(progress, width, height = width < 650 ? 844 : 900) {
  const p = Math.max(0, Math.min(1, progress)), t = viewportBlend(width, height);
  const mix = (a, b) => a + (b - a) * t;
  const arrival = viewPose('default', width, height), close = viewPose('close', width, height);
  // The v7 sky is a finite world plane. In wide layouts a slightly closer,
  // more central establishing frame keeps its boundary outside the viewport.
  const wide = Math.max(0, Math.min(1, (width / height - 1.6) / .4));
  const far = {target: [mix(0, -12 + 4 * wide), mix(7, 8 - 2 * wide), 0], distance: mix(76, 64 - 4 * wide),
    azimuth: mix(.32, .36), elevation: .38, fov: mix(43, 41 - 2 * wide), yaw: 0};
  const pose = {target: far.target.map((v, i) => travel(v, arrival.target[i], close.target[i], p)), yaw: 0};
  for (const k of ['distance', 'azimuth', 'elevation', 'fov']) pose[k] = travel(far[k], arrival[k], close[k], p);
  return pose;
}
export function attachJourney({camera, world, invalidate, signal, debug}) {
  const caption = document.querySelector('#journey-caption');
  const update = () => {
    const range = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const p = Math.max(0, Math.min(1, scrollY / range));
    const pose = journeyPose(p, innerWidth, innerHeight);
    applyPose(camera, world, pose, innerWidth, innerHeight);
    debug.journey = {progress: p, ...pose, position: camera.position.toArray(), worldScale: world.scale.toArray()};
    if (caption) caption.textContent = p < .28 ? '银河深处，一盏暖灯' : p < .72 ? '沿着水声，慢慢靠近' : '小屋、花树，与风中的草甸';
    invalidate();
  };
  addEventListener('scroll', update, {passive: true, signal});
  addEventListener('resize', update, {signal});
  for (const button of document.querySelectorAll('[data-progress]')) {
    button.addEventListener('click', () => scrollTo({
      top: Number(button.dataset.progress) * (document.documentElement.scrollHeight - innerHeight),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    }), {signal});
  }
  debug.syncJourney = update; update();
  return () => { if (debug.syncJourney === update) delete debug.syncJourney; };
}
