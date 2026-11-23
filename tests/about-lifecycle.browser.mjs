/** About regression checks against the built site. No production writes. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const output=resolve('.astro/about-acceptance');await mkdir(output,{recursive:true});
const root=resolve('dist'),basePath=process.env.ABOUT_BASE_PATH||'/';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!pathname.startsWith(basePath)){res.writeHead(404);return res.end();}
  const file=resolve(root,pathname.slice(basePath.length)+(pathname.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
  const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(body);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port+basePath;
const report={checks:[],errors:[],screenshots:[]};
const record=check=>{report.checks.push(check);console.log('PASS '+check.name)};
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',ignoreDefaultArgs:['--disable-back-forward-cache']});
async function context(options={}){
 const ctx=await browser.newContext({viewport:{width:1440,height:900},...options});
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 return {ctx,page};
}
const ready=page=>page.waitForSelector('[data-universe][data-enhanced="true"][data-entry="complete"]',{timeout:45000});
async function shot(page,name){await page.screenshot({path:resolve(output,name+'.png')});report.screenshots.push(name+'.png');}
async function scroll(page,screens){await page.evaluate(s=>scrollTo({top:innerHeight*s,behavior:'instant'}),screens);await page.waitForTimeout(150);}
async function stable(page){return page.evaluate(()=>{
 const r=document.querySelector('[data-universe]'),canvas=document.querySelector('[data-universe-canvas] canvas');
 return {height:r.offsetHeight,y:scrollY,enhanced:r.dataset.enhanced,progress:r.dataset.chapterProgress,canvas:!!canvas,open:!!document.querySelector('dialog[open]')};
});}
try{
 // Hold the heavy module: the page must show existing content throughout startup.
 {
  const {ctx,page}=await context();
  await page.addInitScript(()=>{
    window.__renderProbe={counts:[],current:0};
    for(const C of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
      if(!C)continue;const clear=C.prototype.clear;
      C.prototype.clear=function(...args){
        if(this.canvas.closest?.('[data-universe-canvas]'))window.__renderProbe.current++;
        return clear.apply(this,args);
      };
    }
    function frame(){const p=window.__renderProbe;p.counts.push(p.current);p.current=0;requestAnimationFrame(frame)}
    requestAnimationFrame(frame);
  });
  let release;const gate=new Promise(r=>release=r);
  await ctx.route(/\/_astro\/scene\.[^/]+\.js$/,async route=>{await gate;await route.continue();});
  await page.goto(base+'about/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('.universe-sky')?.complete);
  await page.waitForTimeout(900);
  assert.equal(await page.locator('[data-universe-curtain]').count(),0);
  const initial=await page.evaluate(()=>({
   title:getComputedStyle(document.querySelector('h1')).opacity,
   art:getComputedStyle(document.querySelector('.universe-art')).visibility,
   canvas:getComputedStyle(document.querySelector('.universe-canvas')).visibility,
   boot:document.documentElement.classList.contains('universe-boot')
  }));
  assert.deepEqual(initial,{title:'1',art:'visible',canvas:'hidden',boot:false});
  await shot(page,'desktop-loading');release();await ready(page);await shot(page,'desktop-ready');
  record({name:'cold load keeps artwork and text visible until the GPU is ready',initial});
  const cdp=await ctx.newCDPSession(page);await cdp.send('Performance.enable');
  const beforeMetrics=await cdp.send('Performance.getMetrics');
  const performanceResult=await page.evaluate(async()=>{
    window.__renderProbe.counts=[];
    for(let i=0;i<180;i++){
      await new Promise(requestAnimationFrame);scrollTo(0,i/179*innerHeight*3.4);
    }
    const counts=window.__renderProbe.counts;
    return {frames:counts.length,renders:counts.reduce((a,b)=>a+b,0),duplicateFrames:counts.filter(n=>n>1).length,
      canvas:[...document.querySelectorAll('[data-universe-canvas] canvas')].map(c=>[c.width,c.height])};
  });
  const afterMetrics=await cdp.send('Performance.getMetrics');
  performanceResult.metrics=Object.fromEntries(afterMetrics.metrics
    .filter(m=>['LayoutCount','LayoutDuration','RecalcStyleCount','ScriptDuration','TaskDuration'].includes(m.name))
    .map(m=>[m.name,m.value-beforeMetrics.metrics.find(n=>n.name===m.name).value]));
  assert.equal(performanceResult.duplicateFrames,0);
  record({name:'scroll and ambient animation submit at most one starfield draw per frame',performance:performanceResult});
  await scroll(page,2.1);
  await page.locator('[data-node="quiet-orbit"]').click();
  await page.waitForFunction(()=>document.querySelector('#universe-story').dataset.approaching==='false');
  const beforeDialog=await stable(page);
  await page.locator('#universe-story [data-dialog-close]').click();
  await page.waitForTimeout(800);
  const closed=await stable(page);assert.equal(closed.open,false);
  assert.equal(closed.y,beforeDialog.y);assert.equal(closed.height,beforeDialog.height);
  assert.equal(closed.progress,beforeDialog.progress);await shot(page,'dialog-return');
  const lifecycle=await page.evaluate(()=>{
   const r=document.querySelector('[data-universe]'),canvas=document.querySelector('canvas');
   const capture=()=>({y:scrollY,height:r.offsetHeight,enhanced:r.dataset.enhanced,art:getComputedStyle(document.querySelector('.universe-art')).visibility});
   const before=capture();dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
   const hidden=capture();dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
   return {before,hidden,sameCanvas:canvas===document.querySelector('canvas')};
  });
  assert.deepEqual(lifecycle.before,lifecycle.hidden);assert(lifecycle.sameCanvas);
  record({name:'dialog close and departure preserve scroll, artwork and layout',lifecycle});
  await scroll(page,0);await page.locator('[data-motion-toggle]').click();
  const paused=await page.locator('[data-motion-toggle]').getAttribute('aria-pressed');assert.equal(paused,'true');
  await ctx.close();
 }
 // A visitor may open a planet before the heavy scene module has downloaded.
 {
  const {ctx,page}=await context();let release;const gate=new Promise(r=>release=r);
  await ctx.route(/\/_astro\/scene\.[^/]+\.js$/,async route=>{await gate;await route.continue()});
  await page.goto(base+'about/',{waitUntil:'domcontentloaded'});
  await scroll(page,2.1);await page.locator('[data-node="quiet-orbit"]').click();
  await page.waitForSelector('#universe-story[open]');
  release();await ready(page);
  assert.equal(await page.locator('[data-universe]').getAttribute('data-planet-zoom'),'1.0000');
  await shot(page,'early-dialog-ready');await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  assert.equal(await page.locator('[data-universe]').getAttribute('data-planet-zoom'),'0.0000');
  record({name:'a dialog opened before GPU startup receives a complete first frame'});
  await ctx.close();
 }
 // Use an un-routed context: routing disables the browser history cache.
 {
  const {ctx,page}=await context();
  await page.addInitScript(()=>{window.__documentToken=Math.random();addEventListener('pageshow',e=>window.__restored=e.persisted)});
  await page.goto(base+'about/',{waitUntil:'domcontentloaded'});await ready(page);await scroll(page,2);
  const token=await page.evaluate(()=>window.__documentToken),before=await stable(page);
  await page.goto(base+'articles/',{waitUntil:'domcontentloaded'});
  await page.goBack({waitUntil:'commit'});await ready(page);await page.waitForTimeout(250);
  const after=await stable(page);
  assert.equal(after.y,before.y);assert.equal(after.height,before.height);
  const restored=await page.evaluate(()=>({restored:window.__restored,token:window.__documentToken}));
  assert(restored.restored,'Expected actual BFCache restoration');assert.equal(restored.token,token);
  record({name:'actual browser Back restores the same document and scroll position',restored:true});
  await ctx.close();
 }
 // Native navigation keeps the source visible while the destination is pending.
 {
  const {ctx,page}=await context();
  await page.goto(base+'articles/',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
    sessionStorage.removeItem('about-black-overlay');
    new MutationObserver(records=>{
      for(const record of records)for(const el of record.addedNodes){
        if(el instanceof HTMLElement&&el.style.position==='fixed'&&el.style.background==='rgb(0, 0, 0)')sessionStorage.setItem('about-black-overlay','true');
      }
    }).observe(document.body,{childList:true});
  });
  await page.locator('.site-header a[href="'+basePath+'about/"]').first().click();
  await ready(page);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('about-black-overlay')),null);
  record({name:'navigation to About adds no black overlay'});await ctx.close();
 }
 {
  const {ctx,page}=await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await page.goto(base+'about/',{waitUntil:'domcontentloaded'});await ready(page);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await shot(page,'mobile-ready');await scroll(page,2.2);await shot(page,'mobile-chapter');
  record({name:'mobile viewport loads and scrolls without horizontal overflow'});await ctx.close();
 }
 {
  const {ctx,page}=await context({reducedMotion:'reduce'});
  await page.goto(base+'about/',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-renderer="static"]');
  assert.equal(await page.locator('[data-universe-canvas] canvas').count(),0);
  await page.locator('[data-node="quiet-orbit"]').click();await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(),0);
  record({name:'reduced motion retains readable static artwork and working dialogs'});await ctx.close();
 }
 {
  const {ctx,page}=await context();
  await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args)}});
  await page.goto(base+'about/',{waitUntil:'domcontentloaded'});await page.waitForSelector('[data-renderer="static"]',{timeout:30000});
  assert.equal(await page.locator('.universe-art').evaluate(el=>getComputedStyle(el).visibility),'visible');
  assert.equal(await page.locator('h1').evaluate(el=>getComputedStyle(el).opacity),'1');
  record({name:'unavailable WebGL falls back to visible artwork'});await ctx.close();
 }
 {
  const {ctx,page}=await context();
  await page.goto(base+'about/#meadow',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-meadow][data-ready]',{timeout:90000});
  await shot(page,'meadow-ready');
  const state=await page.evaluate(()=>{
   const root=document.querySelector('[data-meadow]'),f=root.querySelector('iframe'),d=f.contentWindow.__integration;
   window.__meadowFrame=f;window.__meadowDebug=d;
   return {ready:d.ready,canvas:[d.renderer.domElement.width,d.renderer.domElement.height],geometries:d.renderer.info.memory.geometries,triangles:d.renderer.info.render.triangles};
  });
  await page.locator('[data-flight]').click();await page.waitForTimeout(2600);await shot(page,'meadow-close');
  await page.locator('[data-flight]').click();await page.waitForTimeout(150);
  const continuity=await page.evaluate(()=>{
   const root=document.querySelector('[data-meadow]'),f=root.querySelector('iframe'),d=f.contentWindow.__integration;
   const before={y:scrollY,height:document.querySelector('[data-universe]').offsetHeight,yaw:d.world.rotation.y};
   dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
   f.contentWindow.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
   const after={y:scrollY,height:document.querySelector('[data-universe]').offsetHeight,yaw:d.world.rotation.y};
   f.contentWindow.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
   dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
   return {before,after,sameFrame:f===root.querySelector('iframe'),disposed:!!d.disposed};
  });
  assert.deepEqual(continuity.before,continuity.after);assert(continuity.sameFrame);assert.equal(continuity.disposed,false);
  await page.goto(base+'articles/',{waitUntil:'domcontentloaded'});
  await page.goBack({waitUntil:'commit'});
  await page.waitForSelector('[data-meadow][data-ready]');
  assert(await page.evaluate(()=>window.__meadowFrame===document.querySelector('[data-meadow] iframe')&&window.__meadowDebug===window.__meadowFrame.contentWindow.__integration));
  await scroll(page,5.9);await shot(page,'meadow-passage');
  await scroll(page,0);await ready(page);await shot(page,'return-from-meadow');
  record({name:'meadow deep link, camera flight, history lifecycle and return to stars',state,continuity});await ctx.close();
 }
 assert.deepEqual(report.errors,[]);
 console.log(JSON.stringify(report,null,2));
}finally{
 await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2));
 await browser.close();await new Promise(r=>server.close(r));
}

