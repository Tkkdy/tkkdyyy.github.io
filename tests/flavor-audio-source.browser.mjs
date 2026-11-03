/** Read-only acceptance of the actual owner-authorized immutable HTTPS audio source. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const settings=JSON.parse(await readFile('src/content/site/settings.json','utf8')),configuredSource=settings.music.source;
const source=/^https:/.test(configuredSource)?configuredSource:(process.env.MUSIC_TEST_ORIGIN||'http://127.0.0.1:4323/tkkdyyy.github.io')+configuredSource;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
const report={source,scope:'Real same-origin built static source, exact-byte hash and real Chromium native click playback; audio muted for test, no listening-quality claim'};
try{
 const context=await browser.newContext();const response=await context.request.get(source,{timeout:30000});assert.equal(response.status(),200);const remote=await response.body(),local=await readFile('public/music/angelika-vee-you-are-my-sunshine.mp3');const hash=b=>createHash('sha256').update(b).digest('hex');assert.equal(hash(remote),hash(local));
 const page=await context.newPage();const requests=[];page.on('request',r=>{if(r.url()===source)requests.push(r.url());});
 await page.setContent('<meta charset="utf-8"><h1>授权音源同站托管实测（本地测试页）</h1><p>You Are My Sunshine — Angelika Vee</p><audio controls preload="none"></audio>');await page.locator('audio').evaluate((a,src)=>{a.src=src;a.volume=0;},source);await page.waitForTimeout(200);assert.equal(requests.length,0);
 await page.locator('audio').click({position:{x:24,y:26}});await page.waitForFunction(()=>{const a=document.querySelector('audio');return !a.paused&&a.currentTime>0&&Number.isFinite(a.duration);},{},{timeout:30000});const state=await page.locator('audio').evaluate(a=>({duration:a.duration,currentTime:a.currentTime,paused:a.paused}));
 await page.screenshot({path:'docs/flavor-review/screenshots/audio-actual-https-source.webp',type:'webp'});await page.locator('audio').click({position:{x:24,y:26}});assert(await page.locator('audio').evaluate(a=>a.paused));Object.assign(report,{state:'PASS',status:200,sha256:hash(remote),bytes:remote.length,...state});
}catch(error){report.state='FAIL';report.failure=error.stack;throw error;}
finally{await browser.close();await writeFile('docs/flavor-review/audio-https-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
