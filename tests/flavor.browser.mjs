/** Real local Edge/Chromium acceptance. Fixture photos/notes are explicitly synthetic and never shipped. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile,writeFile,mkdir,stat } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { chromium } from 'playwright';
import { LATE_GREETING } from '../src/lib/flavor-selection.mjs';
const evidence=resolve('docs/flavor-review'),screens=resolve(evidence,'screenshots');await mkdir(screens,{recursive:true});
const report={scope:'Real local Chromium, desktop/mobile viewport emulation; CDN response locally fulfilled with exact owner audio bytes (real HTTPS CDN accepted separately); synthetic photo metadata clearly labeled; no physical phone or owner photo acceptance',checks:[],pageErrors:[],screenshots:[]};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.wasm':'application/wasm','.json':'application/json','.svg':'image/svg+xml'};
// Each target needs its own origin: asset BASE_URL is absolute within the origin.
const servers=[];
for(const [target,port]of [['pages',19640],['vps',19641],['fixture-pages',19642],['fixture-vps',19643],['fixture-no-source',19644]]){
 const s=createServer(async(req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),base=target.endsWith('vps')?'/':'/tkkdyyy.github.io/';
   if(pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
   if(!pathname.startsWith(base)){res.writeHead(404);return res.end();}
   const root=resolve('.flavor-builds',target),file=resolve(root,pathname.slice(base.length)+(pathname.endsWith('/')?'index.html':''));
   if(!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
   const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(bytes);
  }catch{res.writeHead(404);res.end();}
 });await new Promise(r=>s.listen(port,'127.0.0.1',r));servers.push(s);
}
let browser;
const url=(target,path='')=>'http://127.0.0.1:'+({pages:19640,vps:19641,'fixture-pages':19642,'fixture-vps':19643,'fixture-no-source':19644}[target])+(target.endsWith('vps')?'/':'/tkkdyyy.github.io/')+path;
async function context(options={}){
 const c=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai',...options});
 // Avoid variable external font availability; screenshots use the site's existing fallback stack.
 await c.route('https://fonts.googleapis.com/**',r=>r.abort());await c.route('https://fonts.gstatic.com/**',r=>r.abort());
 await c.route('https://raw.githubusercontent.com/**/*.mp3',async route=>route.fulfill({status:200,contentType:'audio/mpeg',body:await readFile('media/music/angelika-vee-you-are-my-sunshine.mp3')}));
 const page=await c.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));return{c,page};
}
async function shot(page,name){await page.screenshot({path:resolve(screens,name+'.webp'),type:'webp',fullPage:false});report.screenshots.push(name+'.webp');}
async function ready(page){await page.waitForFunction(()=>{const root=document.querySelector('[data-window]');return !root||root.hidden||!root.querySelector('[data-window-next]').disabled;});}
async function overflow(page){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');}
try{
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
 // Real deliverable content: zero eligible photographs and no owner-confirmed recent notes.
 for(const target of ['pages','vps'])for(const width of [1440,1024,390,320]){
  const {c,page}=await context({viewport:{width,height:width<600?844:1000}});await page.goto(url(target));await overflow(page);
  assert.equal(await page.locator('[data-window]').count(),0);assert.equal(await page.locator('.recent-notes').count(),0);assert.equal(await page.getByText(LATE_GREETING,{exact:true}).count(),0);
  assert(await page.locator('.hero').count());assert(await page.locator('.projects').count());assert(await page.locator('.photography').count());await shot(page,`${target}-actual-home-${width}`);
  await page.goto(url(target,'images/'));await overflow(page);assert.equal(await page.locator('[data-window]').count(),0);await shot(page,`${target}-actual-images-${width}`);
  await page.goto(url(target,'about/'));await overflow(page);assert.equal(await page.locator('.music-card').count(),1);assert.equal(await page.locator('audio[autoplay]').count(),0);
  assert(await page.locator('audio').evaluate(a=>a.paused));assert.equal(await page.locator('audio').getAttribute('preload'),'none');await shot(page,`${target}-about-${width}`);await c.close();
 }
 report.checks.push('Pages project base and VPS root base: 1440/1024/390/320, actual 0-photo/empty-recent fallback, existing home/gallery/about routes and music card, no horizontal overflow.');
 // Fresh Chromium visits block audible autoplay; native controls provide the fallback.
 // Allowed entry/fade and pagehide are independently covered by flavor-music.browser.mjs.
 for(const target of ['pages','vps']){
  const {c,page}=await context();const media=[];page.on('request',r=>{if(r.url().endsWith('.mp3'))media.push(r.url());});await page.goto(url(target,'about/'));await page.waitForTimeout(300);assert.equal(media.length,0);
  const audio=page.locator('audio');await audio.click({position:{x:24,y:26}});await page.waitForFunction(()=>{const a=document.querySelector('audio');return !a.paused&&a.currentTime>0&&Number.isFinite(a.duration);});
  assert(media.length>0);assert.equal(await page.locator('[data-music-state]').innerText(),'正在播放');await shot(page,`${target}-music-playing`);
  const state=await audio.evaluate(a=>({duration:a.duration,time:a.currentTime,paused:a.paused}));report.checks.push({test:`${target}: fresh visit blocks autoplay; supplied MP3 decodes after fallback click; no listening-quality claim`,...state});
  await audio.click({position:{x:24,y:26}});await page.waitForFunction(()=>document.querySelector('audio').paused);assert.equal(await page.locator('[data-music-state]').innerText(),'已暂停');
  await page.goto(url(target));assert.equal(await page.locator('audio').count(),0);await c.close();
 }
 // Clearly synthetic full layouts, responsive aspect-ratio containment and original module order.
 for(const target of ['fixture-pages','fixture-vps'])for(const width of [1440,1024,390,320]){
  const {c,page}=await context({viewport:{width,height:width<600?844:1000}});await page.clock.setFixedTime(new Date('2026-11-02T04:00:00Z'));await page.goto(url(target));await ready(page);await overflow(page);
  assert(await page.locator('[data-window]').isVisible());assert.equal(await page.locator('[data-window-greeting]').isVisible(),false);
  const names=await page.locator('main>section').evaluateAll(nodes=>nodes.map(n=>n.className));assert(names[0].includes('life-window'));assert(names[1].includes('recent-notes'));assert(names[2].includes('hero'));assert.equal(await page.locator('.recent-notes dl>div').count(),3);
  const pool=await page.locator('[data-window]').evaluate(n=>JSON.parse(n.dataset.photos));assert.equal(pool.length,3);assert(pool.every(p=>!p.id.includes('missing')&&!p.id.includes('draft')&&!p.timeOfDay.includes('unknown-future-value')));
  await shot(page,`${target}-test-only-home-${width}`);await page.locator('.recent-notes').scrollIntoViewIfNeeded();await shot(page,`${target}-test-only-recent-${width}`);
  const first=await page.locator('[data-window-image]').getAttribute('src');await page.getByRole('button',{name:/换一张/}).click();await ready(page);const second=await page.locator('[data-window-image]').getAttribute('src');assert.notEqual(second,first);
  await page.reload();await ready(page);assert.equal(await page.locator('[data-window-image]').getAttribute('src'),second);
  await page.locator('[data-window-link]').last().click();assert(page.url().includes('/images/flavor-test-'));assert(await page.locator('.image-detail').count());
  await page.goto(url(target,'images/'));await ready(page);assert(await page.getByRole('region',{name:'此刻的照片',exact:true}).isVisible());await overflow(page);await shot(page,`${target}-test-only-gallery-${width}`);await c.close();
 }
 report.checks.push('Isolated 3-photo fixture: 2 deployment bases x 4 viewports; original section order retained; unknown tags ignored, draft/missing images excluded; swap avoids immediate repeat, reload persists selection, correct existing details and gallery linkage.');
 // Boundary checks use device-local time in two unrelated zones.
 for(const timezoneId of ['Asia/Shanghai','America/Los_Angeles']){
  for(const [utc,expected,label]of (timezoneId==='Asia/Shanghai'?[['2026-11-01T15:59:00Z',false,'2359'],['2026-11-01T16:00:00Z',true,'0000'],['2026-11-01T20:59:00Z',true,'0459'],['2026-11-01T21:00:00Z',false,'0500']]:[['2026-11-02T07:59:00Z',false,'2359'],['2026-11-02T08:00:00Z',true,'0000'],['2026-11-02T12:59:00Z',true,'0459'],['2026-11-02T13:00:00Z',false,'0500']])){
   const {c,page}=await context({timezoneId});await page.clock.setFixedTime(new Date(utc));await page.goto(url('fixture-pages'));await ready(page);assert.equal(await page.locator('[data-window-greeting]').isVisible(),expected);assert.equal(await page.locator('[data-window-greeting]').textContent(),LATE_GREETING);await shot(page,`boundary-${timezoneId.replace('/','-')}-${label}`);await c.close();
  }
 }
 report.checks.push('Exact 23:59/00:00/04:59/05:00 greeting boundary passes independently in Asia/Shanghai and America/Los_Angeles device timezones.');
 // Same open page crosses 05:00; only text changes, no timed photo rotation.
 {
  const {c,page}=await context();await page.clock.install({time:new Date('2026-11-01T20:59:50Z')});await page.goto(url('fixture-pages'));await ready(page);assert(await page.locator('[data-window-greeting]').isVisible());const src=await page.locator('[data-window-image]').getAttribute('src');await page.clock.runFor(20000);assert.equal(await page.locator('[data-window-greeting]').isVisible(),false);assert.equal(await page.locator('[data-window-image]').getAttribute('src'),src);await c.close();
 }
 for(const target of ['pages','fixture-pages','vps','fixture-vps']){
  const {c,page}=await context({javaScriptEnabled:false,viewport:{width:320,height:844}});await page.goto(url(target));await overflow(page);assert(await page.locator('.hero').count());
  if(target.startsWith('fixture')){assert(await page.locator('[data-window-image]').isVisible());assert.equal(await page.locator('[data-window-next]').isVisible(),false);assert.equal(await page.locator('[data-window-greeting]').isVisible(),false);}await shot(page,`${target}-no-js-320`);await c.close();
 }
 report.checks.push('No JS: basic home content and static photo/detail link remain usable; inactive swap and local-time greeting stay hidden; real empty library produces no photo frame or isolated greeting.');
 // One photo, blocked session storage, reduced motion and keyboard interaction.
 {
  const {c,page}=await context({reducedMotion:'reduce'});
  await page.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('storage disabled','SecurityError');}}));
  await page.route(url('fixture-pages'),async route=>{const response=await route.fetch();const text=await response.text();await route.fulfill({response,body:text.replace(/data-photos="([^"]*)"/,(_,encoded)=>{const pool=JSON.parse(encoded.replaceAll('&quot;','"').replaceAll('&amp;','&'));return 'data-photos="'+JSON.stringify(pool.slice(0,1)).replaceAll('&','&amp;').replaceAll('"','&quot;')+'"';})});});
  await page.goto(url('fixture-pages'));await ready(page);assert(await page.locator('[data-window-image]').isVisible());assert.equal(await page.locator('[data-window-next]').isVisible(),false);assert.equal(await page.locator('[data-window-image]').evaluate(i=>i.getAnimations().length),0);await shot(page,'single-photo-storage-denied-reduced-motion');await c.close();
 }
 {
  const {c,page}=await context({reducedMotion:'reduce'});await page.goto(url('fixture-vps'));await ready(page);const before=await page.locator('[data-window-image]').getAttribute('src');const button=page.getByRole('button',{name:/换一张/});await button.focus();await page.keyboard.press('Enter');await ready(page);assert.notEqual(await page.locator('[data-window-image]').getAttribute('src'),before);assert.equal(await page.locator('[data-window-image]').evaluate(i=>i.getAnimations().length),0);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'去影像 ↗');await shot(page,'keyboard-reduced-motion');await c.close();
 }
 // Browser-time lost resources hide the window and its greeting; a stale media URL cannot fake playback.
 {
  const {c,page}=await context();await page.clock.setFixedTime(new Date('2026-11-01T16:00:00Z'));await page.route('**/window/*.webp',route=>route.abort());await page.goto(url('fixture-pages'));await page.waitForFunction(()=>document.querySelector('[data-window]').hidden);assert.equal(await page.locator('[data-window-greeting]').isVisible(),false);await shot(page,'all-photo-resources-failed');await c.close();
 }
 {
  const {c,page}=await context();await page.route('**/*.mp3',route=>route.fulfill({status:404,body:''}));await page.goto(url('pages','about/'));await page.locator('audio').click({position:{x:24,y:26}});await page.getByText('这首歌暂时无法播放。',{exact:true}).waitFor();assert.equal(await page.locator('audio').isVisible(),false);await shot(page,'audio-resource-404');await c.close();
 }
 if(await stat(resolve('.flavor-builds/fixture-no-source')).catch(()=>null)){
  const {c,page}=await context();await page.goto(url('fixture-no-source'));await ready(page);assert.equal(await page.locator('.recent-notes dl>div').count(),1);await page.goto(url('fixture-no-source','about/'));assert(await page.locator('.music-card').isVisible());assert.equal(await page.locator('audio,.music-listen').count(),0);await shot(page,'music-no-source');await c.close();
 }
 report.checks.push('Single photo, denied storage, keyboard Enter/Tab, reduced motion, all photo requests failed and MP3 404 handled; blocked-autoplay fallback and no ghost player after navigation.');
 assert.deepEqual(report.pageErrors,[]);report.state='PASS';
}catch(error){report.state='FAIL';report.failure=error.stack;throw error;}
finally{await browser?.close();for(const s of servers)await new Promise(r=>s.close(r));await writeFile(resolve(evidence,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({state:report.state,checks:report.checks.length,screenshots:report.screenshots.length}));}
