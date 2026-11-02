/** About-page playback policy and fade acceptance in real Chromium; owner MP3 response fulfilled locally. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(process.env.FLAVOR_MUSIC_ROOT||'dist');
const base=process.env.FLAVOR_MUSIC_BASE||'/tkkdyyy.github.io/';
const target=base==='/'?'vps':'pages';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
const server=createServer(async(req,res)=>{try{
 const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(!path.startsWith(base))throw Error('base');
 const file=resolve(root,path.slice(base.length)+(path.endsWith('/')?'index.html':''));
 if(!file.startsWith(root+sep))throw Error('path');
 const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(bytes);
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(19645,'127.0.0.1',r));
const origin='http://127.0.0.1:19645',url=origin+base;
const report={target,scope:'Real Edge/Chromium default autoplay policy; allowed path uses a real same-origin navigation click, no policy override flags. MP3 fulfilled with authorized owner bytes; viewport emulation, no physical phone/listening-quality claim.',checks:[],errors:[],screenshots:[]};
let browser;
async function context(width=1440){
 const c=await browser.newContext({viewport:{width,height:width<600?844:1000}});
 await c.route('https://fonts.googleapis.com/**',r=>r.abort());await c.route('https://fonts.gstatic.com/**',r=>r.abort());
 await c.route('https://raw.githubusercontent.com/**/*.mp3',async r=>{
  const bytes=await readFile('media/music/angelika-vee-you-are-my-sunshine.mp3');const range=r.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
  if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;await r.fulfill({status:206,contentType:'audio/mpeg',headers:{'accept-ranges':'bytes','content-range':`bytes ${start}-${end}/${bytes.length}`},body:bytes.subarray(start,end+1)});}
  else await r.fulfill({status:200,contentType:'audio/mpeg',headers:{'accept-ranges':'bytes'},body:bytes});
 });
 const page=await c.newPage();page.on('pageerror',e=>report.errors.push(e.message));return {c,page};
}
async function shot(page,name){const path=`docs/flavor-review/screenshots/${target}-${name}.webp`;await page.locator('.music-card').scrollIntoViewIfNeeded();await page.screenshot({path,type:'webp'});report.screenshots.push(path);}
async function playing(page){await page.waitForFunction(()=>{const a=document.querySelector('audio');return a&&!a.paused&&a.currentTime>0;});}
async function samples(page){
 const values=[];for(let i=0;i<15;i++){values.push(await page.locator('audio').evaluate(a=>({volume:a.volume,time:a.currentTime,paused:a.paused})));await page.waitForTimeout(200);}
 assert(values.some(v=>v.volume>0.02&&v.volume<0.3),'intermediate fade volume');assert(Math.abs(values.at(-1).volume-0.35)<0.01,'target volume');
 for(let i=1;i<values.length;i++)assert(values[i].volume>=values[i-1].volume,'monotonic fade');return values;
}
try{
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
 for(const width of [1440,390]){
  const {c,page}=await context(width);const requests=[];page.on('request',r=>{if(r.url().endsWith('.mp3'))requests.push(r.url());});
  await page.goto(url+'about/');await page.getByText('浏览器暂未允许自动播放，点击播放，音乐会轻轻淡入。',{exact:true}).waitFor({state:'attached'});
  assert(await page.locator('audio').evaluate(a=>a.paused));assert.equal(requests.length,0);await shot(page,`music-autoplay-blocked-${width}`);
  await page.locator('[data-music-toggle]').click();await playing(page);const fade=await samples(page);
  assert.equal(await page.locator('[data-music-state]').textContent(),'正在播放');await shot(page,`music-click-fade-${width}`);
  await page.locator('audio').evaluate(a=>a.pause());const paused=await page.locator('audio').evaluate(a=>a.volume);await page.waitForTimeout(300);assert.equal(await page.locator('audio').evaluate(a=>a.volume),paused);
  assert.equal(await page.locator('[data-music-state]').textContent(),'已暂停');
  report.checks.push({test:`${width}: fresh visit blocked without media request; custom play click fades over 2.4s to 35%; pause works`,fade});await c.close();
 }
 for(const width of [1440,390]){
  const {c,page}=await context(width);await page.goto(url);if(width<768)await page.locator("[data-mobile-menu] summary").click();await page.locator(`a[href="${base}about/"]:visible`).first().click();await playing(page);const fade=await samples(page);await shot(page,`music-entry-autofade-${width}`);
  // Pause during a second fade, then ensure its animation cannot change volume in the background.
  await page.locator('audio').evaluate(a=>a.pause());await page.locator('[data-music-toggle]').click();await playing(page);await page.waitForTimeout(300);await page.locator('audio').evaluate(a=>a.pause());
  const paused=await page.locator('audio').evaluate(a=>({volume:a.volume,time:a.currentTime}));assert(paused.volume<0.35);await page.waitForTimeout(450);assert.deepEqual(await page.locator('audio').evaluate(a=>({volume:a.volume,time:a.currentTime})),paused);
  // User volume adjustment wins over a running fade.
  await page.locator('[data-music-toggle]').click();await playing(page);await page.locator('audio').evaluate(a=>{a.volume=0.22;});await page.waitForTimeout(400);assert.equal(await page.locator('audio').evaluate(a=>a.volume),0.22);
  // Capture the actual old audio element state after navigation's real pagehide event.
  await page.evaluate(()=>window.addEventListener('pagehide',()=>sessionStorage.setItem('music-pagehide',JSON.stringify({paused:document.querySelector('audio').paused,time:document.querySelector('audio').currentTime})),{once:true}));
  await page.goto(url);const leaving=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('music-pagehide')));assert.deepEqual(leaving,{paused:true,time:0});assert.equal(await page.locator('audio').count(),0);
  report.checks.push({test:`${width}: same-origin navigation automatically fades; pause cancels fade; manual volume retained; actual pagehide pauses and resets audio`,fade});await c.close();
 }
 {
  const {c,page}=await context();await page.route('**/*.mp3',r=>r.fulfill({status:404,body:''}));await page.goto(url);await page.locator(`a[href="${base}about/"]`).first().click();
  await page.getByText('这首歌暂时无法播放。',{exact:true}).waitFor();assert.equal(await page.locator('audio').isVisible(),false);await shot(page,'music-autoplay-404');await c.close();
  report.checks.push('Autoplay-permitted path with MP3 404 keeps failure text and hides invalid controls.');
 }
 // The chosen card: solid pale blue, classic serif, play beside title, visible entrance.
 for(const width of [1440,390,320]){
  const {c,page}=await context(width);await page.goto(url+'about/');
  const design=await page.locator('.music-card').evaluate(card=>{
   const animation=card.querySelector('h2').getAnimations()[0];animation?.pause();if(animation)animation.currentTime=0;
   const start=card.getBoundingClientRect().right;
   if(animation)animation.currentTime=500;
   const midway=card.getBoundingClientRect().left;
   if(animation)animation.finish();
   const rect=card.getBoundingClientRect(),title=card.querySelector('h2').getBoundingClientRect(),play=card.querySelector('[data-music-toggle]').getBoundingClientRect();
   return {background:getComputedStyle(card).backgroundColor,font:getComputedStyle(card.querySelector('h2')).fontFamily,duration:animation?.effect.getTiming().duration,start,midway,end:rect.left,titleY:title.bottom,playX:play.left,playY:play.top,playRight:play.right,titleX:title.left,titleTop:title.top,cardX:rect.left,overflow:document.documentElement.scrollWidth>innerWidth,artist:card.querySelector('.music-artist,.music-kicker')!==null};
  });
  assert.equal(design.background,'rgb(234, 242, 248)');assert(design.font.includes('Georgia'));assert.equal(design.duration,2000);assert(design.playY<design.titleY);assert(design.playRight<design.titleX);assert(design.playX-design.cardX<=33);assert.equal(design.overflow,false);assert.equal(design.artist,false);
  assert(await page.locator('[data-music-toggle]').isVisible());assert.equal(await page.locator('audio').isVisible(),false);
  await page.locator('[data-music-toggle]').focus();await page.keyboard.press('Enter');await playing(page);await page.waitForTimeout(250);
  const seek=page.locator('[data-music-seek]');await seek.focus();await page.keyboard.press('PageUp');await page.waitForFunction(()=>document.querySelector('audio').currentTime>10);const seekRect=await seek.boundingBox();await page.mouse.click(seekRect.x+seekRect.width/2,seekRect.y+seekRect.height/2);await page.waitForFunction(()=>{const a=document.querySelector('audio');return a.currentTime>a.duration*0.4&&a.currentTime<a.duration*0.6;});
  await page.locator('[data-music-volume]').focus();await page.keyboard.press('End');await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('audio').evaluate(a=>a.volume),0.99);await page.waitForTimeout(200);assert.equal(await page.locator('audio').evaluate(a=>a.volume),0.99);assert.equal(await page.locator('[data-music-volume-label]').textContent(),'99%');
  await page.locator('[data-music-mute]').click();assert(await page.locator('audio').evaluate(a=>a.muted));await page.locator('[data-music-mute]').click();assert.equal(await page.locator('audio').evaluate(a=>a.muted),false);
  // Resume respects the visitor's volume selection rather than resetting it to the default.
  await page.locator('[data-music-toggle]').click();assert(await page.locator('audio').evaluate(a=>a.paused));await page.locator('[data-music-toggle]').click();await playing(page);await page.waitForTimeout(2600);assert.equal(await page.locator('audio').evaluate(a=>a.volume),0.99);
  await page.locator('audio').evaluate(a=>{a.volume=0.35;});await page.locator('[data-music-volume]').evaluate(n=>n.value==='35');await page.locator('[data-music-toggle]').click();await shot(page,`music-card-design-${width}`);report.checks.push({test:`${width}: chosen style, 2s staged title/control entry, keyboard play/seek/volume, mute, pause/resume preserves selected volume, no overflow`,design});await c.close();
 }
 {
  const {c,page}=await context();await c.clearCookies();await page.emulateMedia({reducedMotion:'reduce'});await page.goto(url+'about/');assert.equal(await page.locator('.music-card').evaluate(n=>n.getAnimations({subtree:true}).length),0);await shot(page,'music-card-reduced-motion');await c.close();
  const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});await nojs.route('https://fonts.googleapis.com/**',r=>r.abort());await nojs.route('https://fonts.gstatic.com/**',r=>r.abort());const p=await nojs.newPage();await p.goto(url+'about/');await p.waitForTimeout(1100);assert(await p.locator('audio[controls]').isVisible());assert.equal(await p.locator('[data-music-controls]').isVisible(),false);await shot(p,'music-card-nojs');await nojs.close();report.checks.push('Reduced motion disables entrance; without JS the native audio controls remain visible and usable.');
 }
 assert.deepEqual(report.errors,[]);report.state='PASS';
}catch(error){report.state='FAIL';report.failure=error.stack;throw error;}
finally{await browser?.close();await new Promise(r=>server.close(r));await writeFile(`docs/flavor-review/music-autofade-${target}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
