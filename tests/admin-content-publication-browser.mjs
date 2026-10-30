/** UI-only smoke with synthetic responses; no GitHub access or authentication. */
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('dist-admin');
const server=createServer(async(req,res)=>{try{let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.endsWith('/'))path+='index.html';const file=resolve(root,'.'+path);if(!file.startsWith(root+'/')&&!file.startsWith(root+'\\'))throw Error();const data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const origin='http://127.0.0.1:'+server.address().port;
 const head='b'.repeat(40),branch='codex/editorial-proposal-d8556e29-254b-4fe5-a949-09aa45ac8971';let writes=0;
 await page.addInitScript(()=>localStorage.setItem('editorial-studio:proposal-v1:123',JSON.stringify({number:123,receipt:'SYNTHETIC_RECEIPT'})));
 await page.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;let body;
  if(path==='/api/session')body={authenticated:true,publicationMode:'pull-request',contentAutoMergeEnabled:true,csrf:'SYNTHETIC_CSRF'};
  else if(path==='/api/proposals/restore')body={state:'PULL_REQUEST_OPEN',pullRequestNumber:123,branch,commitSha:head,url:'https://github.com/Tkkdy/tkkdyyy.github.io/pull/123',merged:false,deploymentConfirmed:false,publication:{state:'NOT_REQUESTED'}};
  else if(path==='/api/proposals/123/publish'){writes++;assert.equal(route.request().headers()['x-admin-csrf'],'SYNTHETIC_CSRF');assert.equal(route.request().postDataJSON().expectedSha,head);body={state:'WAITING'};}
  else throw Error('Unexpected synthetic API '+path);
  return route.fulfill({json:body});
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/admin/proposals/');await page.locator('[data-history-select]').selectOption('0');
 assert.equal(await page.locator('[data-history-resume]').isDisabled(),true);
 await page.locator('[data-history-refresh]').click();await page.locator('[data-history-resume]:enabled').waitFor();assert.equal(writes,0);
 await page.locator('[data-history-resume]').click();await page.getByText('发布任务：WAITING；请核验后续状态。',{exact:true}).waitFor();assert.equal(writes,1);
 assert.equal(await page.locator('[data-history-resume]').isDisabled(),true);
 await page.locator('[data-history-select]').selectOption('');assert.equal(await page.locator('[data-history-resume]').isDisabled(),true);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({scope:'SYNTHETIC_BROWSER_UI_NOT_GITHUB_ACCEPTANCE',passed:true,resumeWrites:writes,checks:['restore is read-only','CSRF and exact SHA','duplicate disabled','selection clears authorization','no page errors']}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
