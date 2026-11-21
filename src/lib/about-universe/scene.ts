import { Application, Container, Graphics, Matrix, Rectangle, Sprite, Texture } from 'pixi.js';
import { cameraAt, project, smooth, clamp } from './camera';
import { cassiopeia, celestialNodes, distantBodies, paintedStars, skyWhispers } from './entities';
import type { ArtStar } from './art-stars';
import backgrounds from './backgrounds.json';
import { nextMeteor } from './meteor';
import { passageSky } from './passage-sky';
import { createOrbitPlanet } from './orbit-planet';
export interface UniverseScene {
  setProgress(value: number, depth?:number, departure?:number): void; setEntryZoom(value: number): void;
  setAmbient(value: boolean): void; setStory(value: number, nodeId?: string): void;
  suspend(value: boolean): void; destroy(): void;
}
interface Star { sprite: Sprite; x: number; y: number; z: number; radius: number; phase: number; painted: boolean; detail?: boolean; response: number }
function randomSource(seed = 7319) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  draw(canvas.getContext('2d')!); return Texture.from(canvas);
}
async function imageTexture(url: string, mipmaps = false, prepareBitmap=false) {
  const image = new Image(); image.src = url; await image.decode();
  const bitmap=prepareBitmap&&typeof createImageBitmap==='function'
    ? await createImageBitmap(image,{premultiplyAlpha:'premultiply'}).catch(()=>null) : null;
  const texture = Texture.from(bitmap??image);
  if(bitmap)texture.source.once('destroy',()=>bitmap.close());
  texture.source.scaleMode = 'linear'; texture.source.autoGenerateMipmaps = mipmaps;
  return texture;
}
interface BreathFrame {
  left:number; top:number; w:number; h:number; l:number; t:number;
  period:number; phase:number; flow:boolean;
}
interface SkyData {width:number; height:number; frames:BreathFrame[]; stars:ArtStar[]}
async function loadBreath(skyUrl:string, phase:string, quality:string, signal:AbortSignal) {
  const base=new URL(skyUrl,location.href);
  const data=await fetch(new URL(phase+'-'+quality+'.json',base),{signal});
  if(!data.ok)throw Error('Missing sky data');
  const layout:SkyData=await data.json();
  const atlas=await imageTexture(new URL(phase+'-breath.webp',base).href,false,true);
  if(signal.aborted){atlas.destroy(true);return null;}
  return {layout,atlas};
}
type Breath = Awaited<ReturnType<typeof loadBreath>>;

export async function createScene(root: HTMLElement, signal: AbortSignal, quiet:()=>Promise<void>): Promise<UniverseScene> {
  const host = root.querySelector<HTMLElement>('[data-universe-canvas]')!;
  const stageElement = root.querySelector<HTMLElement>('.universe-stage')!;
  const coarsePointer = matchMedia('(pointer: coarse)').matches;
  const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
  const lowPower = coarsePointer || navigator.hardwareConcurrency <= 4 || saveData;
  const app = new Application();
  await app.init({ resizeTo: host, preference: ['webgl'], background: '#050817', backgroundAlpha: 1,
    antialias: !lowPower, resolution: Math.min(devicePixelRatio || 1, lowPower ? 1.25 : 2,
      Math.sqrt(8_000_000 / Math.max(1, host.clientWidth * host.clientHeight))),
    autoDensity: true, autoStart: false, powerPreference: 'low-power', sharedTicker: false });
  if (signal.aborted) { app.destroy(true, { children: true }); throw new DOMException('Aborted', 'AbortError'); }
  // Match texture limits and avoid the full desktop texture on low-power devices.
  const gl = (app.renderer as typeof app.renderer & { gl?: WebGLRenderingContext }).gl;
  const textureLimit = gl ? Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) : 4096;
  const quality = !lowPower && textureLimit >= backgrounds.output.width ? 'full'
    : textureLimit >= backgrounds.preview.width ? 'preview' : 'fallback';
  const skyUrl = quality === 'full' ? root.dataset.sky!
    : quality === 'preview' ? root.dataset.skyPreview! : root.dataset.skyFallback!;
  const detailUrl = quality === 'full' ? root.dataset.skyDetailSrc!
    : quality === 'preview' ? root.dataset.skyDetailPreview! : root.dataset.skyDetailFallback!;
  const mipmaps = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  const heroData=loadBreath(skyUrl,'hero',quality,signal).catch(()=>null);
  let textures: Texture[];
  try { textures = await Promise.all([imageTexture(skyUrl, mipmaps), imageTexture(root.dataset.moon!), imageTexture(root.dataset.cloud!)]); }
  catch (error) { void heroData.then(data=>data?.atlas.destroy(true)); app.destroy(true, { children: true }); throw error; }
  // Theme failures are independent: a missing illustration never hides the other world.
  const hero=await heroData;
  const planetAssets = await Promise.all(celestialNodes.map(node => {
    const url=root.querySelector<HTMLButtonElement>('[data-node="'+node.id+'"]')?.dataset.planetSrc;
    return url ? imageTexture(url).catch(() => null) : null;
  }));
  await quiet();
  if (signal.aborted) { hero?.atlas.destroy(true); planetAssets.forEach(texture=>texture?.destroy(true)); textures.forEach(t => t.destroy(true)); app.destroy(true, { children: true }); throw new DOMException('Aborted', 'AbortError'); }
  root.dataset.skyTextureWidth = String(textures[0].width);
  // This scene also renders on scroll and on demand while paused. Avoid two renders per ticker frame.
  app.ticker.remove(app.render, app);
  host.append(app.canvas);
  app.canvas.setAttribute('aria-hidden', 'true');
  app.ticker.maxFPS = lowPower ? 30 : 45;
  const rng = randomSource();
  const world = new Container(), story = new Container();
  const innerWorld=new Container(),nearOrbit=new Container();
  app.stage.addChild(world,innerWorld,nearOrbit,story);
  let innerSky:Sprite|null=null,orbit:ReturnType<typeof createOrbitPlanet>|null=null;
  const orbitBack=new Graphics(),orbitFront=new Graphics();nearOrbit.addChild(orbitBack,orbitFront);
  let innerRequested=false,innerFade=0,innerFrameAt=0;
  root.dataset.innerSkyStatus='waiting';
  function requestInner(){
    if(innerRequested)return;innerRequested=true;root.dataset.innerSkyStatus='loading';
    const url=lowPower?root.dataset.innerSkySmall:root.dataset.innerSky;
    void imageTexture(url!,mipmaps).then(texture=>{
      if(destroyed||signal.aborted){texture.destroy(true);return;}
      innerSky=new Sprite(texture);innerSky.anchor.set(.5);innerWorld.addChildAt(innerSky,0);
      innerFrameAt=performance.now();root.dataset.innerSkyStatus='ready';syncTicker();
    }).catch(()=>{if(!destroyed)root.dataset.innerSkyStatus='unavailable';});
    void imageTexture(root.dataset.orbitArt!).then(texture=>{
      if(destroyed||signal.aborted){texture.destroy(true);return;}
      orbit=createOrbitPlanet(texture);nearOrbit.addChildAt(orbit.mesh,1);syncTicker();
    }).catch(()=>{/* Retain the original small world if the optional artwork cannot load. */});
  }
  const sky = new Sprite(textures[0]); sky.anchor.set(0.5); world.addChild(sky);
  let deepSky: Sprite | null = null, detailRequested = false, detailFade = 0, detailFrameAt = 0;
  root.dataset.skyDetail = 'waiting';
  root.dataset.skyQuality = quality;
  function requestDetail() {
    if (detailRequested || !detailUrl) return;
    detailRequested = true; root.dataset.skyDetail = 'loading';
    void Promise.all([imageTexture(detailUrl,mipmaps,true), loadBreath(detailUrl,'deep',quality,signal).catch(()=>null)]).then(async ([texture,breath]) => {
      // Upload the two decoded sources on separate paint opportunities.
      for(const source of [texture,breath?.atlas]){
        if(!source||destroyed||signal.aborted)break;
        app.renderer.texture.initSource(source.source);
        await new Promise<void>(resolve=>setTimeout(resolve,18));
      }
      if (destroyed || signal.aborted) { texture.destroy(true); breath?.atlas.destroy(true); return; }
      deepSky = new Sprite(texture); deepSky.anchor.set(0.5); deepSky.alpha = 0;
      world.addChildAt(deepSky, 1); detailFrameAt = performance.now();
      for (const source of starList(breath)) {
        const transform = backgrounds.deep.transform;
        const sprite = new Sprite(glowTexture); sprite.anchor.set(0.5); sprite.blendMode = 'add';
        world.addChildAt(sprite, world.getChildIndex(constellation));
        stars.push({ sprite, x: transform.a * source.x + transform.c * source.y + transform.tx,
          y: transform.b * source.x + transform.d * source.y + transform.ty, z: 6000,
          radius: source.radius, phase: rng() * Math.PI * 2, painted: true, detail: true, response: 0 });
      }
      const detailNebulae=createNebulae(breath,true);
      detailNebulae.forEach(region=>world.setChildIndex(region.sprite,world.getChildIndex(shade)));
      nebulae.push(...detailNebulae);
      root.dataset.skyDetail = 'ready';
      root.dataset.skyDetailWidth = String(texture.width);
      syncTicker();
    }).catch(() => { if (!destroyed) root.dataset.skyDetail = 'unavailable'; });
  }
  // Breathing follows the approved painting; the closer plate supplies its own clouds.
  function starList(breath:Breath) {
    return breath?.layout.stars.slice(0,lowPower?140:260) ?? paintedStars.map(([x,y])=>({x,y,radius:2}));
  }
  function createNebulae(breath:Breath,detail=false) {
    if(!breath)return [];
    const {layout,atlas}=breath;
    return layout.frames.map(({left,top,w,h,l,t,period,phase,flow})=>{
      const tile=new Texture({source:atlas.source,frame:new Rectangle(left,top,w,h),
        orig:new Rectangle(0,0,layout.width,layout.height),trim:new Rectangle(l,t,w,h)});
      const sprite=new Sprite(tile);sprite.anchor.set(.5);sprite.blendMode='add';
      world.addChild(sprite);return {period,phase,flow,sprite,detail};
    });
  }
  const nebulae=createNebulae(hero);
  const shade = new Graphics(); world.addChild(shade);
  const glowTexture = canvasTexture(64, ctx => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, '#fff9e8'); g.addColorStop(0.055, '#ffe8c0'); g.addColorStop(0.14, '#f5dabaaa');
    g.addColorStop(0.4, '#beb8ff24'); g.addColorStop(1, '#b6aaff00');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  });
  const artStars = starList(hero);
  const stars: Star[] = [];
  for (let i = 0; i < artStars.length + (lowPower ? 64 : 150); i++) {
    const painted = i < artStars.length;
    const sprite = new Sprite(glowTexture);
    sprite.anchor.set(0.5);
    if (painted) sprite.blendMode = 'add';
    world.addChild(sprite);
    const source = painted ? artStars[i] : { x: rng(), y: rng(), radius: 0.8 + rng() * 1.2 };
    stars.push({ sprite, x: source.x, y: source.y, z: painted ? 6000 : 2800 + rng() * 6000,
      radius: source.radius, phase: rng() * Math.PI * 2, painted, response: 0 });
  }
  const innerStars=Array.from({length:lowPower?42:110},()=>{
    const sprite=new Sprite(glowTexture);sprite.anchor.set(.5);sprite.blendMode='add';innerWorld.addChild(sprite);
    return {sprite,x:rng(),y:rng(),distance:.5+rng(),phase:rng()*Math.PI*2,radius:.5+rng()*.7};
  });
  root.dataset.interactiveStars = String(artStars.length);
  const constellation = new Container();
  const line = new Graphics();
  cassiopeia.forEach(([x,y], i) => i === 0 ? line.moveTo(x,y) : line.lineTo(x,y));
  line.stroke({ color: 0xe5d1b4, width: 0.7, alpha: 0.32 }); constellation.addChild(line);
  const constellationStars = cassiopeia.map(([x,y]) => {
    const star = new Sprite(glowTexture); star.anchor.set(0.5); star.position.set(x,y); star.width = star.height = 18; constellation.addChild(star);
    return star;
  });
  world.addChild(constellation);
  const moon = new Sprite(textures[1]); moon.anchor.set(0.5); world.addChild(moon);
  const cloud = new Sprite(textures[2]); cloud.anchor.set(0.5); cloud.alpha = 0.15; world.addChild(cloud);
  const planetTexture = canvasTexture(256, ctx => {
    const g = ctx.createRadialGradient(75, 62, 3, 148, 143, 147);
    g.addColorStop(0, '#f5d5a3'); g.addColorStop(0.27, '#c7a17d'); g.addColorStop(0.55, '#806275'); g.addColorStop(0.82, '#2d293e'); g.addColorStop(1, '#141526');
    ctx.beginPath(); ctx.arc(128,128,119,0,Math.PI*2); ctx.clip(); ctx.fillStyle=g; ctx.fillRect(0,0,256,256);
    for(let i=0;i<6500;i++) { const v=rng(); ctx.fillStyle=v>0.5?'rgba(255,225,189,.045)':'rgba(21,14,36,.08)'; ctx.fillRect(rng()*256,rng()*256,1+rng()*2,1); }
    for(let y=10;y<255;y+=5) { ctx.strokeStyle='rgba(238,196,158,.025)'; ctx.beginPath(); ctx.ellipse(130,y,150,8,-0.16,0,Math.PI*2); ctx.stroke(); }
  });
  // Small, subdued bodies give the camera depth without adding another bright starfield.
  const scenery = distantBodies.map(body => {
    const group = new Container();
    const glow = new Sprite(glowTexture);glow.anchor.set(0.5);glow.width=glow.height=body.radius*5;glow.alpha=0;glow.blendMode='add';group.addChild(glow);
    const planet = new Sprite(planetTexture);planet.anchor.set(0.5);
    planet.width=planet.height=body.radius*2;planet.tint=body.tint;group.addChild(planet);
    if(body.ring){
      const ring=new Graphics().ellipse(0,0,body.radius*1.7,body.radius*0.39)
        .stroke({color:0xbba8bd,width:0.65,alpha:0.5});
      ring.rotation=-0.29;group.addChild(ring);
    }
    world.addChild(group);return {body,group,glow};
  });
  const nodes = celestialNodes.map((node,index) => {
    const contentPlanetTexture=planetAssets[index] ?? planetTexture;
    const group = new Container();
    const halo = new Sprite(glowTexture); halo.anchor.set(0.5); halo.width = halo.height = node.radius * 8; halo.alpha=0.24; group.addChild(halo);
    const planet = new Sprite(contentPlanetTexture); planet.anchor.set(0.5); planet.width = planet.height = node.radius*2; group.addChild(planet);
    let ring:Graphics|null=null;
    if(node.kind==='scene') {
      ring = new Graphics().ellipse(0,0,node.radius*1.65,node.radius*0.42).stroke({color:0xddbb93,width:0.8,alpha:0.58});
      ring.rotation=-0.35; group.addChild(ring);
    }
    world.addChild(group);
    return { node, group, planet, halo, ring, illustrated:Boolean(planetAssets[index]), button: root.querySelector<HTMLButtonElement>('[data-node="'+node.id+'"]')! };
  });
  const readingSpots = [...skyWhispers,...distantBodies].map(spot=>{
    const region=root.querySelector<HTMLElement>('[data-whisper="'+spot.id+'"]')!;
    const glow=new Sprite(glowTexture);glow.anchor.set(0.5);glow.blendMode='add';glow.alpha=0;world.addChild(glow);
    return {spot,region,glow,response:0};
  });
  let activeReadingSpot:string|null=null;
  const meteors=Array.from({length:2},()=>{
    const trail=new Graphics(),head=new Sprite(glowTexture);
    head.anchor.set(0.5);head.blendMode='add';world.addChild(trail,head);
    return {trail,head,startedAt:-Infinity,path:nextMeteor(rng,0)};
  });
  const storyTexture = canvasTexture(1024, ctx => {
    ctx.fillStyle='#0b0a19'; ctx.fillRect(0,0,1024,1024);
    const g=ctx.createRadialGradient(790,590,0,720,580,680);
    g.addColorStop(0,'#614453'); g.addColorStop(0.3,'#342a44'); g.addColorStop(1,'#0a0b1b00'); ctx.fillStyle=g;ctx.fillRect(0,0,1024,1024);
    for(let i=0;i<600;i++) { ctx.globalAlpha=rng()*0.5;ctx.fillStyle='#ecdcc3';ctx.beginPath();ctx.arc(rng()*1024,rng()*1024,rng()>.99?1.3:0.6,0,Math.PI*2);ctx.fill(); } ctx.globalAlpha=1;
  });
  const storySky=new Sprite(storyTexture); story.addChild(storySky);
  const storyPlanet=new Sprite(nodes[1].planet.texture);storyPlanet.anchor.set(0.5);
  const storyRing=new Graphics();story.addChild(storyRing,storyPlanet);
  const storyFront=new Graphics();story.addChild(storyFront);
  let progress=0, depth=0, departure=0, entryZoom=1, storyAmount=0, elapsed=0, destroyed=false, suspended=false, inView=true;
  let selectedNode=celestialNodes[1].id;
  // Low-power desktops can still react to the pointer and render a scheduled meteor,
  // without running a permanent background ticker.
  let motionEnabled = !coarsePointer && !saveData;
  let ambient = motionEnabled && !lowPower;
  let pointerX = -1000, pointerY = -1000, lastPointer = -Infinity;
  let meteorTimer=0,meteorCount=0;
  const meteorHistory: Array<{at:number;dx:number;dy:number;tail:number}> = [];
  let lastRenderAt = performance.now();
  let width=0,height=0;
  root.dataset.ambient=String(motionEnabled); root.dataset.renderer='webgl';
  root.dataset.meteorCount = '0';
  const pointerStrength = (now: number) => motionEnabled
    ? clamp(1 - Math.max(0, now - lastPointer - 180) / 1650) : 0;
  const render=() => {
    if(destroyed) return;
    width=host.clientWidth; height=host.clientHeight;
    if(!width || !height) return;
    if(app.screen.width!==width || app.screen.height!==height) app.renderer.resize(width,height);
    const dive=smooth(depth),camera=cameraAt(progress,entryZoom*(1+dive*2.8));
    innerWorld.visible=depth>0;nearOrbit.visible=depth>0;
    const advance=smooth(departure);
    if(innerSky){
      innerFade=motionEnabled?Math.min(1,innerFade+Math.min(50,Math.max(0,performance.now()-innerFrameAt))/700):1;
      innerFrameAt=performance.now();
      const path=passageSky(width,height,departure);
      const scale=Math.max(width/innerSky.texture.width,height/innerSky.texture.height)*(1.08+dive*.14)*path.departureZoom;
      innerSky.scale.set(scale);innerSky.rotation=path.turn;innerSky.position.set(width*(.5+path.oldX)+(ambient?Math.sin(elapsed*.018)*width*.002:0),height*(.5+path.oldY));
      innerSky.alpha=smooth((depth-.14)/.49)*smooth(innerFade);
    }
    // The approved close painting remains usable if the optional third plate fails.
    const skyArrival=innerSky?.alpha??0;
    innerWorld.alpha=1-smooth(storyAmount);
    root.dataset.innerSkyBlend=skyArrival.toFixed(4);
    innerStars.forEach(star=>{
      const parallax=1/(1-advance*.44*star.distance);
      star.sprite.position.set(width*(.54+((star.x-.5)*(1+dive*.25*star.distance)-.04)*parallax),
        height*(.42+((star.y-.5)*(1+dive*.25*star.distance)+.08)*parallax));
      star.sprite.width=star.sprite.height=star.radius*6*Math.sqrt(parallax);
      star.sprite.alpha=smooth((depth-.2)/.5)*(.14+(ambient?(1+Math.sin(elapsed*.5+star.phase))*.075:.08));
    });
    const originalCamera=cameraAt(progress,entryZoom);
    const origin=project(distantBodies[1].position,originalCamera,width,height);
    const originDiameter=distantBodies[1].radius*2*origin.scale*(width<600?3.2:4.8);
    // Project the near planet past the left shoulder of the camera. Its angular
    // size grows with inverse depth until its entire ring clears the frustum.
    const distance=1-2.4*advance, perspective=1/Math.max(.055,distance);
    const baseX=origin.x+(width*(width<600?.19:.23)-origin.x)*dive;
    const baseY=origin.y+(height*(width<600?.73:.63)-origin.y)*dive;
    const orbitX=width*.54+(baseX-width*.54-width*(width<600?1.55:.50)*advance)*perspective;
    const orbitY=height*.42+(baseY-height*.42)*perspective;
    const orbitSize=(originDiameter+(Math.min(width*(width<600?.94:.45),height*.72)-originDiameter)*dive)*perspective;
    const orbitAlpha=smooth(depth/.2)*(1-smooth(storyAmount));
    nearOrbit.visible=depth>0&&distance>0&&orbitX+.86*orbitSize>0;
    nearOrbit.alpha=orbitAlpha;
    if(nearOrbit.visible){
      if(orbit){
        const orbitSprite=orbit.mesh;
        orbitSprite.position.set(orbitX,orbitY);orbitSprite.width=orbitSprite.height=orbitSize;orbitSprite.rotation=-.10;
        if(orbitAlpha>.001){const angle=orbit.update(elapsed);root.dataset.orbitRotation=angle.toFixed(5);}
      }
      orbitBack.clear().ellipse(0,0,orbitSize*.85,orbitSize*.20).stroke({color:0xcbb9b2,width:Math.max(.7,orbitSize*.0015),alpha:.36});
      orbitFront.clear();
      for(let i=0;i<=48;i++){
        const angle=i*Math.PI/48,x=Math.cos(angle)*orbitSize*.85,y=Math.sin(angle)*orbitSize*.20;
        if(i===0)orbitFront.moveTo(x,y);else orbitFront.lineTo(x,y);
      }
      orbitFront.stroke({color:0xd8c7b0,width:Math.max(.5,orbitSize*.0008),alpha:.30});
      for(const ring of [orbitBack,orbitFront]){ring.position.set(orbitX,orbitY);ring.rotation=-.29;}
    }
    root.dataset.nearOrbit=JSON.stringify({x:orbitX,y:orbitY,diameter:orbitSize,alpha:orbitAlpha,visible:nearOrbit.visible});
    const skyProjection=project({x:0,y:0,z:6000},camera,width,height);
    const cover=Math.max(width/textures[0].width,height/textures[0].height)*1.06;
    const driftX=ambient?Math.sin(elapsed*0.015)*width*0.0015:0;
    const driftY=ambient?Math.sin(elapsed*0.012)*height*0.001:0;
    sky.position.set(skyProjection.x+driftX,skyProjection.y+driftY);
    sky.scale.set(cover*skyProjection.scale*6);
    // Affine registration aligns the generated star anchors before blending.
    const transform = backgrounds.deep.transform;
    const detailNow = performance.now();
    if (deepSky) {
      // A first GPU upload can stall a frame: cap the fade advance so slow
      // devices still show the transition rather than spending it offscreen.
      detailFade = motionEnabled ? Math.min(1, detailFade + Math.min(50, Math.max(0, detailNow - detailFrameAt)) / 650) : 1;
      detailFrameAt = detailNow;
    }
    const detailBlend = deepSky ? smooth((progress - backgrounds.transition.start) /
      (backgrounds.transition.end - backgrounds.transition.start)) * smooth(detailFade) : 0;
    if (deepSky) {
      deepSky.setFromMatrix(new Matrix(
        transform.a * sky.width / deepSky.texture.width, transform.b * sky.height / deepSky.texture.width,
        transform.c * sky.width / deepSky.texture.height, transform.d * sky.height / deepSky.texture.height,
        sky.x + (transform.a / 2 + transform.c / 2 + transform.tx - 0.5) * sky.width,
        sky.y + (transform.b / 2 + transform.d / 2 + transform.ty - 0.5) * sky.height));
      deepSky.alpha = detailBlend;
    }
    root.dataset.skyDetailBlend = detailBlend.toFixed(4);
    root.dataset.skyStage = progress < 0.34 ? 'wide' : progress < 0.75 ? 'middle' : 'close';
    shade.clear().rect(0,0,width,height).fill({color:0x07091b,alpha:progress*0.08});
    const now=performance.now(), pointerDecay=pointerStrength(now);
    const delta = Math.min(0.1, Math.max(0, (now-lastRenderAt)/1000)); lastRenderAt=now;
    let nebulaBreath = 0;
    for (const region of nebulae) {
      const wave = ambient ? (1 + Math.cos(elapsed * Math.PI * 2 / region.period + region.phase)) / 2 : 0.5;
      const pulse = region.flow ? wave**3 : smooth(wave);
      const plate=region.detail?deepSky:sky;
      if(!plate)continue;
      const drift=ambient?Math.sin(elapsed*Math.PI*2/(region.period*1.7)+region.phase):0;
      region.sprite.position.set(plate.x+drift*width*(region.flow?0.0012:0.0025),plate.y+drift*height*0.002);
      region.sprite.width=plate.width*(1+drift*0.0015);region.sprite.height=plate.height*(1+drift*0.0015);
      region.sprite.rotation=plate.rotation;region.sprite.skew.copyFrom(plate.skew);
      region.sprite.alpha=(region.flow?0.08+pulse*0.48:0.10+pulse*0.25)*(region.detail?detailBlend:1-detailBlend);
      nebulaBreath += region.sprite.alpha;
    }
    root.dataset.nebulaBreath=nebulaBreath.toFixed(4);
    root.dataset.nebulaRegions=nebulae.map(region=>region.sprite.alpha.toFixed(4)).join(',');
    root.dataset.galaxyFlow=nebulae.filter(region=>region.flow&&!region.detail).map(region=>region.sprite.alpha.toFixed(4)).join(',');
    const hoverRadius = Math.min(185, Math.max(120, width * 0.08));
    let strongestPulse=0, affectedStars=0,twinkleLight=0;
    for(const star of stars) {
      let x:number,y:number;
      if(star.painted) {
        x=(star.x-0.5)*textures[0].width*cover/width*6;
        y=(star.y-0.5)*textures[0].height*cover/height*6;
      } else { x=(star.x-0.5)*star.z/1000*1.4;y=(star.y-0.5)*star.z/1000*1.5; }
      const p=project({x,y,z:star.z},camera,width,height);
      if(star.painted){p.x+=driftX;p.y+=driftY;}
      const proximity = pointerDecay * smooth(1 - Math.hypot(p.x-pointerX,p.y-pointerY) / hoverRadius);
      // Exponential attack/release is frame-rate independent and also follows scroll changes.
      const smoothing = 1 - Math.exp(-delta / (proximity > star.response ? 0.20 : 0.46));
      star.response += (proximity-star.response) * smoothing;
      if (star.response < 0.001) star.response=0;
      const response=star.response;
      strongestPulse=Math.max(strongestPulse,response);
      const layerOpacity = star.painted ? (star.detail ? detailBlend : 1 - detailBlend) : 1;
      if (star.painted && response > 0.12 && layerOpacity > 0.05) affectedStars++;
      // Independent long periods, with no mouse movement required; no synchronized flashing.
      const breathe=ambient?(1+Math.sin(elapsed*Math.PI*2/(4.5+star.phase*1.8)+star.phase))/2:0.35;
      const twinkle=star.phase<4.1?breathe*breathe:0;
      star.sprite.alpha = star.painted
        ? layerOpacity * clamp(0.014+twinkle*0.19+response*0.70)
        : clamp((0.24+0.16*smooth(progress/0.6))*(0.60+breathe*0.65+response*0.35));
      twinkleLight+=star.sprite.alpha;
      const size=star.radius*(star.z/(star.z-camera.z))*entryZoom*(1+response*0.65);
      star.sprite.width=star.sprite.height=size*(star.painted?7:6);
      star.sprite.position.set(p.x,p.y);
    }
    root.dataset.starTwinkle=twinkleLight.toFixed(4);
    root.dataset.depthStars=String(lowPower?64:150);
    root.dataset.starPulse=strongestPulse.toFixed(3);
    root.dataset.starAffected=String(affectedStars);
    root.dataset.hoverRadius=String(Math.round(hoverRadius));
    const moonP=project({x:width<600?0.66:0.62,y:width<600?-0.68:-0.49,z:2250},camera,width,height);
    moon.position.set(moonP.x,moonP.y);
    moon.width=moon.height=Math.min(width<600?76:110,height*0.13)*moonP.scale*2.25;
    moon.rotation=-0.16;
    moon.alpha=1-smooth((progress-0.30)/0.28);
    const constellationP=project({x:-0.75,y:-0.68,z:2700},camera,width,height);
    constellation.position.set(constellationP.x,constellationP.y);
    constellation.alpha=1-smooth((progress-0.45)/0.4);
    constellation.scale.set((width<600?0.44:0.77)*constellationP.scale*2.7);
    constellationStars.forEach((star,index)=>{
      const pulse=ambient?(1+Math.sin(elapsed*Math.PI*2/(5.2+index*0.8)+index*0.95))/2:0.55;
      star.alpha=0.42+smooth(pulse)*0.56;
      star.width=star.height=17+smooth(pulse)*5;
    });
    line.alpha=ambient?0.78+Math.sin(elapsed*Math.PI*2/11)*0.18:0.85;
    root.dataset.constellationLevels=constellationStars.map(star=>star.alpha.toFixed(4)).join(',');
    const cloudP=project({x:0.15+(ambient?Math.sin(elapsed*0.018)*0.025:0),y:0.79,z:2000},camera,width,height);
    cloud.alpha=0; // The painted plates supply their own clouds.
    cloud.position.set(cloudP.x,cloudP.y);cloud.width=width*1.4*cloudP.scale*2;cloud.height=height*0.4*cloudP.scale*2;
    for(const {body,group,glow} of scenery){
      const p=project(body.position,camera,width,height);
      group.position.set(p.x,p.y);group.scale.set(p.scale*(width<600?3.2:4.8));
      const response=readingSpots.find(item=>item.spot.id===body.id)?.response ?? 0;
      group.alpha=body.opacity*(0.75+0.25*smooth(progress/0.6))*(1+response*0.45);
      if(body.id==='far-orbit')group.alpha*=1-smooth(depth/.2);
      glow.alpha=response*0.35;
    }
    for(const {node,group,planet,halo,ring,button} of nodes) {
      const p=project(node.position,camera,width,height);
      // One world-space identity, visible from the first frame through the final planet.
      const nodeX=width<600?Math.min(width-39,p.x):p.x;
      group.position.set(nodeX,p.y);group.scale.set(p.scale*3.5);group.alpha=1;
      const growth=smooth(progress),diameter=1.7+(node.radius*2*group.scale.x-1.7)*growth;
      planet.width=planet.height=diameter/group.scale.x;
      planet.alpha=smooth(progress/0.30);
      halo.width=halo.height=26/group.scale.x*(1-growth)+node.radius*8*growth;
      halo.alpha=0.85*(1-growth)+0.24*growth;
      if(ring)ring.alpha=smooth((progress-0.12)/0.66);
      button.hidden=depth>0.16;button.style.left=nodeX+'px';button.style.top=p.y+'px';
      button.dataset.distant=String(progress<0.38);
      button.style.setProperty('--node-caption',String(smooth((progress-0.32)/0.55)));
      button.dataset.planetDiameter=diameter.toFixed(4);button.dataset.planetReveal=planet.alpha.toFixed(4);
    }
    for(const item of readingSpots){
      const {spot,region,glow}=item;
      const target=activeReadingSpot===spot.id?1:0;
      item.response+=(target-item.response)*(1-Math.exp(-delta/0.16));
      if(Math.abs(item.response-target)<0.005)item.response=target;
      let x:number,y:number;
      if('hero' in spot){
        const heroX=sky.x+(spot.hero.x-0.5)*sky.width,heroY=sky.y+(spot.hero.y-0.5)*sky.height;
        const deepX=transform.a*spot.deep.x+transform.c*spot.deep.y+transform.tx;
        const deepY=transform.b*spot.deep.x+transform.d*spot.deep.y+transform.ty;
        x=heroX+(sky.x+(deepX-0.5)*sky.width-heroX)*detailBlend;
        y=heroY+(sky.y+(deepY-0.5)*sky.height-heroY)*detailBlend;
      }else{
        const p=project(spot.position,camera,width,height);x=p.x;y=p.y;
      }
      if(spot.id==='far-orbit'&&depth>0){x=orbitX;y=orbitY;}
      region.hidden=(depth>.16&&spot.id!=='far-orbit')||x<22||x>width-22||y<22||y>height-22;
      region.style.left=x+'px';region.style.top=y+'px';
      glow.position.set(x,y);glow.width=glow.height=('hero' in spot?32:50)+item.response*18;
      glow.alpha=item.response*('hero' in spot?0.42:0.16);
    }
    let activeMeteors=0;
    for(const meteor of meteors){
      meteor.trail.clear();
      const path=meteor.path,age=(now-meteor.startedAt)/path.duration;
      const active=motionEnabled&&age>=0&&age<1;
      meteor.head.visible=active;
      if(!active)continue;
      activeMeteors++;
      const travelX=width*path.dx,travelY=height*path.dy;
      const x=width*path.x+age*travelX,y=height*path.y+age*travelY;
      const distance=Math.hypot(travelX,travelY),tail=Math.min(path.tail,width*0.14);
      const dx=-travelX/distance,dy=-travelY/distance,alpha=Math.sin(age*Math.PI)**0.65;
      for(let segment=0;segment<18;segment++){
        const near=segment/18,far=(segment+1)/18;
        meteor.trail.moveTo(x+dx*tail*near,y+dy*tail*near).lineTo(x+dx*tail*far,y+dy*tail*far)
          .stroke({color:path.tint,width:1.02*(1-near)+0.16,alpha:alpha*(1-near)**1.6*path.opacity});
      }
      meteor.head.position.set(x,y);meteor.head.width=meteor.head.height=8+path.opacity*5;
      meteor.head.alpha=alpha*path.opacity;
    }
    root.dataset.meteorActive=String(activeMeteors>0);root.dataset.meteorActiveCount=String(activeMeteors);
    world.alpha=1-smooth(storyAmount)*0.95;world.visible=skyArrival<.999;story.alpha=storyAmount>0?1:0;story.visible=storyAmount>0;
    root.dataset.planetZoom=storyAmount.toFixed(4);root.dataset.planetTarget=selectedNode;
    if(story.visible) {
      storySky.width=width;storySky.height=height;storySky.alpha=smooth(storyAmount)*0.94;
      const source=nodes.find(item=>item.node.id===selectedNode)!;
      storyPlanet.texture=source.planet.texture;
      root.dataset.planetArtwork=source.illustrated?source.node.asset:'procedural-fallback';
      const destinationX=width*(width<600?0.57:0.72),destinationY=height*(width<600?0.76:0.53);
      const diameter=Math.min(width*(width<600?0.98:0.50),height*0.84);
      const amount=smooth(storyAmount);
      const px=source.group.x+(destinationX-source.group.x)*amount,py=source.group.y+(destinationY-source.group.y)*amount;
      const initial=source.planet.width*source.group.scale.x;
      const size=initial+(diameter-initial)*amount;
      storyPlanet.position.set(px,py);storyPlanet.width=storyPlanet.height=size;
      storyRing.clear();storyFront.clear();
      if(source.node.kind==='scene'){
        storyRing.ellipse(0,0,size*0.82,size*0.23).stroke({color:0xc5a08b,width:1.3,alpha:0.52});
        storyFront.ellipse(0,0,size*0.85,size*0.24).stroke({color:0xead0b5,width:0.65,alpha:0.28});
      }
      for(const ring of [storyRing,storyFront]){ring.position.set(px,py);ring.rotation=-0.35;}
    }
    app.render();
  };
  const needsFrame = () => !suspended && !document.hidden && inView &&
    (ambient || readingSpots.some(item=>Math.abs(item.response-(activeReadingSpot===item.spot.id?1:0))>0.005) || pointerStrength(performance.now()) > 0 || stars.some(star => star.response > 0.001) ||
      (motionEnabled && meteors.some(m=>performance.now()-m.startedAt<m.path.duration)) ||
      (motionEnabled && deepSky !== null && detailFade < 1) ||
      (motionEnabled && innerSky !== null && innerFade < 1));
  const tick=() => {
    elapsed += Math.min(0.08, app.ticker.deltaMS / 1000);
    render();
    if (!needsFrame()) app.stop();
  };
  app.ticker.add(tick);
  const syncTicker=() => {
    if(needsFrame()) app.start(); else app.stop();
    render();
  };
  function scheduleMeteor(delay=1100) {
    clearTimeout(meteorTimer);
    if(!motionEnabled||suspended||!inView||document.hidden||destroyed)return;
    meteorTimer=window.setTimeout(()=>{
      const meteor=meteors.find(m=>performance.now()-m.startedAt>=m.path.duration);
      if(meteor){
        meteor.path=nextMeteor(rng,meteorCount);meteor.startedAt=performance.now();
        root.dataset.meteorCount=String(++meteorCount);root.dataset.meteorStyle=JSON.stringify(meteor.path);
        meteorHistory.push({at:meteor.startedAt,dx:meteor.path.dx,dy:meteor.path.dy,tail:meteor.path.tail});
        if(meteorHistory.length>12)meteorHistory.shift();root.dataset.meteorHistory=JSON.stringify(meteorHistory);
        syncTicker();
      }
      scheduleMeteor(1350+rng()*1500);
    },delay);
  }
  const onPointer=(event:PointerEvent) => {
    if(event.pointerType!=='mouse' || !motionEnabled || suspended) return;
    const rect=host.getBoundingClientRect();
    pointerX=event.clientX-rect.left;pointerY=event.clientY-rect.top;
    lastPointer=performance.now();
    if (!app.ticker.started) {lastRenderAt=performance.now();syncTicker();}
  };
  const onLeave=()=>{lastPointer=performance.now()-1200;syncTicker();};
  const onVisibility=()=>{
    meteors.forEach(m=>m.startedAt=-Infinity);
    scheduleMeteor();
    syncTicker();
  };
  root.addEventListener('universe-whisper-change',event=>{
    activeReadingSpot=(event as CustomEvent<string|null>).detail;
    lastRenderAt=performance.now();syncTicker();
  },{signal});
  stageElement.addEventListener('pointermove',onPointer,{passive:true,signal});
  stageElement.addEventListener('pointerenter',onPointer,{passive:true,signal});
  stageElement.addEventListener('pointerleave',onLeave,{signal});
  document.addEventListener('visibilitychange',onVisibility,{signal});
  const resize=new ResizeObserver(()=>render());resize.observe(host);
  const visibility=new IntersectionObserver(entries=>{
    inView=entries[0].isIntersecting;
    if(!inView)meteors.forEach(m=>m.startedAt=-Infinity);
    scheduleMeteor();syncTicker();
  });visibility.observe(stageElement);
  scheduleMeteor();
  syncTicker();
  // During the opening title, prepare the next sky before the reader moves.
  // Save-data devices retain scroll-triggered loading.
  const prepare=()=>{if(!destroyed&&!signal.aborted&&!document.hidden&&!saveData)requestDetail()};
  const idle=window.requestIdleCallback?.(prepare,{timeout:1000});
  if(idle!==undefined)signal.addEventListener('abort',()=>window.cancelIdleCallback(idle),{once:true});
  return {
    setProgress(value,inner=0,leaving=0){departure=leaving;progress=clamp(value);depth=clamp(inner);if(progress>.08)requestDetail();if(progress>.85)requestInner();render();},
    setEntryZoom(value){entryZoom=value;render();},
    setAmbient(value){
      motionEnabled=value;ambient=value;
      if (!value) {meteors.forEach(m=>m.startedAt=-Infinity);lastPointer=-Infinity;stars.forEach(star=>star.response=0);}
      root.dataset.ambient=String(value);scheduleMeteor();syncTicker();
    },
    setStory(value,nodeId){if(nodeId)selectedNode=nodeId;storyAmount=clamp(value);render();},
    suspend(value){suspended=value;meteors.forEach(m=>m.startedAt=-Infinity);scheduleMeteor();if(value)app.stop();else syncTicker();},
    destroy(){if(destroyed)return;destroyed=true;clearTimeout(meteorTimer);resize.disconnect();visibility.disconnect();app.stop();orbit?.dispose();app.destroy(true,{children:true,texture:true,textureSource:true});delete root.dataset.renderer;},
  };
}
