import {settings,uniforms} from './engine.js';
import * as T from 'three';
export const REVISION='studio-solar-1';
export const PARAMETERS=Object.freeze({key:3.18,sky:.93,fill:.38,sunColor:'#ffdab3',skyColor:'#a0a5d6',minimumSkyElevation:.43});
// AE's reference-normalized COMBINED shader retains authored tile cavities.
// This module supplies its actual sun direction and color, and the same light
// drives Standard foliage, stone and ground. It is not intrinsic albedo recovery.
export async function install(ctx){
  const {world,assets,renderer,debug,signal,invalidate}=ctx;
  signal?.throwIfAborted();
  const key=world.getObjectByName('R1 twilight key');
  const authored=debug.lightingLayer;
  if(!key||!authored?.updateLighting)throw Error('Evening needs installed AE authored transport');
  const materialRecords=[];
  for(const name of ['Light transfer / B retained roof','cottage_painted_scene']){
    const mesh=assets.cottage.getObjectByName(name),source=mesh.material,material=source.clone(),compile=source.onBeforeCompile,cacheKey=source.customProgramCacheKey();
    material.onBeforeCompile=(shader,r)=>{
      compile.call(source,shader,r);
      shader.fragmentShader=shader.fragmentShader
        .replaceAll('+.30)/1.30','+.52)/1.52')
        .replace('float aAmbient=.38','float aAmbient=.50')
        .replace('vec3 aFloor=vec3(.69,.82,1.)','vec3 aFloor=vec3(.78,.74,1.)');
      if(name==='cottage_painted_scene'){
        shader.uniforms.studyWindow=uniforms.studyWindow;
        shader.fragmentShader='uniform float studyWindow;\n'+shader.fragmentShader;
        // Diffuse window return on nearby painted stone and plaster. The
        // glass stays luminous and the far wall keeps its cool base value.
        const end='outgoingLight*=clamp(aResponse,vec3(.035),vec3(2.4));';
        shader.fragmentShader=shader.fragmentShader.replace(end,end+`
          float vesperWallTone=dot(outgoingLight,vec3(.2126,.7152,.0722));
          float localBounce=sqrt(clamp(r5spill,0.,1.))*smoothstep(.012,.09,vesperWallTone)*(1.-smoothstep(.40,.85,vesperWallTone));
          outgoingLight+=localBounce*sqrt(max(outgoingLight,vec3(0.)))*studyWindow*vec3(1.,.48,.17);`);
      }
    };
    material.customProgramCacheKey=()=>cacheKey+'|evening-sky-floor-1';mesh.material=material;materialRecords.push({mesh,source,material});
  }
  const inverseWorld=new T.Matrix4(),keyDirection=new T.Vector3();
  let disposed=false,revisionCount=0,lastSignature=null;
  const rig={sky:world.children.find(o=>o.isHemisphereLight),rim:world.getObjectByName('R1 twilight rim'),fill:world.getObjectByName('R1 twilight fill')};
  const saved=[key,...Object.values(rig)].map(l=>[l,{color:l.color.clone(),intensity:l.intensity,position:l.position.clone(),target:l.target?.position.clone(),groundColor:l.groundColor?.clone()}]);
  const upAxis=new T.Vector3(0,1,0);
  const direction=new T.Vector3(),worldDirection=new T.Vector3(),sunPosition=new T.Vector3(),center=new T.Vector3(),targetWorld=new T.Vector3();
  let mode='normal';
  const lastDirection=new T.Vector3(99,99,99),lastPosition=new T.Vector3(99,99,99),lastTarget=new T.Vector3(99,99,99);let lastPower=-1;
  rig.sky.color.set('#a0a5d6');rig.sky.groundColor.set('#474664');rig.sky.intensity=.93;
  rig.fill.color.set('#bdc6e8');rig.fill.intensity=.38;
  // A single sun: legacy warm rim is disabled rather than casting from a second sky position.
  rig.rim.intensity=0;
  key.color.set('#ffdab3');key.intensity=PARAMETERS.key;
  function setKey(value){if(!['normal','off','turned'].includes(value))throw Error('Unknown key mode');mode=value;updateLighting();invalidate?.();}
  function updateLighting(){
    if(disposed)return false;
    world.updateWorldMatrix(true,false);
    ctx.cosmic.group.updateWorldMatrix(true,false);
    world.getWorldPosition(center);
    ctx.cosmic.exports.nodes.sun.getWorldPosition(sunPosition);
    worldDirection.copy(sunPosition).sub(center).normalize();
    // A finite warm sky band above the visible disk's azimuth: the disk is
    // already below the planet horizon, so this represents dusk sky scatter.
    const h=Math.max(.0001,Math.hypot(worldDirection.x,worldDirection.z));
    const elevation=T.MathUtils.degToRad(settings.elevation);
    worldDirection.set(worldDirection.x/h*Math.cos(elevation),Math.sin(elevation),worldDirection.z/h*Math.cos(elevation));
    // The broad western light comes from the bright sky beside the low disk.
    worldDirection.applyAxisAngle(upAxis,(mode==='turned'?Math.PI:0)+T.MathUtils.degToRad(settings.angle));
    inverseWorld.copy(world.matrixWorld).invert();direction.copy(worldDirection).transformDirection(inverseWorld);keyDirection.copy(direction);
    // The directional source and its target share the planet parent; both are
    // converted from world coordinates, so orbiting the model cannot orbit the sun.
    targetWorld.set(0,9,0).applyMatrix4(world.matrixWorld);
    key.target.position.copy(targetWorld).applyMatrix4(inverseWorld);
    key.position.copy(targetWorld).addScaledVector(worldDirection,40).applyMatrix4(inverseWorld);
    key.intensity=mode==='off'?0:settings.key;
    if(lastDirection.distanceToSquared(direction)<1e-14&&lastPosition.distanceToSquared(key.position)<1e-14&&lastTarget.distanceToSquared(key.target.position)<1e-14&&lastPower===key.intensity)return false;
    lastDirection.copy(direction);lastPosition.copy(key.position);lastTarget.copy(key.target.position);lastPower=key.intensity;
    revisionCount++;key.updateWorldMatrix(true,false);key.target.updateWorldMatrix(true,false);renderer.shadowMap.needsUpdate=true;authored.updateLighting();return true;
  }
  function inspect(){return {revision:REVISION,mode,parameters:{...settings},direction:direction.toArray(),worldDirection:worldDirection.toArray(),sunWorld:sunPosition.toArray(),updates:revisionCount,house:authored.inspect(),houseSkyFloor:.50,tree:{wood:assets.tree.getObjectByName('blossom_painted_scene')?.material.type,petals:assets.tree.getObjectByName('blossom_painted_petals')?.material.type},lightInterpretation:'Adjustable world-space twilight direction and elevation',limits:'House uses retained normalized COMBINED appearance: painted crevices remain authored and house does not acquire new moving cast shadows. Standard tree/ground receive real directional light; no GI. Existing finite window spots retained.'};}
  function dispose(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);for(const [l,s]of saved){l.color.copy(s.color);l.intensity=s.intensity;l.position.copy(s.position);if(s.target)l.target.position.copy(s.target);if(s.groundColor)l.groundColor.copy(s.groundColor);}for(const {mesh,source,material}of materialRecords){if(mesh.material===material)mesh.material=source;material.dispose();}authored.updateLighting();renderer.shadowMap.needsUpdate=true;invalidate?.();if(debug.eveningLight===api)delete debug.eveningLight;}
  function apply(){
    key.color.set(settings.sun);rig.sky.color.set(settings.sky);rig.sky.groundColor.set(settings.under);
    rig.fill.color.set(settings.fill);rig.fill.intensity=settings.fillPower;rig.sky.intensity=settings.skyPower;
    const changed=updateLighting();if(!changed)authored.updateLighting();invalidate();return changed;
  }
  const api={apply,setKey,updateLighting,inspect,dispose,direction,worldDirection};debug.eveningLight=api;
  apply();signal?.addEventListener('abort',dispose,{once:true});return api;
}
