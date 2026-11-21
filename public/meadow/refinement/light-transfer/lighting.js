import * as T from 'three';
import {LIGHTING as R8_LIGHTING,houseUniforms} from '../visual-r8/e-lighting/materials.js';
export const REVISION='light-transfer-b-on-f-1';
const ACTIVE=new WeakSet();
// B's material response is retained exactly for petals, trunk and stone.
// F's complete facade chain keeps the requested warm door/wall contrast.
function litMaterial(raw, kind, final, albedo, ao, mask, normal) {
  const m = new T.MeshStandardMaterial({
    name: `Render sample / ${kind} / ${final ? (albedo ? 'derived-basecolor' : 'authored-thin-petals') : 'raw-lit'}`,
    color: albedo ? new T.Color('white') : (raw.color?.clone() ?? new T.Color('white')), map: albedo ?? raw.map ?? null,
    vertexColors: albedo ? false : raw.vertexColors, side: raw.side, transparent: raw.transparent,
    opacity: raw.opacity, alphaTest: raw.alphaTest, depthWrite: raw.depthWrite,
    roughness: kind === 'house' ? .94 : .98, metalness: 0,
    aoMap: ao ?? null, aoMapIntensity: .68,
    normalMap: normal ?? null, normalScale: new T.Vector2(.7,.7),
  });
  m.toneMapped = true;
  if (final) {
    m.onBeforeCompile = shader => {
      shader.vertexShader='varying vec3 vSamplePoint,vSampleNormal;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSamplePoint=position;vSampleNormal=normal;');
      shader.fragmentShader='varying vec3 vSamplePoint,vSampleNormal;\n'+shader.fragmentShader;
      if(mask){shader.uniforms.sampleMaterialMask={value:mask};shader.fragmentShader='uniform sampler2D sampleMaterialMask;\n'+shader.fragmentShader;}
      const correction=kind==='house'?`
        // Only the exact original stone-foundation material group is migrated.
        // The retained F facade and B roof use complementary mask tests.
        vec3 transferStoneClass=texture2D(sampleMaterialMask,vMapUv).rgb;
        if(transferStoneClass.r>=.5 || transferStoneClass.g<.5)discard;
      `:kind==='wood'?`
        // Preserve real bark/moss contrast while calibrating its reflectance.
        diffuseColor.rgb*=1.45;
      `:`
        float sampleY=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb*=clamp(pow(max(sampleY,.018),-.42)*1.1,1.25,3.2);
      `;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+correction);
      if(kind==='petals'){
        shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_pars_fragment>',`#include <lights_physical_pars_fragment>
          // Thin-petal wrapped diffuse and rear transmission. Incident light
          // has already been multiplied by Three's actual shadow visibility.
          void samplePetalDirect(const in IncidentLight light,const in vec3 p,const in vec3 n,const in vec3 v,const in vec3 cn,const in PhysicalMaterial material,inout ReflectedLight reflected){
            RE_Direct_Physical(light,p,n,v,cn,material,reflected);
            float ndl=dot(n,light.direction);
            float extra=max(0.,(ndl+.4)/1.4)-max(0.,ndl)+.22*max(0.,-ndl);
            reflected.directDiffuse+=light.color*max(0.,extra)*BRDF_Lambert(material.diffuseColor);
          }
          #undef RE_Direct
          #define RE_Direct samplePetalDirect
        `);
      }
    };
    m.customProgramCacheKey = () => REVISION + '-v2-' + kind;
  }
  return m;
}

export async function install(ctx){
 const {world,assets,renderer,debug,signal,invalidate}=ctx;
 signal?.throwIfAborted();
 if(ACTIVE.has(world))throw Error('Light transfer already installed');
 if(!(ctx.rawPaintMaterials instanceof Map))throw Error('Light transfer needs rawPaintMaterials captured before adapters');
 const lights={sky:world.children.find(o=>o.isHemisphereLight),key:world.getObjectByName('R1 twilight key'),rim:world.getObjectByName('R1 twilight rim'),fill:world.getObjectByName('R1 twilight fill'),porch:world.getObjectByName('Astra cottage / outward porch light')};
 if(Object.values(lights).some(l=>!l))throw Error('Light transfer requires the F five-light rig');
 const house=assets.cottage.getObjectByName('cottage_painted_scene');
 if(!house?.isMesh)throw Error('Missing retained cottage');
 const previous=debug.lightTransfer,bindings=[],overlays=[],additions=[],textures=[],materials=new Set(),groundRecords=[];
 const savedLights=Object.values(lights).map(light=>[light,{
  color:light.color.clone(),intensity:light.intensity,position:light.position.clone(),groundColor:light.groundColor?.clone(),target:light.target?.position.clone(),castShadow:light.castShadow,distance:light.distance,
  shadow:light.shadow?{intensity:light.shadow.intensity,normalBias:light.shadow.normalBias,bias:light.shadow.bias,radius:light.shadow.radius,mapSize:light.shadow.mapSize.clone(),camera:{near:light.shadow.camera.near,far:light.shadow.camera.far,...(light.shadow.camera.isOrthographicCamera?{left:light.shadow.camera.left,right:light.shadow.camera.right,top:light.shadow.camera.top,bottom:light.shadow.camera.bottom}:{})}}:null,
 }]);
 let disposed=false,enabled=false,api;
 ACTIVE.add(world);
 const refresh=()=>{world.updateMatrixWorld(true);renderer.shadowMap.needsUpdate=true;debug.refreshShadows?.();invalidate?.();};
 function restoreLights(){for(const [light,state]of savedLights){light.color.copy(state.color);light.intensity=state.intensity;light.position.copy(state.position);light.castShadow=state.castShadow;if(state.groundColor)light.groundColor.copy(state.groundColor);if(state.target)light.target.position.copy(state.target);if(state.distance!==undefined)light.distance=state.distance;if(state.shadow){const s=state.shadow;Object.assign(light.shadow,{intensity:s.intensity,normalBias:s.normalBias,bias:s.bias,radius:s.radius});light.shadow.mapSize.copy(s.mapSize);light.shadow.map?.setSize(s.mapSize.x,s.mapSize.y);Object.assign(light.shadow.camera,s.camera);light.shadow.camera.updateProjectionMatrix();}}}
 function applyLights(){
  lights.sky.color.set('#9caedc');lights.sky.groundColor.set('#384258');lights.sky.intensity=.90;
  lights.key.color.set('#ffd3a2');lights.key.intensity=3.1;lights.key.position.set(-26,19,7);lights.key.target.position.set(-1,11,-2);
  Object.assign(lights.key.shadow,{intensity:.86,normalBias:.035,bias:-.00001,radius:2});lights.key.shadow.mapSize.set(2048,2048);lights.key.shadow.map?.setSize(2048,2048);Object.assign(lights.key.shadow.camera,{left:-10,right:10,top:10,bottom:-10});lights.key.shadow.camera.updateProjectionMatrix();
  lights.rim.color.set('#ffc79b');lights.rim.intensity=.85;lights.rim.position.set(-25,17,-10);
  lights.fill.color.set('#a6baf2');lights.fill.intensity=.60;
  lights.porch.intensity=11;lights.porch.castShadow=true;lights.porch.shadow.mapSize.set(1024,1024);lights.porch.shadow.map?.setSize(1024,1024);Object.assign(lights.porch.shadow,{bias:-.00005,normalBias:.012,intensity:.88});
 }
 function setEnabled(value){
  if(disposed)return inspect();enabled=!!value;restoreLights();if(enabled)applyLights();
  for(const b of bindings){b.mesh.material=enabled?b.material:b.source;b.mesh.receiveShadow=enabled?b.receive:b.originalReceive;}
  for(const m of overlays)m.visible=enabled;
  for(const o of additions)if(o.isLight){o.visible=enabled;o.castShadow=enabled;}
  refresh();return inspect();
 }
 function inspect(){return {revision:REVISION,enabled,bindings:bindings.map(b=>({name:b.mesh.name,material:b.mesh.material.type,receiveShadow:b.mesh.receiveShadow})),ground:groundRecords.map(r=>({kind:r.kind,compiles:r.compiles,wrap:r.wrap,window:r.window,windPreserved:r.windPreserved})),roof:{fixedBakedLighting:true,response:'B retained R8 roof'},facade:{response:'F original complete material chain',preserved:'door, plaster walls and other non-stone non-roof parts'},extraColorDraws:enabled?overlays.length:0,extraGeometryBuffers:0,addedLights:2,exposure:renderer.toneMappingExposure,preservation:{terrain:true,hydrology:true,pathDetail:true,plantInstances:true,waterMaterial:true,emitterArray:true,windClock:true,fog:true,exposure:true},limitations:'Roof and retained F facade remain fixed baked-response materials, not true PBR. B Standard trunk/petals/stone receive real direct lights and cached shadows. Two finite window spotlights; no GI. Shared global lights also affect retained F water, but its shader, normals, reflections, geometry and clock are unchanged.'};}
 function dispose(){
  if(disposed)return;setEnabled(false);disposed=true;signal?.removeEventListener('abort',dispose);
  for(const m of overlays)m.removeFromParent();for(const o of additions){o.removeFromParent();o.dispose?.();}
  for(const m of materials)m.dispose();for(const t of textures)t.dispose();
  if(debug.lightTransfer===api){if(previous===undefined)delete debug.lightTransfer;else debug.lightTransfer=previous;}
  ACTIVE.delete(world);refresh();
 }
 function clone(source,tag,patch){const material=source.clone(),compile=source.onBeforeCompile,key=source.customProgramCacheKey();materials.add(material);if(source.userData.ecosystemWind)material.userData.ecosystemWind=source.userData.ecosystemWind;if(Object.hasOwn(source,'onBeforeRender'))material.onBeforeRender=source.onBeforeRender;material.name=source.name+' / '+tag;material.customProgramCacheKey=()=>key+'|'+REVISION+'|'+tag;material.onBeforeCompile=function(shader,r){compile.call(source,shader,r);patch(shader);};return material;}
 function bind(mesh,material,receive=mesh.receiveShadow){bindings.push({mesh,source:mesh.material,material,receive,originalReceive:mesh.receiveShadow});}
 function maskMaterial(source,mask,tag,condition,values={}){return clone(source,tag,s=>{s.uniforms.transferMask={value:mask};s.fragmentShader='uniform sampler2D transferMask;\n'+s.fragmentShader;for(const [name,value]of Object.entries(values)){if(!s.uniforms[name])throw Error('Missing retained roof uniform '+name);s.uniforms[name]={value:value?.clone?value.clone():value};}const anchor='#include <alphatest_fragment>';if(s.fragmentShader.split(anchor).length!==2)throw Error('Transfer mask shader anchor changed');s.fragmentShader=s.fragmentShader.replace(anchor,anchor+'\nvec3 transferClass=texture2D(transferMask,vMapUv).rgb;\nif('+condition+')discard;');});}
 function overlay(source,material,name,receive){const mesh=source.clone(false);mesh.name=name;mesh.material=material;mesh.castShadow=false;mesh.customDepthMaterial=undefined;mesh.customDistanceMaterial=undefined;mesh.receiveShadow=receive;mesh.visible=false;source.parent.add(mesh);overlays.push(mesh);return mesh;}
 try{
  const loader=new T.TextureLoader(),ids=['cottage-basecolor','cottage-ao','cottage-material-mask','trunk-basecolor','trunk-ao','trunk-normal'];
  const loaded=await Promise.allSettled(ids.map(async id=>{const t=await loader.loadAsync(new URL('./derived-albedo/'+id+'.png',import.meta.url).href);textures.push(t);t.flipY=false;t.channel=0;t.colorSpace=id.endsWith('basecolor')?T.SRGBColorSpace:T.NoColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}));
  const failed=loaded.find(r=>r.status==='rejected');if(failed)throw failed.reason;signal?.throwIfAborted();
  const maps=Object.fromEntries(ids.map((id,i)=>[id,loaded[i].value]));
  // R8 and R9 E share the house shader. Capture B's original R8 response values
  // in the same cottage-local coordinates, without mutating the live F rig.
  world.updateMatrixWorld(true);
  const roofRig=Object.fromEntries(Object.entries(lights).map(([id,l])=>{const p=R8_LIGHTING[id==='sky'?'hemisphere':id];return [id,{color:new T.Color(p.color??p.sky),intensity:p.intensity,target:l.target,getWorldPosition:v=>l.getWorldPosition(v)}];}));
  const roofValues=houseUniforms(roofRig,assets.cottage),mask=maps['cottage-material-mask'];
  const facade=maskMaterial(house.material,mask,'retained F warm door and walls','transferClass.r>=.5 || transferClass.g>=.5');bind(house,facade,false);
  const roof=maskMaterial(house.material,mask,'B fixed baked roof','transferClass.r<.5',roofValues);overlay(house,roof,'Light transfer / B retained roof',false);
  const rawHouse=ctx.rawPaintMaterials.get(house)??ctx.rawPaintMaterials.get(house.name);if(!rawHouse)throw Error('Missing raw cottage material');
  const stone=litMaterial(rawHouse,'house',true,maps['cottage-basecolor'],maps['cottage-ao'],mask,null);materials.add(stone);overlay(house,stone,'Light transfer / B stone foundation',true);
  for(const [name,kind]of [['blossom_painted_scene','wood'],['blossom_painted_petals','petals']]){const mesh=assets.tree.getObjectByName(name),raw=ctx.rawPaintMaterials.get(mesh)??ctx.rawPaintMaterials.get(name);if(!mesh?.isMesh||!raw)throw Error('Missing raw tree material '+name);const material=litMaterial(raw,kind,true,kind==='wood'?maps['trunk-basecolor']:null,kind==='wood'?maps['trunk-ao']:null,null,kind==='wood'?maps['trunk-normal']:null);materials.add(material);bind(mesh,material,true);}
  // Traverse the final world so F's extra grass/flower/stone instances share
  // precisely the same response as their A sources, without new clocks.
  const groundCache=new Map();
  const keyDirection=new T.Vector3(-26,19,7).sub(new T.Vector3(-1,11,-2)).normalize();
  world.traverse(mesh=>{const source=mesh.material;if(!mesh.isMesh||!source?.userData.r6Ground)return;let material=groundCache.get(source);if(!material){const record={kind:source.userData.r6Ground.kind,compiles:0};groundRecords.push(record);material=clone(source,'B light on F '+record.kind,s=>{const wind=s.uniforms.ecosystemTime;if(s.uniforms.r9DiffuseWrapGain)s.uniforms.r9DiffuseWrapGain={value:0};if(s.uniforms.r6WindowGain)s.uniforms.r6WindowGain={value:.10};if(s.uniforms.r6Key)s.uniforms.r6Key={value:keyDirection.clone()};record.compiles++;record.wrap=s.uniforms.r9DiffuseWrapGain?.value??null;record.window=s.uniforms.r6WindowGain?.value??null;record.windPreserved=wind===s.uniforms.ecosystemTime;});groundCache.set(source,material);}bind(mesh,material);});
  for(const [x,y]of [[-1.06,1.25],[1.05,1.28]]){const light=new T.SpotLight('#ffc783',7,2.8,1.05,.85,2);light.name='Light transfer / B finite warm window';light.position.set(x,y,1.78);light.target.position.set(x,y-.65,1.38);light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.camera.near=.06;light.shadow.camera.far=3;Object.assign(light.shadow,{bias:-.00005,normalBias:.008,intensity:.85});assets.cottage.add(light,light.target);additions.push(light,light.target);}
  api={inspect,setEnabled,dispose};debug.lightTransfer=api;setEnabled(true);signal?.addEventListener('abort',dispose,{once:true});return {dispose};
 }catch(error){dispose();throw error;}
}
