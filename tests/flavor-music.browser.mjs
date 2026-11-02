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
 await c.route('https://raw.githubusercontent.com/**/*.mp3',async r=>r.fulfill({status:200,contentType:'audio/mpeg',body:await readFile('media/music/angelika-vee-you-are-my-sunshine.mp3')}));
 const page=await c.newPage();page.on('pageerror',e=>report.errors.push(e.message));return {c,page};
}
async function shot(page,name){const path=`docs/flavor-review/screenshots/${target}-${name}.webp`;await page.locator('.music-card').scrollIntoViewIfNeeded();await page.screenshot({path,type:'webp'});report.screenshots.push(path);}
async function playing(page){await page.waitForFunction(()=>{const a=document.querySelector('audio');return a&&!a.paused&&a.currentTime>0;});}
async function samples(page){
 const values=[];for(let i=0;i<15;i++){values.push(await page.locator('audio').evaluate(a=>({volume:a.volume,time:a.currentTime,paused:a.paused})));await page.waitForTimeout(200);}
 assert(values.some(v=>v.volume>0.02&&v.volume<0.55),'intermediate fade volume');assert(Math.abs(values.at(-1).volume-0.6)<0.01,'target volume');
 for(let i=1;i<values.length;i++)assert(values[i].volume>=values[i-1].volume,'monotonic fade');return values;
}
try{
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
 for(const width of [1440,390]){
  const {c,page}=await context(width);const requests=[];page.on('request',r=>{if(r.url().endsWith('.mp3'))requests.push(r.url());});
  await page.goto(url+'about/');await page.getByText('浏览器暂未允许自动播放，点击播放，音乐会轻轻淡入。',{exact:true}).waitFor();
  assert(await page.locator('audio').evaluate(a=>a.paused));assert.equal(requests.length,0);await shot(page,`music-autoplay-blocked-${width}`);
  await page.locator('audio').click({position:{x:24,y:26}});await playing(page);const fade=await samples(page);
  assert.equal(await page.locator('[data-music-state]').innerText(),'正在播放');await shot(page,`music-click-fade-${width}`);
  await page.locator('audio').evaluate(a=>a.pause());const paused=await page.locator('audio').evaluate(a=>a.volume);await page.waitForTimeout(300);assert.equal(await page.locator('audio').evaluate(a=>a.volume),paused);
  assert.equal(await page.locator('[data-music-state]').innerText(),'已暂停');
  report.checks.push({test:`${width}: fresh visit blocked without media request; native click fades over 2.4s to 60%; pause works`,fade});await c.close();
 }
 for(const width of [1440,390]){
  const {c,page}=await context(width);await page.goto(url);if(width<768)await page.locator("[data-mobile-menu] summary").click();await page.locator(`a[href="${base}about/"]:visible`).first().click();await playing(page);const fade=await samples(page);await shot(page,`music-entry-autofade-${width}`);
  // Pause during a second fade, then ensure its animation cannot change volume in the background.
  await page.locator('audio').evaluate(a=>a.pause());await page.locator('audio').click({position:{x:24,y:26}});await playing(page);await page.waitForTimeout(300);await page.locator('audio').evaluate(a=>a.pause());
  const paused=await page.locator('audio').evaluate(a=>({volume:a.volume,time:a.currentTime}));assert(paused.volume<0.6);await page.waitForTimeout(450);assert.deepEqual(await page.locator('audio').evaluate(a=>({volume:a.volume,time:a.currentTime})),paused);
  // User volume adjustment wins over a running fade.
  await page.locator('audio').click({position:{x:24,y:26}});await playing(page);await page.locator('audio').evaluate(a=>{a.volume=0.22;});await page.waitForTimeout(400);assert.equal(await page.locator('audio').evaluate(a=>a.volume),0.22);
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
 assert.deepEqual(report.errors,[]);report.state='PASS';
}catch(error){report.state='FAIL';report.failure=error.stack;throw error;}
finally{await browser?.close();await new Promise(r=>server.close(r));await writeFile(`docs/flavor-review/music-autofade-${target}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
