// Visual parameters only. Geometry and water levels belong to the provider.
export const WATER = Object.freeze({
  status: 'READY_FOR_REVIEW',
  surfaceRevision: 'prototype-6e8bc6f',
  dependencyState: 'FIXTURE_ONLY_AWAITING_FROZEN_TERRAIN',
  gridStep: .23,
  coarseStep: 1,
  riverSubdivisions: 2,
  riverColumns: 8,
  motionHz: 24,
  flowMetresPerSecond: .075,
  // Ripple evolution is independent of the slower downstream drift.
  rippleTimeScale: .45,
  roughness: .29,
  // No vertex displacement: wave amplitude 0, including at the shoreline.
  waveAmplitude: 0,
  palette: Object.freeze({
    deep: '#102f46', shallow: '#2c5364', lavender: '#626b99',
    stroke: '#8faeb9', warm: '#d4b994',
  }),
});
