import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const site=new URL(process.env.SITE_URL), query=process.env.SMOKE_SEARCH_QUERY||'GrokBot';
if(!['https:','http:'].includes(site.protocol))throw Error('Invalid site');
if(site.protocol==='http:'&&!['127.0.0.1','localhost'].includes(site.hostname))throw Error('HTTP allowed for isolated loopback tests only');
const profile=process.env.VPS_INDEXING_PROFILE||'preview';
if(!['preview','production'].includes(profile))throw Error('Invalid indexing profile');
const loopback=['127.0.0.1','localhost'].includes(site.hostname);
if(!loopback&&process.env.CANONICAL_SITE_URL)throw Error('Public canonical override forbidden');
const canonicalSite=loopback?new URL(process.env.CANONICAL_SITE_URL||site.href):site;
// Optional transport only: reuse an existing local HTTP proxy without changing TLS or deadlines.
const proxyValue=process.env.PUBLIC_GATE_PROXY;
let proxy;
if(proxyValue){
 const u=new URL(proxyValue);
 if(u.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(u.hostname)||!u.port||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('PUBLIC_GATE_PROXY must be a credential-free loopback HTTP proxy');
 proxy={server:u.origin};
}
const browser=await chromium.launch({headless:true,...(!proxy?{args:['--no-proxy-server']}:{}),...(process.env.PLAYWRIGHT_CHANNEL==='chrome'?{channel:'chrome'}:{})}),context=await browser.newContext({ignoreHTTPSErrors:false,...(proxy?{proxy}:{})}),tab=await context.newPage();
const errors=[],failures=[];tab.on('pageerror',e=>errors.push(String(e)));tab.on('requestfailed',r=>{if(r.url().startsWith(site.href))failures.push({url:r.url(),error:r.failure()});});
const report={transport:proxy?'LOOPBACK_HTTP_PROXY':'DIRECT',scope:['127.0.0.1','localhost'].includes(site.hostname)?'ISOLATED_LOOPBACK_BROWSER':'PUBLIC_HTTPS_BROWSER',site:site.href,query,passed:false};
try{
 const home=await tab.goto(site.href,{waitUntil:'networkidle',timeout:30000});if(home.status()!==200)throw Error('Homepage status');
 const seo=await tab.evaluate(()=>({canonical:document.querySelector('link[rel=canonical]')?.href,og:document.querySelector('meta[property="og:url"]')?.content,blocked:[...document.querySelectorAll('meta[name=robots]')].some(x=>/noindex|none/i.test(x.content))}));
 if(seo.canonical!==canonicalSite.href||seo.og!==canonicalSite.href||seo.blocked!==(profile==='preview'))throw Error('Homepage SEO/profile mismatch');
 if(profile==='production'&&/noindex|none/i.test(home.headers()['x-robots-tag']||''))throw Error('Production HTTP noindex');
 await tab.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,20));}});
 await tab.waitForFunction(()=>Array.from(document.images).every(x=>x.complete&&x.naturalWidth>0),null,{timeout:15000});
 await tab.goto(new URL('search/',site).href,{waitUntil:'networkidle',timeout:30000});if(!await tab.locator('meta[name=robots][content*=noindex]').count())throw Error('Search page lost noindex');await tab.locator('#search-input').fill(query);
 await tab.waitForFunction(q=>document.querySelector('#search-status')?.textContent.includes(q)&&!!document.querySelector('#search-results a'),query,{timeout:20000});
 const results=await tab.locator('#search-results a').evaluateAll(xs=>xs.map(x=>({title:x.textContent,href:x.href})));
 if(!results.length||results.some(x=>!x.href.startsWith(site.href)))throw Error('Search target differs');
 const expected=results[0].href;await tab.locator('#search-results a').first().click();await tab.waitForURL(expected,{timeout:20000});
 if(!await tab.locator('h1').count()||errors.length||failures.length)throw Error('Runtime or search navigation failure');
 Object.assign(report,{passed:true,results,clicked:tab.url(),h1:await tab.locator('h1').textContent()});
}catch(e){report.failure=String(e);process.exitCode=1;}
finally{report.errors=errors;report.failures=failures;writeFileSync('browser-evidence.json',JSON.stringify(report,null,2));await context.close();await browser.close();}
console.log(JSON.stringify(report));
