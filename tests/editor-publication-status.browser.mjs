/** Real built Editor + Chromium; SYNTHETIC API only, no OAuth or external writes. */
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('dist-admin'),evidence=resolve('.flavor-builds/editor-status');await mkdir(evidence,{recursive:true});
const server=createServer(async(req,res)=>{try{let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.endsWith('/'))path+='index.html';const file=resolve(root,'.'+path);if(!file.startsWith(root+sep))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,base='a'.repeat(40),head='b'.repeat(40),merged='c'.repeat(40),runUrl='https://github.com/Tkkdy/tkkdyyy.github.io/actions/runs/123';
const report={scope:'LOCAL_REAL_EDITOR_CHROMIUM_SYNTHETIC_API_NO_EXTERNAL_WRITES',checks:[],pageErrors:[]};let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
 const draft='draft-status-test-12345678';await page.addInitScript(({draft})=>localStorage.setItem('tkkdy-editorial:'+draft,JSON.stringify({id:draft,title:'发布状态本地验收',deck:'测试稿件，不会提交外部',type:'Essay',status:'published',slug:'status-local-test',publishedAt:'2026-11-04',body:'仅用于本地浏览器验收。',categories:[],tags:[],sourcePath:'',cover:'',coverAlt:''})),{draft});
 let proposal,mode='checking',writes=0,queryFailure=false,deploys;
 const target=(name,status='CURRENT_VERSION_VERIFIED',pipeline='SUCCEEDED')=>({target:name,status,actualSha:status==='VERSION_DIFFERS'?base:merged,url:name==='pages'?'https://tkkdy.github.io/tkkdyyy.github.io/':'https://tkkdy.me/',pipeline:{state:pipeline,url:runUrl,job:name+'-deploy',step:pipeline==='FAILED'?'Public browser acceptance':null,reason:pipeline==='FAILED'?'failure':null}});
 await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;let body;
  if(path==='/api/session')body={authenticated:true,publicationMode:'pull-request',contentAutoMergeEnabled:true,repository:'Tkkdy/tkkdyyy.github.io',branch:'main',csrf:'SYNTHETIC_CSRF'};
  else if(path==='/api/v3/user')body={login:'Tkkdy'};
  else if(path.endsWith('/git/ref/heads/main'))body={object:{sha:base}};
  else if(path.includes('/contents/'))return route.fulfill({status:404,json:{error:'Not found'}});
  else if(path==='/api/proposals'){writes++;const request=route.request().postDataJSON();proposal={state:'PULL_REQUEST_OPEN',branch:'codex/editorial-proposal-'+request.requestId,baseSha:base,commitSha:head,pullRequestNumber:123,url:'https://github.com/Tkkdy/tkkdyyy.github.io/pull/123',merged:false,deploymentConfirmed:false,recoveryReceipt:'SYNTHETIC_RECEIPT',publication:{state:'WAITING'}};body=proposal;}
  else if(path==='/api/proposals/123'){
   if(queryFailure)return route.fulfill({status:502,json:{error:'状态暂不可用'}});
   body={...proposal,checkedAt:new Date().toISOString(),checks:{state:mode==='failed'?'FAILED':mode==='checking'?'PENDING':'PASSED',job:'check',step:'Run npm run test:search',url:runUrl,reason:'failure'},publication:{state:mode==='failed'?'CI_FAILED':'WAITING'}};
   if(mode==='merged')body={...body,state:'MERGED_ON_MAIN',merged:true,mergedSha:merged};
  }else if(path==='/api/deployments')body={checkedAt:new Date().toISOString(),targets:deploys};
  else throw Error('Unexpected synthetic API '+path);
  return route.fulfill({json:body});
 });
 await page.goto(origin+'/admin/stories/new/?draft='+draft);await page.locator('.editor-workspace:not([inert])').waitFor();
 await page.locator('[data-phase-action="Publish"]').click();await page.locator('[data-publish-summary]').filter({hasText:'正在中文搜索检查'}).waitFor();assert.equal(writes,1);
 assert.equal(await page.locator('[data-target-link="pages"]').isVisible(),false);assert.match(await page.locator('[data-target-status="pages"]').innerText(),/尚未开始部署/);report.checks.push('Submit remains distinct from public launch.');
 const refresh=page.locator('[data-refresh-deploy]');mode='failed';await refresh.click();await page.locator('[data-publish-summary]').filter({hasText:'中文搜索检查未通过'}).waitFor();assert.equal(await page.locator('[data-check-details]').getAttribute('href'),runUrl);assert.equal(await page.locator('[data-publish-step="checks"]').getAttribute('data-status'),'failure');await page.locator('[data-publish-progress]').screenshot({path:resolve(evidence,'checks-failed.webp')});report.checks.push('Persistent failed search stage, reason and exact run link.');
 mode='passed';await refresh.click();await page.locator('[data-publish-summary]').filter({hasText:'检查已通过，等待合并'}).waitFor();
 mode='merged';deploys=[target('pages'),target('vps','CURRENT_VERSION_VERIFIED','PENDING')];await refresh.click();await page.locator('[data-publish-summary]').filter({hasText:'一站已上线'}).waitFor();assert.equal(await page.locator('[data-target-link="pages"]').isVisible(),true);assert.equal(await page.locator('[data-target-link="vps"]').isVisible(),false);report.checks.push('Public marker while acceptance is running cannot show completed launch.');
 queryFailure=true;await refresh.click();await page.locator('[data-publish-summary]').filter({hasText:'状态查询暂时失败'}).waitFor();assert.equal(await page.locator('[data-target-link="pages"]').isVisible(),true);queryFailure=false;report.checks.push('Transport errors preserve prior observations and allow refresh.');
 deploys=[target('pages'),target('vps','VERSION_DIFFERS','FAILED')];await refresh.click();await page.locator('[data-publish-summary]').filter({hasText:'请查看站点失败原因'}).waitFor();assert.equal(await page.locator('[data-target-card="vps"]').getAttribute('data-state'),'failure');assert.equal(await page.locator('[data-target-link="pages"]').isVisible(),true);report.checks.push('Independent site failure retains the successful site.');
 deploys=[target('pages'),target('vps')];await refresh.click();await page.locator('[data-publish-summary]').filter({hasText:'发布完成：两站均已上线'}).waitFor();assert.equal(await page.locator('[data-target-link="vps"]').isVisible(),true);assert.match(await page.locator('[data-publish-checked]').innerText(),/最近核验/);assert.equal(writes,1);
 await page.locator('[data-publish-progress]').screenshot({path:resolve(evidence,'both-live.webp')});await page.setViewportSize({width:390,height:844});await page.locator('[data-publish-progress]').scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('[data-publish-progress]').screenshot({path:resolve(evidence,'mobile-live.webp')});report.checks.push('Both verified sites, timestamp and links; mobile has no horizontal overflow; no duplicate proposal.');
 assert.deepEqual(report.pageErrors,[]);report.pass=true;
}catch(error){report.pass=false;report.error=error.stack;process.exitCode=1;}
finally{await browser?.close();await new Promise(r=>server.close(r));await writeFile(resolve(evidence,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
