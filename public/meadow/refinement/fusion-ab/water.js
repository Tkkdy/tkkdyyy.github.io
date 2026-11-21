import * as T from 'three';

export const REVISION = 'fusion-water-broken-faces-2';
const active = new WeakSet();
const PALETTE = Object.freeze({
  water_deep: '#173f5d', water_shallow: '#4e8a8f',
  water_lavender: '#526c8b', water_stroke: '#94b3bc',
});
function once(source, anchor, replacement) {
  if (source.split(anchor).length !== 2)
    throw Error('Fusion water requires one A shader anchor: ' + anchor.slice(0, 100));
  return source.replace(anchor, replacement);
}

// A owns the water mesh, animation clock and optical reflection callbacks.
// This adapter only adjusts its material, between A's softness and B's detail.
export function install(ctx) {
  const {water, debug, signal, invalidate} = ctx;
  signal?.throwIfAborted();
  const meshes = [];
  water.group.traverse(o => {if (o.isMesh) meshes.push(o);});
  if (meshes.length !== 1) throw Error('Fusion water requires A unique water mesh');
  const mesh = meshes[0], source = mesh.material;
  if (active.has(mesh)) throw Error('Fusion water already installed');
  if (debug.r8D?.material !== source || debug.r8D.revision !== 'r9-water-broken-light-2')
    throw Error('Fusion water must follow the complete A / R9 water chain');
  if (ctx.surface.revision !== ctx.hydrology.surfaceRevision)
    throw Error('Fusion water provider mismatch');

  const material = source.clone();
  const inheritedCompile = source.onBeforeCompile, inheritedKey = source.customProgramCacheKey;
  const previous = debug.fusionWater;
  let disposed = false, published, compiled = null, clock = null, compiles = 0;
  material.name = 'Fusion / A water with soft B depth and broken reflection';
  material.roughness = .38;
  material.specularIntensity = .19;
  if (Object.hasOwn(source, 'onBeforeRender')) material.onBeforeRender = source.onBeforeRender;
  material.customProgramCacheKey = () => inheritedKey.call(source) + '|' + REVISION;
  material.onBeforeCompile = function(shader, renderer) {
    inheritedCompile.call(source, shader, renderer);
    const upstreamClock = shader.uniforms.waterTime;
    if (!upstreamClock) throw Error('Fusion water lost the upstream animation clock');
    const safeFlowAnchor = 'float r9FlowStretch=length(vec2(dFdx(vWater.y),dFdy(vWater.y)))/max(length(fwidth(p)),1e-5);';
    const safeSlopeAnchor = 'vec2 r9SafeSlope=mix(slope,r9ContinuousSlope,smoothstep(2.5,6.,r9FlowStretch));';
    if (!shader.fragmentShader.includes(safeFlowAnchor) || !shader.fragmentShader.includes(safeSlopeAnchor))
      throw Error('Fusion water requires A river/sea derivative fallback');
    for (const [name, hex] of Object.entries(PALETTE)) {
      if (!shader.uniforms[name]) throw Error('Fusion water missing inherited palette ' + name);
      shader.uniforms[name] = {value: new T.Color(hex)};
    }
    const edits = [
      // B separates deep body from broad milky shore lanes. Stop short of its .72.
      ['pigment=mix(pigment,r8Body,.45);', 'pigment=mix(pigment,r8Body,.63);'],
      ['r6Littoral*(.48-.14*stream)', 'r6Littoral*(.32-.09*stream)'],
      ['stream*r8Filament*.035*detailFade', 'stream*r8Filament*.040*detailFade'],
      ['(1.-stream)*r8BayMark*.027*detailFade', '(1.-stream)*r8BayMark*.032*detailFade'],
      // Keep the existing waves and frequencies; modestly reveal their form.
      ['slope*=mix(.52,.24,stream);', 'slope*=mix(.56,.26,stream);'],
      ['vec3 r6ReflectionNormal=normalize(mix(normal,geometryNormal,.62));',
       'vec3 r6ReflectionNormal=normalize(mix(normal,geometryNormal,.56));'],
      // Bound reflectance instead of importing B's hard global lights/specular .30.
      ['roughnessFactor=clamp(roughness+.035*wash+.055*shore+.025*stream+.08*r8RockWash,.34,.68);', `
      // Reuse A's advected finite crests as a microfacet roughness distribution.
      // The lights still decide whether a face reflects: no added radiance,
      // pigment stripe, new wave frequency or broadened analytic reflection.
      // Slightly rougher gaps separate narrow, smooth faces inside the existing
      // highlight. Fade back to v1 at subpixel scale and on the shallow bank.
      float fusionFace=smoothstep(.06,.52,sqrt(max(r9Crest*r9Broken,0.)));
      float fusionFaceDetail=detailFade*smoothstep(.025,.16,depth)*(1.-.60*stream);
      roughnessFactor=clamp(roughness+.035*wash+.075*shore+.025*stream+.08*r8RockWash
        +mix(.020,-.140,fusionFace)*fusionFaceDetail,.25,.70);`],
      ['dWarm/=1.+r4WarmEnergy*1.4;', 'dWarm/=1.+r4WarmEnergy*1.65;'],
      ['      diffuseColor.rgb*=pigment;', `
      // Depth-bounded irregular shallow patches; neither a white shore outline
      // nor the stronger B dark wash. The underlying A foam remains unchanged.
      float fusionShallowBreak=.66+.34*waterNoise(p*2.7+vec2(9.,3.));
      float fusionShelf=shore*(1.-smoothstep(.12,.55,depth));
      pigment=mix(pigment,water_deep*(.82+.12*wash),fusionShelf*(1.-fusionShallowBreak)*.14);
      diffuseColor.rgb*=pigment;`],
    ];
    for (const [anchor, replacement] of edits)
      shader.fragmentShader = once(shader.fragmentShader, anchor, replacement);
    if (shader.uniforms.waterTime !== upstreamClock || !shader.fragmentShader.includes(safeFlowAnchor) || !shader.fragmentShader.includes(safeSlopeAnchor))
      throw Error('Fusion water changed protected clock or derivative fallback');
    clock = upstreamClock; compiled = shader; compiles++;
  };

  function dispose() {
    if (disposed) return;
    disposed = true; signal?.removeEventListener('abort', dispose);
    if (mesh.material === material) mesh.material = source;
    material.dispose(); active.delete(mesh);
    if (debug.fusionWater === published) {
      if (previous === undefined) delete debug.fusionWater;
      else debug.fusionWater = previous;
    }
    invalidate?.();
  }
  try {
    active.add(mesh); mesh.material = material;
    published = {
      revision: REVISION, mesh, material, sourceMaterial: source, palette: PALETTE,
      surfaceRevision: ctx.surface.revision,
      inspect: () => ({shader: compiled, clock, compiles, disposed, roughness: material.roughness, specularIntensity: material.specularIntensity}),
      stats: {materialCopies: 1, geometryChanges: 0, addedObjects: 0, addedTextures: 0, addedLights: 0, addedClocks: 0, addedRenderPasses: 0},
      preserved: {flowStretchFallback: true, sourceClock: true, waveFunctions: true, waveFrequencies: true, foam: true, geometry: true, lighting: true, exposure: true, fog: true},
      limitations: 'Same A procedural depth and finite sky/window reflection. No object mirror, refraction, simulated fluid or added surface. Retained A wave normals with finite-crest microfacet roughness (.25 minimum) and the v1 reflection energy. Crest highlight concentration may change local peak brightness; whole-water pigment/exposure are unchanged.',
      dispose,
    };
    debug.fusionWater = published;
    signal?.addEventListener('abort', dispose, {once: true}); signal?.throwIfAborted();
    invalidate?.(); return {dispose};
  } catch (error) {dispose(); throw error;}
}
