import {layouts} from './layout-cache.js';
import {layoutKey} from './layout-key.js';
import * as T from 'three';
import {seatRock} from '../../visual-r3/rocks/placement.js';
import {reshape} from './reshape.js';
export const REVISION='storybook-littoral-2';
export function install(ctx){
 const {world,surface,hydrology,debug}=ctx,group=new T.Group();group.name='storybook-littoral';world.add(group);
 const quality=ctx.quality??'desktop',key=layoutKey(ctx,install.toString()+reshape.toString()+seatRock.toString()),build=new URLSearchParams(location.search).has('layoutBuild'),entry=layouts[quality],cached=!build&&entry?.key===key?entry:null;
 const reshaping=reshape(ctx,cached?.reshaping);
 const bindings=[],geometries=[],materials=[],placements=[],compiles=[];let disposed=false,seed=4217;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 function bind(mesh,edit){const source=mesh.material,mat=source.clone(),compile=source.onBeforeCompile,key=source.customProgramCacheKey();mat.customProgramCacheKey=()=>key+'|'+REVISION;mat.onBeforeCompile=(s,r)=>{compile.call(source,s,r);edit(s);compiles.push(mesh.name)};if(Object.hasOwn(source,'onBeforeRender'))mat.onBeforeRender=source.onBeforeRender;mesh.material=mat;bindings.push({mesh,source,mat});materials.push(mat);}
 const terrain=ctx.terrain.group.children.find(m=>m.isMesh&&m.material?.userData.eGround?.kind==='terrain');
 if(!terrain)throw Error('Littoral requires final terrain');
 bind(terrain,s=>{s.fragmentShader=s.fragmentShader.replace('float shape=max(abs(f.x)*.86,abs(f.y)*1.37)+.24*length(f);','float shape=length(f*vec2(.9,1.2))*(1.+.16*sin(atan(f.y,f.x)*3.+seed*5.));');const anchor='#include <roughnessmap_fragment>';if(!s.fragmentShader.includes(anchor))throw Error('Terrain material anchor missing');s.fragmentShader=s.fragmentShader.replace(anchor,`
 vec2 litQ=eChart(vEPoint);
 float litNoise=r6Noise(litQ*3.4+vec2(12.,7.));
 float litFine=r6Noise(litQ*64.);
 float litCoast=abs(vTerrainFeatures.x);
 float litSand=(1.-smoothstep(.12,.83,litCoast+(litNoise-.5)*.32))*(1.-smoothstep(13.,17.,litQ.y));
 float litWet=(1.-smoothstep(.015,.17,litCoast))*(.42+.58*smoothstep(.28,.74,litNoise));
 vec3 litAggregate=bGrain(litQ*.78,.03);
 vec3 litSandColor=mix(vec3(.30,.245,.172),vec3(.46,.392,.282),litNoise);
 litSandColor*=.84+.25*litFine;
 litSandColor=mix(litSandColor,vec3(.16,.18,.16),litWet*.78);
 litSandColor=mix(litSandColor,vec3(.45,.43,.36),litAggregate.x*.55);
 diffuseColor.rgb=mix(diffuseColor.rgb,litSandColor,litSand*.90*(1.-pathMask*.4));
 vec3 litRoad=bGrain(vTerrainChart*1.15,.05);
 float litWear=r6Noise(vTerrainChart*vec2(16.,3.));
 diffuseColor.rgb*=1.+pathMask*(litWear-.5)*.20;
 diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.20,.17,.135),vec3(.40,.35,.27),litRoad.z),pathMask*litRoad.x*.48);
 terrainMicroRelief=mix(terrainMicroRelief,(litWear-.5)*.0007,pathMask);
 terrainMicroRelief+=litSand*(litFine-.5)*.0005;
 ${anchor}
 roughnessFactor=mix(roughnessFactor,.72,litWet*litSand*.65);
 `);});
 const waterMesh=debug.r8D.mesh;
 bind(waterMesh,s=>{s.fragmentShader=s.fragmentShader.replace('r9Lace*.11+r8RockWash*.30','r9Lace*.045+r8RockWash*.14');const anchor='diffuseColor.rgb*=pigment;';if(!s.fragmentShader.includes(anchor))throw Error('Littoral water pigment anchor missing');s.fragmentShader=s.fragmentShader.replace(anchor,`
 float litShallow=exp(-max(depth,0.)*22.)*(1.-stream);
 float litWaterBreak=waterNoise(p*vec2(9.,12.)+vec2(.7,2.));
 vec3 litBed=mix(vec3(.19,.23,.19),vec3(.34,.34,.25),litWaterBreak);
 pigment=mix(pigment,litBed,litShallow*.42);
 float litContact=(1.-smoothstep(.008,.065,depth))*smoothstep(.31,.74,litWaterBreak)*(1.-stream);
 pigment*=1.-litContact*.16;
 float litFoam=smoothstep(.015,.035,depth)*(1.-smoothstep(.05,.095,depth))*smoothstep(.61,.84,litWaterBreak)*(1.-stream);
 pigment=mix(pigment,vec3(.47,.56,.51),litFoam*.11);
 diffuseColor.rgb*=pigment;`);});
 // Principal stones now have exact revised contact planes and measured footprints.
 world.traverse(mesh=>{if(!mesh.isMesh||!/^fractured-shore-stones-/.test(mesh.name))return;bind(mesh,s=>{s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`
 float litStrata=sin(dot(vEPoint,vec3(3.,23.,5.))+r6Noise(r6Q*2.)*3.);
 float litCrack=(1.-smoothstep(.04,.18+fwidth(litStrata),abs(litStrata)))*smoothstep(.38,.70,r6Noise(r6Q*5.));
 float litMineral=smoothstep(.62,.85,r6Noise(r6Q*17.));
 diffuseColor.rgb*=1.-litCrack*.15;
 diffuseColor.rgb=mix(diffuseColor.rgb,eStoneWarm,litMineral*.10);
 r4StoneRelief-=litCrack*.003;
 #include <roughnessmap_fragment>
 `);});});
 const stoneMat=new T.MeshStandardMaterial({color:'#d4d4d2',roughness:.91,vertexColors:false});
 stoneMat.onBeforeCompile=s=>{s.vertexShader='varying vec3 litPosition;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <project_vertex>','litPosition=transformed;\n#ifdef USE_INSTANCING\nlitPosition=(instanceMatrix*vec4(transformed,1.)).xyz;\n#endif\n#include <project_vertex>');s.fragmentShader='varying vec3 litPosition;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float strata=.5+.5*sin(dot(litPosition,vec3(4.,31.,6.))+sin(litPosition.x*9.)*.8);
 float fissure=pow(strata,20.);
 vec3 grainCell=floor(litPosition*87.);
 float fleck=fract(sin(dot(grainCell,vec3(127.1,311.7,74.7)))*43758.5453);
 fleck=mix(fleck,.5,smoothstep(.6,1.8,length(fwidth(litPosition*87.))));
 diffuseColor.rgb*=.81+.24*fleck-fissure*.15;
 `);};materials.push(stoneMat);
 const batches=Array.from({length:4},(_,k)=>{const g=new T.IcosahedronGeometry(1,2),p=g.attributes.position;for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const f=.88+.12*Math.sin(x*5+z*4+k)*Math.cos(y*6+k);p.setXYZ(i,x*f,y*f*.66,z*f*.83)}g.computeVertexNormals();geometries.push(g);return {g,items:[]};});
 if(cached){placements.push(...cached.placements);cached.batches.forEach((items,i)=>{batches[i].items=items.map(p=>({m:new T.Matrix4().fromArray(p.matrix),color:new T.Color().fromArray(p.color)}))});}else{
 function add(u,v,size,kind){const f=surface.frame(u,v);if(f.zones.protectedHouse||f.zones.protectedTree||f.zones.pathDistance<.40||f.zones.wet)return false;
 const b=batches[Math.floor(random()*4)],n=new T.Vector3(...f.normal),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),n);q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),random()*6.28));const sc=new T.Vector3(size*(.8+random()*.7),size*(.35+random()*.40),size*(.8+random()*.5)),m=new T.Matrix4().compose(new T.Vector3(...f.position),q,sc);seatRock(m,b.g,surface,{embed:Math.min(.035,size*.12),align:true,diagnostics:false});b.items.push({m,color:new T.Color().setHSL(.10+random()*.035,.025+random()*.045,.35+random()*.12)});placements.push({u,v,size,kind});return true;}
 // Paired rock outcrops grow from the incumbent anchors, with broad low shelves and rubble tails.
 const anchors=[];world.traverse(o=>{if(o.isInstancedMesh&&/^fractured-shore-stones-/.test(o.name)){for(let i=0;i<o.count;i++){const m=new T.Matrix4();o.getMatrixAt(i,m);const p=new T.Vector3().setFromMatrixPosition(m);const uv=surface.uvFromDirection(p.toArray());if(uv[1]>1&&uv[1]<15)anchors.push(uv);}}});
 for(const [u,v]of anchors){for(let j=0;j<7;j++){const a=random()*Math.PI*2,d=.30+random()*.61;add(u+Math.cos(a)*d,v+Math.sin(a)*d,j<2?.22+random()*.18:.055+random()*.13,'outcrop');}}
 for(let i=0;i<1800&&placements.length<330;i++){const u=-7+random()*14,v=1+random()*12,f=surface.sample(u,v);if(f.zones.wet)continue;const d=Math.abs(hydrology.shoreline.signedDistance(u,v));if(d<.65&&random()<.45)add(u,v,.025+random()*.065,'shore-gravel');else if(f.zones.pathDistance>.40&&f.zones.pathDistance<.69&&random()<.30)add(u,v,.025+random()*.055,'road-edge');}
 }
 for(let i=0;i<batches.length;i++){const b=batches[i];if(!b.items.length)continue;const mesh=new T.InstancedMesh(b.g,stoneMat,b.items.length);mesh.name='storybook-littoral-rubble-'+i;for(let j=0;j<b.items.length;j++){mesh.setMatrixAt(j,b.items[j].m);mesh.setColorAt(j,b.items[j].color)}mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);}
 const inspect=()=>({revision:REVISION,layoutCache:{mode:cached?'baked':'sampled',quality,key,reason:build?'explicit-build':!entry?'cache-missing':entry.key!==key?'dependency-mismatch':'matched'},stones:placements.length,placements,compiles,draws:group.children.length,waterMeshesAdded:0,terrainGeometryChanged:false,existingStoneTransformsChanged:true,reshaping:reshaping.inspect(),disposed});
 function dispose(){if(disposed)return;disposed=true;ctx.signal?.removeEventListener('abort',dispose);for(const b of bindings)if(b.mesh.material===b.mat)b.mesh.material=b.source;reshaping.dispose();world.remove(group);group.traverse(o=>{if(o.isInstancedMesh)o.dispose()});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());if(debug.storybookLittoral===inspect)delete debug.storybookLittoral;ctx.invalidate?.();}
 debug.storybookLittoral=inspect;ctx.signal?.addEventListener('abort',dispose,{once:true});debug.refreshShadows?.();ctx.invalidate?.();return {dispose,inspect,exportLayout:()=>({key,quality,placements,batches:batches.map(b=>b.items.map(p=>({matrix:p.m.toArray(),color:p.color.toArray()}))),reshaping:reshaping.inspect()})};
}






