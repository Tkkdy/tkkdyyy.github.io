/** Anonymous read-only baseline inspection; no auth, drafts, settings or deployment writes. */
import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const evidence=resolve('docs/flavor-review'),report={checkedAt:new Date().toISOString(),mode:'anonymous read-only',pages:[]};
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',proxy:{server:'http://127.0.0.1:7897'}});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 for(const [name,url]of [['live-home','https://tkkdy.me/'],['live-images','https://tkkdy.me/images/'],['live-editor-anonymous','https://editor.boenbot.top/']]){
  const page=await context.newPage();
  try{
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await page.screenshot({path:resolve(evidence,'screenshots',name+'.webp'),type:'webp'});
   report.pages.push({url,status:response.status(),title:await page.title(),fixturePlaceholders:await page.locator('.css-placeholder,.image-frame-placeholder').count(),visibleImages:await page.locator('img').count(),editorAuthenticated:false});
  }catch(error){report.pages.push({url,error:error.message.split('\n')[0]});}
  await page.close();
 }
 for(const url of ['https://tkkdy.me/deployment.json','https://tkkdy.github.io/tkkdyyy.github.io/deployment.json']){
  try{const response=await context.request.get(url);report.pages.push({url,status:response.status(),version:response.status()===200?await response.json():undefined});}catch(error){report.pages.push({url,error:error.message.split('\n')[0]});}
 }
}finally{await browser.close();await writeFile(resolve(evidence,'live-baseline.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
