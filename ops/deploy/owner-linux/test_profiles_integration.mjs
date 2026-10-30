// Real local Chrome, intercepted fixture HTTP/TLS. Never public acceptance.
import * as fs from 'node:fs';import * as path from 'node:path';import * as cp from 'node:child_process';import * as tls from 'node:tls';import {EventEmitter} from 'node:events';import vm from 'node:vm';import assert from 'node:assert/strict';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';import {chromium} from 'playwright';import {classify} from '../public-baseline/diagnostics.mjs';import {profile,ownerSuccess,IMAGE,CANDIDATE} from './profile.mjs';
const gate=path.resolve('ops/deploy/public-baseline/run.mjs'),source=fs.readFileSync(gate,'utf8'),candidate=path.resolve(process.argv[2]),temp=fs.mkdtempSync(path.join(tmpdir(),'owner-linux-fixture-'));
const raw=fs.readFileSync(path.join(candidate,'manifest.json')),manifest=JSON.parse(raw),files=new Map(manifest.map(x=>[x.path,fs.readFileSync(path.join(candidate,'site',x.path))]));
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm','.pagefind':'application/octet-stream','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
const results=[];
try{for(const scenario of (process.argv[3]?process.argv[3].split(','):['guarded','indexable','guarded-lost-noindex','indexable-still-noindex'])){
 const phase=scenario.startsWith('guarded')?'guarded':'indexable',out=path.join(temp,scenario),config={enabled:true,scope:'OWNER_LINUX_OBSERVATION',attemptId:'2026102900000006',phase,challengeSha256:'a'.repeat(64),requestId:'owner-0006-'+phase+'-'+'b'.repeat(24),candidateManifestSha256:CANDIDATE,observerCodeCommit:'c'.repeat(40),expiresEpoch:Math.floor(Date.now()/1000)+600,expectedNode:'24.19.0',expectedPlaywright:'1.64.1',expectedChrome:'156.0.8078.4',previousEvidence:phase==='guarded'?null:{runId:123,reportSha256:'d'.repeat(64)}};
 const respond=input=>{
  const u=new URL(input);
  if(u.hostname==='www.tkkdy.me'||u.protocol==='http:')return {status:301,headers:{location:'https://tkkdy.me'+u.pathname+u.search},body:Buffer.alloc(0)};
  if(['tkkdy.me','preview.boenbot.top'].includes(u.hostname)){
   let n=decodeURIComponent(u.pathname).replace(/^\//,'');if(!n||n.endsWith('/'))n+='index.html';let body=files.get(n),status=200;if(!body){body=files.get('404.html');status=404;}
   const headers={'content-type':mime[path.extname(n)]||'application/octet-stream'};
   if(u.hostname==='preview.boenbot.top'||phase==='guarded')headers['x-robots-tag']='noindex';
   if(scenario==='guarded-lost-noindex'&&u.hostname==='tkkdy.me')delete headers['x-robots-tag'];
   if(scenario==='indexable-still-noindex'&&u.hostname==='tkkdy.me')headers['x-robots-tag']='noindex';
   return {status,headers,body};
  }
  if(u.hostname==='tkkdy.github.io')return {status:200,headers:{},body:Buffer.from('<link href="https://tkkdy.github.io/tkkdyyy.github.io/">')};
  if(['music.leux.me','leux.me'].includes(u.hostname))return {status:200,headers:{},body:Buffer.from('fixture friend complete')};
  if(u.hostname==='editor.boenbot.top')return {status:302,headers:{location:'https://accounts.google.com/fixture'},body:Buffer.alloc(0)};
  if(['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname))return {status:200,headers:{'content-type':'text/css'},body:Buffer.alloc(0)};
  throw Error('Unexpected fixture host '+u.hostname);
 };
 const fakeProcess={env:{OWNER_OBSERVATION_REQUEST:'.github/owner-observation-run.json',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'42',GITHUB_SHA:'e'.repeat(40),OBSERVER_IMAGE:IMAGE},platform:'linux',versions:{node:'24.19.0',openssl:'fixture'},version:'v24.19.0',execPath:process.execPath,exitCode:0};
 const fakeChromium={launch:async opts=>{assert.equal(opts.channel,'chrome-for-testing');assert.ok(opts.args.includes('--no-proxy-server'));const b=await chromium.launch({...opts,channel:'chrome'});return {version:()=>config.expectedChrome,newBrowserCDPSession:()=>b.newBrowserCDPSession(),close:()=>b.close(),newContext:async o=>{assert.equal(o.ignoreHTTPSErrors,false);const c=await b.newContext(o);await c.route('**/*',async route=>{const r=respond(route.request().url());await route.fulfill({status:r.status,headers:r.headers,body:r.body});});return c;}};}};
 const fakeFs={...fs,readFileSync:(p,...a)=>String(p).endsWith('owner-observation-run.json')?Buffer.from(JSON.stringify(config)):String(p).endsWith('candidate-manifest.json')?raw:fs.readFileSync(p,...a)};
 const fakePath={...path,resolve:(...a)=>a[0]==='public-baseline-results'?out:path.resolve(...a)};
 const fakeCp={...cp,spawnSync:(exe,args)=>{if(exe==='git')return {status:0,stdout:'.github/owner-observation-run.json\n'};const smoke=path.join(out,'old-smoke');fs.mkdirSync(smoke,{recursive:true});fs.writeFileSync(path.join(smoke,'browser-evidence.json'),JSON.stringify({passed:true,scope:'FIXTURE_EXISTING_SMOKE_NOT_EXECUTED'}));return {status:0,stdout:'fixture only',stderr:''};}};
 const fakeTls={...tls,connect:(o,fn)=>{assert.equal(o.rejectUnauthorized,true);const s=new EventEmitter();s.authorized=true;s.setTimeout=()=>{};s.end=()=>{};s.getPeerCertificate=()=>({subjectaltname:'DNS:tkkdy.me, DNS:www.tkkdy.me',valid_from:new Date().toUTCString(),valid_to:new Date(Date.now()+60*86400000).toUTCString()});queueMicrotask(()=>{if(scenario==='guarded-certificate-reset'){s.emit('lookup',null,'127.0.0.1',4);s.emit('connect');s.emit('error',Object.assign(Error('fixture ECONNRESET'),{code:'ECONNRESET'}));}else fn();});return s;}};
 const fakeProbe={classify,installDiagnostics:report=>({get:async(c,url,label)=>{const r=respond(url);report.requests.push({label,url,status:r.status,bytes:r.body.length,completed:true,events:[]});return r;},close(){}}),requireCheck:(v,m,category)=>{if(!v)throw Object.assign(Error(m),{category});}};
 const context=vm.createContext({process:fakeProcess,console:{log(){}},URL,Buffer,setTimeout,clearTimeout,queueMicrotask});
 const mod=new vm.SourceTextModule(source,{context,identifier:gate,initializeImportMeta:m=>m.url=pathToFileURL(gate).href});
 await mod.link(async spec=>{const e=spec==='playwright'?{chromium:fakeChromium}:spec==='node:fs'?fakeFs:spec==='node:path'?fakePath:spec==='node:child_process'?fakeCp:spec==='node:tls'?fakeTls:spec==='./diagnostics.mjs'?fakeProbe:spec==='../owner-linux/profile.mjs'?{profile,ownerSuccess,IMAGE}:await import(spec);return new vm.SyntheticModule(Object.keys(e),function(){for(const [k,v] of Object.entries(e))this.setExport(k,v)},{context});});
 await mod.evaluate();const report=JSON.parse(fs.readFileSync(path.join(out,'report.json')));assert.equal(report.passed,scenario===phase,scenario+': '+JSON.stringify(report.failure));if(report.passed){assert.equal(report.completeManifestFiles,116);assert.equal(report.completeManifestDomains,2);assert.equal(report.searchAndClick,true);assert.equal(report.newDomainNoindex,phase==='guarded');}else if(scenario==='guarded-certificate-reset'){assert.equal(report.failure.step,'utility-noindex-and-certificate');assert.equal(report.failure.stage,'TLS');assert.equal(report.failure.category,'CLIENT_TRANSPORT_INCONCLUSIVE');}else assert.equal(report.failure.step,'entries-and-neighbour-sites');results.push({scenario,status:'PASS',fixtureAccepted:report.passed});console.log('PASS fixture '+scenario);
 }console.log(JSON.stringify({scope:'ISOLATED_TWO_PHASE_PROFILE_FIXTURES_NO_PUBLIC_TLS',existingSmoke:'NOT_EXECUTED_FIXTURE_STUB',results}));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
