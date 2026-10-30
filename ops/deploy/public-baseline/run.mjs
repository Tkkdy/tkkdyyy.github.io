// Read-only current-preview baseline. Never an owner publication verdict.
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {installDiagnostics,requireCheck as check} from './diagnostics.mjs';
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../../..'),OUT=resolve('public-baseline-results');mkdirSync(OUT,{recursive:true});
const config=JSON.parse(readFileSync(resolve(ROOT,'.github/public-baseline-run.json'))),raw=readFileSync(resolve(HERE,'preview-manifest.json')).toString().replace(/\r\n/g,'\n');
const sha=b=>createHash('sha256').update(b).digest('hex');
const report={scope:'READ_ONLY_LIVE_PREVIEW_BASELINE',requestId:config.requestId,passed:false,publicationAccepted:false,transport:'DIRECT',retries:0,timeoutMs:30000,strictTls:true,steps:[],requests:[],browserNetwork:[],runtime:{node:process.version,openssl:process.versions.openssl,image:process.env.OBSERVER_IMAGE,runnerImage:process.env.ImageVersion,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,sourceSha:process.env.GITHUB_SHA},manifestSha256:sha(raw)};
let browser,context,probe,currentStep='environment';
const step=async(name,fn)=>{currentStep=name;const v={name,status:'RUNNING'};report.steps.push(v);try{await fn();v.status='PASS';console.log('PASS '+name)}catch(e){v.status='FAIL';throw e;}};
const OLD='https://preview.boenbot.top/',NEW='https://tkkdy.me/',manifest=JSON.parse(raw),cache=new Map();
try {
 check(process.env.GITHUB_RUN_ATTEMPT==='1','Reruns are forbidden','ENVIRONMENT_FAILURE');
 check(process.platform==='linux'&&process.versions.node===config.expectedNode,'Unexpected runtime','ENVIRONMENT_FAILURE');
 check(!['PUBLIC_GATE_PROXY','HTTPS_PROXY','HTTP_PROXY','ALL_PROXY','https_proxy','http_proxy','all_proxy'].some(k=>process.env[k]),'Proxy configuration not permitted','ENVIRONMENT_FAILURE');
 check(config.scope===report.scope&&config.candidatePromotion===false,'Invalid observation scope','IDENTITY_FAILURE');
 check(report.manifestSha256===config.baselineManifestSha256&&manifest.length===115,'Baseline identity mismatch','IDENTITY_FAILURE');
 const pw=JSON.parse(readFileSync(resolve(ROOT,'node_modules/playwright/package.json')));check(pw.version===config.expectedPlaywright,'Playwright mismatch','ENVIRONMENT_FAILURE');
 browser=await chromium.launch({channel:'chrome-for-testing',headless:true,args:['--no-proxy-server','--enable-automation']});
 report.runtime.browser=browser.version();report.runtime.browserChannel='chrome-for-testing';report.runtime.apiStack='Node https/OpenSSL HTTP1.x; not Chrome network';
 check(browser.version()===config.expectedChrome,'Chrome version mismatch','ENVIRONMENT_FAILURE');
 const session=await browser.newBrowserCDPSession();const args=await session.send('Browser.getBrowserCommandLine');await session.detach();check(args.arguments.includes('--no-proxy-server'),'Browser DIRECT not proven','ENVIRONMENT_FAILURE');report.runtime.directFlagVerified=true;
 context=await browser.newContext({ignoreHTTPSErrors:false});context.setDefaultTimeout(30000);context.setDefaultNavigationTimeout(30000);probe=installDiagnostics(report);
 const get=(u,label)=>probe.get(context,u,label);
 await step('entries-and-neighbour-sites',async()=>{
  for(const base of [NEW,OLD]){const r=await get(base,'entry');check(r.status===200&&/noindex/i.test(r.headers['x-robots-tag']||''),'Preview entry noindex/status');check(sha(r.body)===manifest.find(x=>x.path==='index.html').sha256,'Entry content changed','IDENTITY_FAILURE');}
  for(const url of ['http://tkkdy.me/articles/?baseline=1','http://www.tkkdy.me/articles/?baseline=1','https://www.tkkdy.me/articles/?baseline=1']){const r=await get(url,'redirect');check(r.status===301&&r.headers.location==='https://tkkdy.me/articles/?baseline=1','Redirect differs');}
  const pages=await get('https://tkkdy.github.io/tkkdyyy.github.io/','pages');check(pages.status===200&&pages.body.toString().includes('https://tkkdy.github.io/tkkdyyy.github.io/'),'Pages independent URL');
  for(const host of ['music.leux.me','leux.me']){const r=await get('https://'+host+'/','friend');check(r.status===200&&r.body.length>0,'Friend complete entry '+host);}
  const e=await get('https://editor.boenbot.top/','editor');check(e.status===302&&new URL(e.headers.location).hostname==='accounts.google.com','Editor auth entry');
 });
 await step('full-original-content-both-domains',async()=>{
  for(const base of [NEW,OLD])for(const item of manifest){
   const path=item.path==='404.html'?'__public-baseline-missing-20261029':item.path;
   const r=await get(new URL(path,base).href,'manifest:'+item.path);check(r.status===(item.path==='404.html'?404:200),'Manifest status '+item.path);check(r.body.length===item.bytes&&sha(r.body)===item.sha256,'Manifest bytes '+item.path,'IDENTITY_FAILURE');
   if(base===NEW)cache.set(item.path,r.body);
  }
  report.completeManifestFiles=manifest.length;report.completeManifestDomains=2;
 });
 await step('sitemap-rss-robots-original-identity',async()=>{
  for(const name of ['sitemap-index.xml','sitemap-0.xml']){const urls=[...cache.get(name).toString().matchAll(/<loc>(.*?)<\/loc>/g)].map(x=>x[1]);check(urls.length&&urls.every(x=>x.startsWith(OLD)),'Preview sitemap URL');}
  const rss=cache.get('rss.xml').toString();check(rss.includes('<rss')&&rss.includes(OLD),'Preview RSS');check(cache.get('robots.txt').toString().includes(OLD),'Preview robots');
 });
 await step('existing-browser-gate-old-preview',async()=>{
  const dir=resolve(OUT,'old-smoke');mkdirSync(dir,{recursive:true});
  const env={...process.env,SITE_URL:OLD,VPS_INDEXING_PROFILE:'preview',PLAYWRIGHT_CHANNEL:'chrome-for-testing',PUBLIC_GATE_PROXY:''};delete env.CANONICAL_SITE_URL;
  const child=spawnSync(process.execPath,[resolve(ROOT,'ops/deploy/browser_gate.mjs')],{cwd:dir,env,encoding:'utf8',timeout:180000});
  writeFileSync(resolve(dir,'browser.log'),(child.stdout||'')+'\n'+(child.stderr||''));
  const evidence=existsSync(resolve(dir,'browser-evidence.json'))?JSON.parse(readFileSync(resolve(dir,'browser-evidence.json'))):{};report.existingBrowserGate=evidence;
  check(child.status===0&&evidence.passed,'Existing browser gate failed',evidence.failure?.includes('Timeout')?'CLIENT_TRANSPORT_INCONCLUSIVE':'BROWSER_ACCEPTANCE_FAILURE');
 });
 for(const [mode,width,height] of [['desktop',1440,1000],['mobile',390,844]])for(const base of [NEW,OLD])await step(mode+':'+new URL(base).hostname,async()=>{
  const tab=await context.newPage();await tab.setViewportSize({width,height});const errors=[];tab.on('pageerror',e=>errors.push(String(e)));tab.on('requestfailed',r=>{if(r.url().startsWith(base))errors.push('Same-origin request failed: '+r.url()+': '+r.failure()?.errorText);});const cdp=await context.newCDPSession(tab);await cdp.send('Network.enable');
  cdp.on('Network.responseReceived',e=>{if(e.type==='Document')report.browserNetwork.push({url:e.response.url.split('?')[0],status:e.response.status,ip:e.response.remoteIPAddress,protocol:e.response.protocol,timing:e.response.timing});});
  cdp.on('Network.loadingFailed',e=>report.browserNetwork.push({error:e.errorText,canceled:e.canceled,resourceType:e.type}));
  try{
   const detail=manifest.filter(x=>/^(articles|essays)\/[^/]+\/index.html$/.test(x.path)).map(x=>x.path.replace(/index.html$/,''));
   for(const path of ['','articles/','projects/','essays/','fragments/','images/','about/',...detail]){
    const r=await tab.goto(new URL(path,base).href,{waitUntil:'networkidle',timeout:30000});check(r.status()===200,'Browser route '+path);check(!errors.length,'Browser runtime/network failure '+path);
    const seo=await tab.evaluate(()=>({canonical:document.querySelector('link[rel=canonical]')?.href,og:document.querySelector('meta[property="og:url"]')?.content,noindex:[...document.querySelectorAll('meta[name=robots]')].some(x=>/noindex|none/i.test(x.content))}));
    check(seo.canonical===new URL(path,OLD).href&&seo.og===seo.canonical&&seo.noindex,'Original preview SEO '+path);
   }
   await tab.goto(base,{waitUntil:'networkidle',timeout:30000});await tab.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){scrollTo(0,y);await new Promise(r=>setTimeout(r,30));}});
   await tab.waitForFunction(()=>[...document.images].every(x=>x.complete&&x.naturalWidth>0),null,{timeout:20000});
   await tab.screenshot({path:resolve(OUT,mode+'-'+new URL(base).hostname+'.png')});
   await tab.goto(new URL('search/',base).href,{waitUntil:'networkidle',timeout:30000});check(await tab.locator('meta[name=robots][content*=noindex]').count(),'Search noindex');
   await tab.locator('#search-input').fill('GrokBot');await tab.waitForFunction(()=>document.querySelector('#search-status')?.textContent.includes('GrokBot')&&!!document.querySelector('#search-results a'),null,{timeout:20000});
   const links=await tab.locator('#search-results a').evaluateAll(xs=>xs.map(x=>x.href));check(links.length&&links.every(x=>x.startsWith(base)),'Search result origin');await tab.locator('#search-results a').first().click();await tab.waitForURL(links[0],{timeout:20000});check(await tab.locator('h1').count()&&!errors.length,'Search result/runtime');
  }finally{await tab.close();}
 });
 report.passed=true;
}catch(e){report.failure={step:currentStep,category:e.category||report.requests.findLast(x=>x.error)?.category||(/Timeout|net::/i.test(String(e))?'CLIENT_TRANSPORT_INCONCLUSIVE':'BASELINE_ACCEPTANCE_FAILURE'),error:String(e)};process.exitCode=1;}
finally{probe?.close();await context?.close();await browser?.close();report.completedUtc=new Date().toISOString();writeFileSync(resolve(OUT,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({scope:report.scope,passed:report.passed,failure:report.failure,steps:report.steps,runtime:report.runtime}));}
