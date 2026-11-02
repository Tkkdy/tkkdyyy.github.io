/** Real HTTPS integration and entry-motion recording; requires a running local Pages preview. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const source=JSON.parse(await readFile('src/content/site/settings.json','utf8')).music.source;
const url=process.env.MUSIC_TEST_URL||'http://127.0.0.1:4321/tkkdyyy.github.io/about/';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true,proxy:{server:process.env.MUSIC_TEST_PROXY||'http://127.0.0.1:7897'}});
const report={scope:'Real immutable HTTPS source and actual custom card, no media mocking. Local Chromium desktop viewport, not a physical phone or listening-quality/in-app-browser claim.',source,url};
let context,video;
try{
 context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:'.flavor-builds/music-card-video',size:{width:1440,height:1000}}});
 await context.route('https://fonts.googleapis.com/**',r=>r.abort());await context.route('https://fonts.gstatic.com/**',r=>r.abort());
 const page=await context.newPage();video=page.video();await page.goto(url);await page.waitForTimeout(1200);
 await page.locator('[data-music-toggle]').click();
 await page.waitForFunction(()=>{const a=document.querySelector('audio');return !a.paused&&a.currentTime>0&&a.seekable.length>0&&a.seekable.end(0)>30;},{},{timeout:30000});
 const rect=await page.locator('[data-music-seek]').boundingBox();assert(rect);await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);
 await page.waitForFunction(()=>{const a=document.querySelector('audio');return a.currentTime>a.duration*.4&&a.currentTime<a.duration*.6;},{},{timeout:30000});
 report.media=await page.locator('audio').evaluate(a=>({duration:a.duration,time:a.currentTime,seekableEnd:a.seekable.end(0),paused:a.paused,source:a.currentSrc}));
 assert.equal(report.media.source,source);await page.screenshot({path:'docs/flavor-review/screenshots/music-card-actual-https-seek.webp',type:'webp'});report.state='PASS';
}catch(error){report.state='FAIL';report.failure=error.stack;throw error;}
finally{
 await context?.close();if(video)await video.saveAs('docs/flavor-review/music-card-entry.webm');await browser.close();
 await writeFile('docs/flavor-review/music-card-https-seek.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
