export function validateContract(surface,hydrology){
 const failures=[];const check=(v,m)=>{if(!v)failures.push(m)};
 check(surface.version===1&&hydrology.version===1,'contract version');
 check(surface.radius===12,'world radius');check(surface.revision===hydrology.surfaceRevision,'surface revision');
 check(hydrology.river.length>1,'river sampling');
 for(const [i,r] of hydrology.river.entries()){
  const s=surface.sample(r.u,r.v),p=hydrology.radialPoint(r.u,r.v,r.waterHeight);
  check(Number.isFinite(r.waterHeight)&&r.halfWidth>0,'finite river '+i);
  check(Math.abs(s.height-r.bedHeight)<.02,'bed matches surface '+i);
  check(r.bedHeight<r.waterHeight-.08,'bed clearance '+i);
  check(Math.abs(Math.hypot(...p)-(surface.radius+r.waterHeight))<1e-6,'radial projection '+i);
  if(i){const prev=hydrology.river[i-1];check(r.t>prev.t,'river ordering '+i);check(r.waterHeight<=prev.waterHeight+1e-8,'river downhill '+i)}
 }
 check(Math.abs(hydrology.river.at(-1).waterHeight-hydrology.seaLevel)<.02,'river mouth');
 if(failures.length)throw Error('Terrain/water contract invalid: '+failures.join(', '));
 return {pass:true,revision:surface.revision,samples:hydrology.river.length,shorelineStatus:hydrology.shoreline.status};
}
