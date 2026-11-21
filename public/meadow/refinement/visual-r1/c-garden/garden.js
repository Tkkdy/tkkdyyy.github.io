import * as T from 'three';
import {grassGeometry, flowerGeometry, fernGeometry, stoneGeometry}
  from '../../../modules/ground-ecosystem/geometry.js';

const ROOT = {u: 1.4, v: -2.7};
// Three interrupted pockets; the front centre is deliberately unplanted.
const POCKETS = [
  {u: .63, v: -2.06, rx: .38, rz: .27, flowers: 4, grass: 18},
  {u: 2.28, v: -2.13, rx: .32, rz: .32, flowers: 5, grass: 21},
  {u: 2.01, v: -3.50, rx: .32, rz: .23, flowers: 3, grass: 15},
];
function random(seed) {
  return () => {seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function petalGeometry() {
  const g = new T.BufferGeometry();
  // A small cupped petal, not a billboard or a luminous point.
  g.setAttribute('position', new T.Float32BufferAttribute([
    0,.004,0, -.021,.004,.020, -.017,.009,.055,
    0,.004,0, -.017,.009,.055, .006,.012,.068,
    0,.004,0, .006,.012,.068, .022,.007,.044,
    0,.004,0, .022,.007,.044, .020,.002,.012,
  ], 3));
  g.computeVertexNormals();
  return g;
}
function breeze(material, time) {
  material.onBeforeCompile = shader => {
    shader.uniforms.gardenTime = time;
    shader.vertexShader = 'uniform float gardenTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n' + [
        'float phase=instanceMatrix[3].x*1.7+instanceMatrix[3].z*.9;',
        'float rootWeight=pow(max(position.y,0.),1.6);',
        'float bend=(sin(gardenTime*.72+phase)-sin(phase))*.023;',
        'transformed.x+=bend*rootWeight;',
        'transformed.z+=bend*rootWeight*.45;',
      ].join('\n'));
  };
  material.customProgramCacheKey = () => 'c-root-pocket-breeze-1';
}

export function createGarden({surface, hydrology}) {
  const group = new T.Group(); group.name = 'C garden / root pockets';
  const geometries = [], materials = [], records = [], time = {value: 0};
  const rng = random(41763), occupied = [];
  let disposed=false;
  function dispose() {
    if(disposed)return;disposed=true;
    group.removeFromParent();
    for(const mesh of group.children)mesh.dispose();
    group.clear();
    for(const g of geometries)g.dispose();
    for(const m of materials)m.dispose();
  }
  const within = (u,v,footprint) => {
    if (Math.hypot(u-ROOT.u,v-ROOT.v) > 1.35-footprint
      || Math.hypot(u-ROOT.u,v-ROOT.v) < .63+footprint) return false;
    const s = surface.sample(u,v);
    return !s.zones.wet && !s.zones.protectedHouse
      && s.zones.pathDistance > .70+footprint && s.height > hydrology.seaLevel+.08;
  };
  function layout(kind, pocket, count) {
    const items=[];
    for(let attempt=0;items.length<count && attempt<count*35;attempt++) {
      const a=rng()*Math.PI*2,r=Math.sqrt(rng());
      const u=pocket.u+Math.cos(a)*r*pocket.rx,v=pocket.v+Math.sin(a)*r*pocket.rz;
      const size=kind==='grass'?.38+rng()*.30:kind==='flowers'?.48+rng()*.24:.34;
      const radius=size*(kind==='grass'?.12:.19);
      const footprint=size*(kind==='grass'?.30:.23)+.02;
      if(!within(u,v,footprint)||occupied.some(p=>Math.hypot(p.u-u,p.v-v)<(p.kind==='stone'?p.radius+radius:p.kind===kind?.72*(p.radius+radius):.055)))continue;
      const item={kind,u,v,size,heading:rng()*Math.PI*2,pocket:POCKETS.indexOf(pocket),radius};
      items.push(item);occupied.push(item);
    }
    return items;
  }
  try {
  const stones=[{kind:'stone',u:.57,v:-2.33,size:.25,heading:2.1},
    {kind:'stone',u:2.34,v:-2.71,size:.32,heading:.2},
    {kind:'stone',u:2.51,v:-2.89,size:.17,heading:1.3}].filter(p=>within(p.u,p.v,p.size*1.12+.02));
  occupied.push(...stones.map(p=>({...p,radius:p.size*.78})));
  const flowers=POCKETS.flatMap(p=>layout('flowers',p,p.flowers));
  const grass=POCKETS.flatMap(p=>layout('grass',p,p.grass));
  const ferns=[{kind:'fern',u:2.04,v:-3.55,size:.32,heading:1.9},
    {kind:'fern',u:2.40,v:-2.18,size:.29,heading:4.2}].filter(p=>within(p.u,p.v,p.size*.68+.02));

  const petals=[];
  for(let i=0;i<40;i++) {
    const left=i<17, a=rng()*Math.PI*2,r=Math.sqrt(rng());
    const u=(left?.77:2.08)+Math.cos(a)*r*(left?.35:.44);
    const v=(left?-1.98:-1.95)+Math.sin(a)*r*.20;
    const size=.62+rng()*.60;
    if(within(u,v,.075*size+.01))petals.push({kind:'petal',u,v,size,heading:rng()*Math.PI*2});
  }
  function batch(name, items, geometry, material, moving=false) {
    geometries.push(geometry);materials.push(material);
    if(moving)breeze(material,time);
    const mesh=new T.InstancedMesh(geometry,material,items.length);
    mesh.name='C garden / '+name; mesh.receiveShadow=true; mesh.castShadow=false;
    const matrix=new T.Matrix4(),turn=new T.Matrix4(),scale=new T.Matrix4(),color=new T.Color();
    for(let i=0;i<items.length;i++) {
      const item=items[i],f=surface.frame(item.u,item.v);
      const lift=item.kind==='petal'?.006:item.kind==='stone'?-.025:-.012;
      const position=new T.Vector3(...f.position).addScaledVector(new T.Vector3(...f.normal),lift);
      matrix.makeBasis(new T.Vector3(...f.east),new T.Vector3(...f.normal),new T.Vector3(...f.south))
        .setPosition(position).multiply(turn.makeRotationY(item.heading))
        .multiply(scale.makeScale(item.size,item.size,item.size));
      mesh.setMatrixAt(i,matrix);
      if(item.kind==='petal') color.set(i%4===0?'#9d779e':i%3===0?'#d29aa7':'#b986a5');
      else if(item.kind==='flowers')color.set(item.pocket===0?'#fff3eb':item.pocket===1?'#ede6ff':'#d5ddf2');
      else color.set('#ffffff').multiplyScalar(.85+(i%5)*.035);
      mesh.setColorAt(i,color);
      records.push({...item,lift,position:position.toArray(),normal:f.normal});
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingSphere(); if(moving)mesh.boundingSphere.radius+=.04;
    group.add(mesh);
    return mesh;
  }
  const mat=()=>new T.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:T.DoubleSide});
  const bloomGeometry=flowerGeometry(false),pigment=bloomGeometry.attributes.color;
  const dark=new T.Color('#997aa8'),light=new T.Color('#efd0d0'),p=new T.Color();
  for(let i=0;i<pigment.count;i++) {
    const r=pigment.getX(i),green=pigment.getY(i),b=pigment.getZ(i);
    if(r>green*.94 && bloomGeometry.attributes.position.getY(i)>.36) {
      const l=r*.2126+green*.7152+b*.0722;
      p.copy(dark).lerp(light,Math.min(1,Math.max(0,(l-.16)/.68)));
      pigment.setXYZ(i,p.r,p.g,p.b);
    }
  }
  batch('small blossoms',flowers,bloomGeometry,mat(),true);
  batch('fine grass',grass,grassGeometry(false),mat(),true);
  batch('low fern',ferns,fernGeometry(true),mat(),true);
  batch('root stones',stones,stoneGeometry(2),mat());
  batch('resting petals',petals,petalGeometry(),
    new T.MeshStandardMaterial({roughness:1,metalness:0,side:T.DoubleSide}));
  const stats={pockets:POCKETS.map(p=>({...p})),counts:{flowers:flowers.length,grass:grass.length,
    fern:ferns.length,stones:stones.length,restingPetals:petals.length,flyingPetals:0},
    triangles:group.children.reduce((sum,o)=>sum+(o.geometry.index?.count??o.geometry.attributes.position.count)/3*o.count,0),
    drawCalls:group.children.length,maxRootDistance:1.35,records};
  return {group,stats,time,geometries,materials,
    update({elapsed,reducedMotion}) {
      if(disposed||reducedMotion||!Number.isFinite(elapsed)||elapsed===time.value)return false;
      time.value=elapsed;return true;
    },
    dispose};
  }catch(error){dispose();throw error;}
}
