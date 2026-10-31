// Isolated candidate browser test. Never visits or changes a production host.
import {createServer} from 'node:http';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const [dir,mode]=process.argv.slice(2), root=resolve(dir);
if(!['pages','preview','production','shared-preview'].includes(mode))throw Error('Invalid mode');
const base=mode==='pages'?'/tkkdyyy.github.io/':'/';
const canonical=mode==='pages'?'https://tkkdy.github.io/tkkdyyy.github.io/':mode==='preview'?'https://preview.boenbot.top/':'https://tkkdy.me/';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer((req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!pathname.startsWith(base))throw Error('base');
  let file=resolve(root,pathname.slice(base.length)||'.');
  if(file!==root&&!file.startsWith(root+sep))throw Error('escape');
  if(statSync(file).isDirectory())file=resolve(file,'index.html');
  const body=readFileSync(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream',...(mode==='shared-preview'?{'X-Robots-Tag':'noindex'}:{})});res.end(body);
 }catch{res.writeHead(404);res.end('not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const site=`http://127.0.0.1:${server.address().port}${base}`;
try{
 if(mode!=='shared-preview'){
  const child=spawn(process.execPath,[resolve(dirname(fileURLToPath(import.meta.url)),'../ops/deploy/browser_gate.mjs')],{stdio:'inherit',env:{...process.env,SITE_URL:site,CANONICAL_SITE_URL:canonical,VPS_INDEXING_PROFILE:mode==='preview'?'preview':'production'}});
  const code=await new Promise(r=>child.on('exit',r));if(code!==0)throw Error('Trusted browser gate failed');
 }
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,ignoreHTTPSErrors:false});
  const page=await context.newPage();const response=await page.goto(site,{waitUntil:'networkidle',timeout:30000});
  if(response.status()!==200)throw Error('Mobile status');
  if(mode==='shared-preview'&&response.headers()['x-robots-tag']!=='noindex')throw Error('Shared preview HTTP noindex');
  if(await page.locator('link[rel=canonical]').getAttribute('href')!==canonical)throw Error('Mobile/shared canonical');
  await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=500){scrollTo(0,y);await new Promise(r=>setTimeout(r,20));}});
  await page.waitForFunction(()=>[...document.images].every(x=>x.complete&&x.naturalWidth>0),null,{timeout:15000});
  await page.goto(new URL('search/',site).href,{waitUntil:'networkidle',timeout:30000});await page.locator('#search-input').fill('GrokBot');
  await page.waitForFunction(()=>document.querySelector('#search-status')?.textContent.includes('GrokBot')&&!!document.querySelector('#search-results a'),null,{timeout:20000});
  const target=await page.locator('#search-results a').first().getAttribute('href');await page.locator('#search-results a').first().click();await page.waitForURL(new URL(target,site).href,{timeout:20000});
  if(!await page.locator('h1').count())throw Error('Mobile click');
  await page.goto(new URL('search/',site).href,{waitUntil:'networkidle',timeout:30000});
  await page.locator('#search-input').fill('P1 编辑发布链路验收草稿');
  await page.waitForFunction(()=>document.querySelector('#search-status')?.textContent.includes('没有找到与「P1 编辑发布链路验收草稿」'),null,{timeout:20000});
  if(await page.locator('#search-results a').count())throw Error('Draft leaked to Pagefind');
  writeFileSync(`local-${mode}.json`,JSON.stringify({scope:'ISOLATED_LOOPBACK_ONLY',passed:true,mode,mobile:true,images:true,searchAndClick:true,draftExcluded:true,canonical,sharedHttpNoindex:mode==='shared-preview'},null,2));
  await context.close();
 }finally{await browser.close();}
}finally{server.close();}
