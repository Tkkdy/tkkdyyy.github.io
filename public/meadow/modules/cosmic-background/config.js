// Private-night painting layout in the unchanged reference rig's world basis.
export const PARAMETERS = Object.freeze({
  revision: 'cosmic-painted-v7', seed: 4141,
  motionDefault: false, twinkleAmplitude: .12, twinklePeriodSeconds: 8,
  starCount: 208, mobileStarCount: 110,
  origin: Object.freeze([-5.3, 9, 0]), azimuth: .32, elevation: .38,
  galaxy: Object.freeze({x: -10, y: 8, depth: 32, width: 86, height: 86*941/1672}),
  sun: Object.freeze({x: -9, y: -4.0, depth: 26, width: 38, height: 19}),
  moon: Object.freeze({x: 18.2, y: 14.7, depth: 22, width: 4.8, height: 4.8}),
  stars: Object.freeze({depthMin: 22, depthMax: 29, width: 94, height: 60}),
  mobile: Object.freeze({
    galaxy: Object.freeze({x: -5, y: 12, depth: 32, width: 70, height: 70*941/1672}),
    sun: Object.freeze({x: -2.8, y: 3.8, depth: 26, width: 29, height: 14.5}),
    moon: Object.freeze({x: 10, y: 17.0, depth: 22, width: 4.4, height: 4.4}),
  }),
});
