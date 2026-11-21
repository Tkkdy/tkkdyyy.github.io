import {REVISION,treeLighting,paintedTreeMaterial} from './tree-material.js';
import {createGarden} from './garden.js';

export function install(context) {
  const {assets,world,signal,invalidate,registerMotion,debug} = context;
  signal?.throwIfAborted();
  const originals=[],materials=[];
  const previousDebug=debug?.garden;
  let garden,unregister,published,disposed=false;
  function dispose() {
    if(disposed)return;
    disposed=true;signal?.removeEventListener('abort',dispose);
    unregister?.();
    for(const [mesh,original,copy] of originals)if(mesh.material===copy)mesh.material=original;
    for(const m of materials)m.dispose();
    garden?.dispose();
    if(debug?.garden===published) {
      if(previousDebug===undefined)delete debug.garden;else debug.garden=previousDebug;
    }
    invalidate?.();
  }
  try {
    const lighting=treeLighting(assets.tree,world);
    assets.tree.traverse(mesh=>{
      if(!mesh.isMesh)return;
      if(!['blossom_painted_scene','blossom_painted_petals'].includes(mesh.name))
        throw Error('Unexpected mesh in protected tree: '+mesh.name);
      if(!mesh.geometry.attributes.color)throw Error('Missing retained tree pigment');
      const original=mesh.material;
      const copy=paintedTreeMaterial(original,
        mesh.name==='blossom_painted_petals'?'blossom':'wood',lighting);
      originals.push([mesh,original,copy]);materials.push(copy);mesh.material=copy;
    });
    garden=createGarden(context);world.add(garden.group);
    unregister=registerMotion?.(garden.group,'garden:root-pocket-breeze');
    published={revision:REVISION,lightingRevision:lighting.revision,
      treeGeometryUnchanged:true,treeVertexColorsUnchanged:true,treeTexturesUnchanged:true,
      materialCopies:materials.length,addedLights:0,stats:garden.stats,
      time:()=>garden.time.value,
      keyDirection:lighting.key.toArray(),rimDirection:lighting.rim.toArray(),
      limitations:'Retained painted occlusion with bounded directional response; no ray-traced canopy transmission.',
    };
    if(debug)debug.garden=published;
    signal?.addEventListener('abort',dispose,{once:true});
    invalidate?.();
    return {group:garden.group,update:frame=>!disposed&&garden.update(frame),dispose};
  }catch(error){dispose();throw error;}
}
