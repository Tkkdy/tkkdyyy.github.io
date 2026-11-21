import {createMeadow} from './meadow.js';
export const REVISION='fusion-a-ground-detail-5';
const active=new WeakSet();

export function install(ctx){
 const {debug,signal,invalidate,surface}=ctx;signal?.throwIfAborted();
 if(active.has(ctx.world))throw Error('Fusion ground already installed');
 if(surface.revision!=='terrain-r9-open-coast-1'||ctx.hydrology.surfaceRevision!==surface.revision)throw Error('Fusion ground must consume A final R9 surface/hydrology');
 active.add(ctx.world);
 const bindings=[],materials=[],previous=debug.fusionGround;let meadow,disposed=false,published;
 const refresh=()=>{debug.refreshShadows?.();invalidate?.();};
 function dispose(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);meadow?.dispose();for(const b of bindings)if(b.mesh.material===b.material)b.mesh.material=b.source;for(const m of materials)m.dispose();if(debug.fusionGround===published){if(previous===undefined)delete debug.fusionGround;else debug.fusionGround=previous;}active.delete(ctx.world);refresh();}
 try{
  // Retain the complete A material stack, including its E diffuse wrap. Only
  // a short middle section receives soil grain, wear and a broken turf margin.
  const terrain=ctx.terrain.group.children.find(m=>m.isMesh&&m.material?.userData.eGround?.kind==='terrain');
  if(!terrain)throw Error('Missing A terrain material');
  const source=terrain.material,material=source.clone(),compile=source.onBeforeCompile,key=source.customProgramCacheKey();
  if(source.userData.ecosystemWind)material.userData.ecosystemWind=source.userData.ecosystemWind;
  if(Object.hasOwn(source,'onBeforeRender'))material.onBeforeRender=source.onBeforeRender;
  material.name=source.name+' / Fusion subtle path wear';material.customProgramCacheKey=()=>key+'|'+REVISION;
  const compiled={count:0,retainsR9Wrap:false};
  material.onBeforeCompile=function(s,r){
   compile.call(source,s,r);
   if(!s.uniforms.r9DiffuseWrapGain)throw Error('Fusion terrain lost A R9/E diffuse wrap');
   compiled.count++;compiled.retainsR9Wrap=s.uniforms.r9DiffuseWrapGain.value===1;
   const edge='float pathMask=1.-smoothstep(.274-pathAA,.306+pathAA,wornDistance+bTuft*.028);';
   if(s.fragmentShader.split(edge).length!==2)throw Error('Fusion path edge anchor changed');
   s.fragmentShader=s.fragmentShader.replace(edge,`
    // A's path field and palette still own this surface. Alter only a short
    // middle stretch; several-centimetre turf/earth fingers have soft edges.
    float fusionSection=1.-smoothstep(.58,1.,length((vTerrainChart-vec2(-.9,.5))/vec2(1.55,1.05)));
    float fusionEdgeNoise=r6Noise(vTerrainChart*16.+vec2(19.,7.));
    float fusionTuft=smoothstep(.55,.77,r6Noise(vTerrainChart*9.+vec2(3.,17.)));
    float fusionMargin=fusionSection*((fusionEdgeNoise-.5)*.070+fusionTuft*.038);
    float pathMask=1.-smoothstep(.274-pathAA,.306+pathAA,wornDistance+bTuft*.028+fusionMargin);
   `);
   const anchor='#include <roughnessmap_fragment>';
   if(s.fragmentShader.split(anchor).length!==2)throw Error('Fusion path roughness anchor changed');
   s.fragmentShader=s.fragmentShader.replace(anchor,`
    vec2 fusionQ=eChart(vEPoint);
    float fusionLocal=fusionSection*pathMask;
    float fusionCentre=(1.-smoothstep(.10,.24,pathDistance))*fusionLocal;
    // Denser fine aggregate supplements A's sparse larger pebbles. bGrain
    // already antialiases each irregular seed; attenuate subpixel detail.
    vec2 fusionGrainQ=mat2(.91,.4146,-.4146,.91)*fusionQ*1.65+vec2(8.7,3.2);
    vec3 fusionGrain=bGrain(fusionGrainQ,.12);
    float fusionResolve=1.-smoothstep(.7,1.8,length(fwidth(fusionGrainQ*18.)));
    float fusionDust=r6Noise(fusionQ*vec2(53.,47.)+vec2(21.,4.))-.5;
    float fusionAggregate=fusionGrain.x*(fusionGrain.z-.42);
    // Balanced warm pigment variation, never an overall dark patch. The
    // walked centre compresses relief while retaining fine surface grains.
    diffuseColor.rgb*=1.+fusionLocal*fusionResolve*(fusionDust*.22+fusionAggregate*.34-fusionGrain.y*.065);
    terrainMicroRelief*=1.-fusionCentre*.24;
    terrainMicroRelief+=fusionLocal*fusionResolve*(fusionGrain.x*.0005-fusionGrain.y*.0003+fusionDust*.00055);
    ${anchor}
    roughnessFactor=clamp(roughnessFactor-fusionCentre*.10+fusionLocal*fusionDust*.07,.78,1.);
   `);
  };
  bindings.push({mesh:terrain,source,material});materials.push(material);terrain.material=material;
  meadow=createMeadow(ctx);
  published={revision:REVISION,surfaceRevision:surface.revision,hydrologyRevision:ctx.hydrology.surfaceRevision,compiled,
   pathDetail:{centre:[-.9,.5],radii:[1.55,1.05],edgeMaxOffset:.073,grainCellMetres:1/(18*1.65),additionalDraws:0},
   stats:{...meadow.stats,materialCopies:1,modifiedExistingInstances:0,lightsChanged:0,mainModelsChanged:0},
   placements:meadow.records,stones:meadow.stoneRecords,
   preservation:{sourceMatrices:true,sourceGeometry:true,palette:true,exposure:true,lights:true,fog:true,mainHouse:true,mainTree:true,windClock:true},
   limitations:'New detail is sampled on A terrain and footprint-tested against A water/path/root masks. Added small plants receive cached shadows but do not cast new shadows. Existing geometry/materials and the ecology clock are shared. No new terrain or hydrology.',dispose};
  debug.fusionGround=published;signal?.addEventListener('abort',dispose,{once:true});refresh();return {dispose};
 }catch(e){dispose();throw e;}
}
