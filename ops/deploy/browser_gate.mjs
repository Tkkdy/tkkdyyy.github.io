import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const site=new URL(process.env.SITE_URL), query=process.env.SMOKE_SEARCH_QUERY||'GrokBot';
if(!['https:','http:'].includes(site.protocol))throw Error('Invalid site');
if(site.protocol==='http:'&&!['127.0.0.1','localhost'].includes(site.hostname))throw Error('HTTP allowed for isolated loopback tests only');
const browser=await chromium.launch({headless:true}),context=await browser.newContext({ignoreHTTPSErrors:false}),tab=await context.newPage();
const errors=[],failures=[];tab.on('pageerror',e=>errors.push(String(e)));tab.on('requestfailed',r=>{if(r.url().startsWith(site.href))failures.push({url:r.url(),error:r.failure()});});
const report={scope:site.protocol==='https:'?'PUBLIC_HTTPS_BROWSER':'ISOLATED_LOOPBACK_BROWSER',site:site.href,query,passed:false};
try{
 const home=await tab.goto(site.href,{waitUntil:'networkidle',timeout:30000});if(home.status()!==200)throw Error('Homepage status');
 await tab.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,20));}});
 await tab.waitForFunction(()=>Array.from(document.images).every(x=>x.complete&&x.naturalWidth>0),null,{timeout:15000});
 await tab.goto(new URL('search/',site).href,{waitUntil:'networkidle',timeout:30000});await tab.locator('#search-input').fill(query);
 await tab.waitForFunction(q=>document.querySelector('#search-status')?.textContent.includes(q)&&!!document.querySelector('#search-results a'),query,{timeout:20000});
 const results=await tab.locator('#search-results a').evaluateAll(xs=>xs.map(x=>({title:x.textContent,href:x.href})));
 if(!results.length||results.some(x=>!x.href.startsWith(site.href)))throw Error('Search target differs');
 const expected=results[0].href;await tab.locator('#search-results a').first().click();await tab.waitForURL(expected,{timeout:20000});
 if(!await tab.locator('h1').count()||errors.length||failures.length)throw Error('Runtime or search navigation failure');
 Object.assign(report,{passed:true,results,clicked:tab.url(),h1:await tab.locator('h1').textContent()});
}catch(e){report.failure=String(e);process.exitCode=1;}
finally{report.errors=errors;report.failures=failures;writeFileSync('browser-evidence.json',JSON.stringify(report,null,2));await context.close();await browser.close();}
console.log(JSON.stringify(report));
