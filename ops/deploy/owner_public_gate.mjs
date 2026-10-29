// External observer for the guarded owner transaction. No deployment or credentials.
// Fixed public hosts; output contains no cookies, OAuth state or response headers.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const [proposalPath,candidateDir,outputPath]=process.argv.slice(2);
if(!proposalPath||!candidateDir||!outputPath)throw Error('Usage: node owner_public_gate.mjs proposal.json candidate-directory verdict.json');
const proposal=JSON.parse(readFileSync(proposalPath)),raw=readFileSync(candidateDir+'/manifest.json'),manifest=JSON.parse(raw);
const sha=b=>createHash('sha256').update(b).digest('hex');
if(proposal.scope!=='OWNER_GUARDED_PUBLIC_ACCEPTANCE'||!/^([a-f0-9]{48})$/.test(proposal.token)||sha(raw)!==proposal.candidateManifestSha256)throw Error('Untrusted/mismatched owner proposal');
const gateSha256=sha(readFileSync(new URL(import.meta.url)));
if(gateSha256!==proposal.externalGateSha256)throw Error('Unreviewed external gate');
const report={gateSha256,scope:proposal.scope,token:proposal.token,candidateManifestSha256:sha(raw),passed:false};
const site='https://tkkdy.me/',old='https://preview.boenbot.top/';
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL==='chrome'?{channel:'chrome'}:{})});
const context=await browser.newContext({ignoreHTTPSErrors:false});
const check=(ok,msg)=>{if(!ok)throw Error(msg);};
const get=url=>context.request.get(url,{maxRedirects:0,timeout:30000});
try{
 for(const item of manifest){
  const path=item.path==='404.html'?'__owner-gate-missing-'+proposal.token:item.path;
  const r=await get(new URL(path,site).href),body=await r.body();
  check(r.status()===(item.path==='404.html'?404:200),'Public status '+item.path);
  check(body.length===item.bytes&&sha(body)===item.sha256,'Public bytes '+item.path);
 }
 for(const [name,base] of [['newDomainNoindex',site],['oldDomainNoindex',old]]){
  const r=await get(base);check(r.status()===200&&/noindex/i.test(r.headers()['x-robots-tag']||''),'Guarded domain '+base);report[name]=true;
 }
 for(const url of ['http://tkkdy.me/articles/?owner_gate=1','https://www.tkkdy.me/articles/?owner_gate=1']){
  const r=await get(url);check(r.status()===301&&r.headers().location==='https://tkkdy.me/articles/?owner_gate=1','Redirect path/query differs');
 }
 for(const [mode,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const tab=await context.newPage();await tab.setViewportSize({width,height});const errors=[];tab.on('pageerror',e=>errors.push(String(e)));
  const detail=manifest.filter(x=>/^(articles|essays)\/[^/]+\/index.html$/.test(x.path)).map(x=>x.path.replace(/index.html$/,''));
  const routes=['','articles/','projects/','essays/','fragments/','images/','about/',...detail];
  for(const path of routes){
   const r=await tab.goto(new URL(path,site).href,{waitUntil:'networkidle',timeout:30000});check(r.status()===200,'Browser route '+path);
   const seo=await tab.evaluate(()=>({canonical:document.querySelector('link[rel=canonical]')?.href,og:document.querySelector('meta[property="og:url"]')?.content,noindex:[...document.querySelectorAll('meta[name=robots]')].some(x=>/noindex|none/i.test(x.content))}));
   check(seo.canonical===new URL(path,site).href&&seo.og===seo.canonical&&!seo.noindex,'Browser SEO '+path);
  }
  await tab.goto(site,{waitUntil:'networkidle'});
  await tab.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){scrollTo(0,y);await new Promise(r=>setTimeout(r,30));}});
  await tab.waitForFunction(()=>[...document.images].every(x=>x.complete&&x.naturalWidth>0),null,{timeout:20000});
  await tab.goto(new URL('search/',site).href,{waitUntil:'networkidle'});check(await tab.locator('meta[name=robots][content*=noindex]').count(),'Search indexing');
  await tab.locator('#search-input').fill('GrokBot');await tab.waitForFunction(()=>document.querySelector('#search-status')?.textContent.includes('GrokBot')&&!!document.querySelector('#search-results a'),null,{timeout:20000});
  const links=await tab.locator('#search-results a').evaluateAll(xs=>xs.map(x=>x.href));check(links.length&&links.every(x=>x.startsWith('https://tkkdy.me/')),'Search domain');
  await tab.locator('#search-results a').first().click();await tab.waitForURL(links[0]);check(await tab.locator('h1').count(),'Search result page');check(!errors.length,'Browser runtime errors');
  await tab.close();report[mode]=true;
 }
 report.searchAndClick=true;report.canonical=true;
 const pages=await get('https://tkkdy.github.io/tkkdyyy.github.io/');check(pages.status()===200,'Pages health');const pageText=await pages.text();check(pageText.includes('https://tkkdy.github.io/tkkdyyy.github.io/'),'Pages independent URL');report.pagesIndependent=true;
 for(const host of ['music.leux.me','leux.me']){const r=await get('https://'+host+'/');check(r.status()===200,'Friend entry '+host);}report.friends=true;
 const editor=await get('https://editor.boenbot.top/');check(editor.status()===302&&new URL(editor.headers().location).hostname==='accounts.google.com','Editor login entry');report.editorEntry=true;
 report.strictTls=true;report.passed=true;
}catch(e){report.error=String(e);process.exitCode=1;}
finally{await context.close();await browser.close();writeFileSync(outputPath,JSON.stringify(report,null,2),{flag:'wx'});}
console.log(JSON.stringify(report));
