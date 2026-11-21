export const CONFIG = Object.freeze({
  revision: 'ground-ecosystem-v4-breeze',
  terrainRevision: 'prototype-6e8bc6f',
  dependencyState: 'FIXTURE_ONLY_AWAITING_FROZEN_TERRAIN',
  roadHalfWidth: 0.48,
  waterMargin: 0.12,
  house: {u: -2.2, v: -2.4, halfWidth: 2.35, halfDepth: 2.55},
  tree: {u: 1.4, v: -2.7, radius: 1.35},
  // Deliberate islands of growth, with broad breathing spaces between them.
  patches: [
    [-6.0,-1.2,1.6,1.3], [-5.6,-5.7,2.1,1.4], [-2.5,-6.7,1.8,1.0],
    [1.3,-5.4,1.6,0.8], [3.0,-2.8,0.8,1.7], [1.7,-0.7,1.0,0.6],
    [-3.4,1.0,1.5,0.65], [-6.7,1.0,1.4,1.0], [3.8,2.7,1.4,1.1],
    [6.1,0.6,2.0,1.7], [7.3,4.5,1.6,2.0], [3.2,6.8,1.4,2.0],
    [-9.6,0.6,1.2,2.1], [7.3,-5.3,1.8,1.5], [8.5,9.4,1.9,1.5],
  ],
  rocks: [
    [-5.6,-0.2,0.65],[-5.3,0.5,0.33],[-6.0,0.5,0.25],
    [3.15,-3.0,0.43],[3.5,-2.55,0.25], [5.7,0.3,0.69],[6.3,0.8,0.4],
    [3.15,4.5,0.65],[3.7,4.7,0.34],[3.0,5.15,0.25],
    [7.4,6.1,0.92],[8.1,6.7,0.46],[7.1,6.9,0.3],
    [-8.5,0.0,0.66],[-9.1,0.1,0.28], [6.6,-6.2,0.73],[7.3,-6.3,0.4],
    [1.2,-4.4,0.3],[2.0,-4.5,0.22], [4.0,8.5,0.8], [4.7,9.0,0.34],
  ],
  counts: {grass: 650, flowers: 115, fern: 55, moss: 220},
  globeCounts: {grass: 2100, flowers: 480, fern: 65, moss: 540, rock: 28},
  chartLimit: Math.PI * 12 - 0.1,
});

export function randomFromSeed(seed) {
  let s = seed >>> 0;
  return () => {s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296;};
}

export function riverClearance(hydrology, u, v) {
  let clearance = Infinity;
  for (let i=1; i<hydrology.river.length; i++) {
    const a=hydrology.river[i-1], b=hydrology.river[i], dx=b.u-a.u, dz=b.v-a.v;
    const t=Math.max(0,Math.min(1,((u-a.u)*dx+(v-a.v)*dz)/(dx*dx+dz*dz || 1)));
    clearance=Math.min(clearance,Math.hypot(u-a.u-dx*t,v-a.v-dz*t)-(a.halfWidth+(b.halfWidth-a.halfWidth)*t));
  }
  return clearance;
}

// Only the fixture's documented path.distance adapter is used. Never invent a road
// on an unrecognized provider. Formal zones/protectedAreas remain an integration request.
export function tangentUV(surface, frame, x, z) {
  const p=frame.position.map((n,i)=>n+frame.east[i]*x+frame.south[i]*z);
  const length=Math.hypot(...p);
  return surface.uvFromDirection(p.map(n=>n/length));
}

export function allowed(surface, hydrology, u, v, footprint, providedFrame) {
  if(Math.hypot(u,v)+footprint>=CONFIG.chartLimit)return false;
  const h=CONFIG.house,t=CONFIG.tree,frame=providedFrame??surface.frame(u,v);
  if(frame.normal.reduce((s,x,i)=>s+x*frame.direction[i],0)<.82)return false;
  for(let k=0;k<9;k++){
    const angle=k*Math.PI/4,r=k===8?0:footprint;
    const [x,z]=tangentUV(surface,frame,Math.cos(angle)*r,Math.sin(angle)*r);
    if(Math.hypot(x,z)>=CONFIG.chartLimit)return false;
    if(Math.abs(x-h.u)<h.halfWidth+.1&&Math.abs(z-h.v)<h.halfDepth+.1)return false;
    if(Math.hypot(x-t.u,z-t.v)<t.radius+.04)return false;
    const sample=surface.sample(x,z),road=sample.zones?.path?.distance;
    if(!Number.isFinite(road))throw Error('GroundEcosystem requires provider zones.path.distance; request a shared contract adapter.');
    if(road<CONFIG.roadHalfWidth||sample.height<hydrology.seaLevel+.05||hydrology.shoreline.signedDistance(x,z)<=0||riverClearance(hydrology,x,z)<CONFIG.waterMargin)return false;
  }
  return true;
}

export function makeLayout(surface, hydrology, seed=4141, quality='desktop') {
  if (surface.revision!==CONFIG.terrainRevision || hydrology.surfaceRevision!==surface.revision) throw Error('GroundEcosystem terrain pin mismatch: sync frozen terrain before updating the pin.');
  const random=randomFromSeed(seed), items=[];
  const place=(kind,u,v,size,footprint,detail='near')=>{
    const f=surface.frame(u,v), cosine=f.normal.reduce((s,x,i)=>s+x*f.direction[i],0);
    const height={rock:1,grass:.65,fern:.95,flowers:.75,moss:0}[kind]*size;
    footprint+=height*Math.sqrt(Math.max(0,1-cosine*cosine))+.035;
    if (!allowed(surface,hydrology,u,v,footprint,f)) return false;
    if (kind!=='moss' && items.some(p=>p.kind==='rock' && Math.hypot(u-p.u,v-p.v)<(kind==='rock'?.65*(p.size+size):p.footprint+footprint*.65))) return false;
    items.push({kind,u,v,size,footprint,detail,variant:Math.floor(random()*3),heading:random()*Math.PI*2,tint:random()});return true;
  };
  for (const [u,v,s] of CONFIG.rocks) place('rock',u,v,s,s*1.12);
  for (const kind of ['moss','fern','flowers','grass']) {
    const count=CONFIG.counts[kind], factor=quality==='mobile' && kind==='grass'?.7:1;
    let accepted=0;
    for (let attempt=0; accepted<Math.floor(count*factor) && attempt<count*40; attempt++) {
      const p=CONFIG.patches[Math.floor(random()*CONFIG.patches.length)];
      const a=random()*Math.PI*2, r=Math.sqrt(random());
      const u=p[0]+Math.cos(a)*r*p[2], v=p[1]+Math.sin(a)*r*p[3];
      const size=kind==='moss'?.46+random()*.65:kind==='fern'?.7+random()*.43:kind==='flowers'?.7+random()*.42:.65+random()*.6;
      const footprint=size*({moss:1.15,fern:.67,flowers:.23,grass:.32}[kind]);
      if (kind!=='moss' && items.some(o=>o.kind===kind && Math.hypot(o.u-u,o.v-v)<footprint*.8)) continue;
      if(place(kind,u,v,size,footprint)) accepted++;
    }
  }
  // Quiet low growth outside (never inside) the accepted tree's protected root disk.
  for(let i=0;i<17;i++){
    const a=i*Math.PI*2/17, r=1.65+random()*.25;
    place('moss',CONFIG.tree.u+Math.cos(a)*r,CONFIG.tree.v+Math.sin(a)*r,.21,.21);
  }
  // Equal-area candidates are immediately converted by the provider's own chart.
  // No secondary latitude/longitude height field, and no sample at the antipode.
  for(const kind of ['rock','moss','fern','flowers','grass']){
    const target=Math.floor(CONFIG.globeCounts[kind]*(quality==='mobile'?.64:1));
    let accepted=0;
    for(let i=0;accepted<target && i<target*8;i++){
      const y=1-2*random(),angle=random()*Math.PI*2,r=Math.sqrt(1-y*y);
      const direction=[Math.cos(angle)*r,y,Math.sin(angle)*r];
      const [u,v]=surface.uvFromDirection(direction);
      if(Math.hypot(u,v)<8)continue;
      const field=.5+.24*Math.sin(direction[0]*9+direction[2]*5)*Math.sin(direction[1]*8-direction[2]*3);
      if(random()>field+.22)continue;
      const size=kind==='rock'?.28+random()*.5:kind==='moss'?1.05+random()*.85:kind==='fern'?.55+random()*.4:kind==='flowers'?.65+random()*.5:.65+random()*.7;
      const footprint=size*({rock:1.15,moss:1.15,fern:.67,flowers:.23,grass:.32}[kind]);
      if(place(kind,u,v,size,footprint,'far'))accepted++;
    }
  }
  return items;
}
