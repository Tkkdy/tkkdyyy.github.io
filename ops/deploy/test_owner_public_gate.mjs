// Isolated integration: real Chromium + candidate assets, intercepted fixture network.
// No public DNS, TLS, deployment or production verdict. Fixture token is not live.
import * as fs from 'node:fs';
import {resolve,extname} from 'node:path';
import {pathToFileURL as urlOf} from 'node:url';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const sha=b=>createHash('sha256').update(b).digest('hex');
const gate=resolve('ops/deploy/owner_public_gate.mjs'),source=fs.readFileSync(gate,'utf8');
const dir=fs.mkdtempSync(resolve(tmpdir(),'owner-observer-test-'));
const artifact=resolve(process.argv[2]);
const walk=(root,prefix='')=>fs.readdirSync(root,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(resolve(root,x.name),prefix+x.name+'/'):[prefix+x.name]);
const data=new Map(walk(artifact).map(n=>[n,fs.readFileSync(resolve(artifact,n))]));
const manifest=[...data].sort(([a],[b])=>a.localeCompare(b)).map(([path,b])=>({path,bytes:b.length,sha256:sha(b)}));
fs.writeFileSync(resolve(dir,'manifest.json'),JSON.stringify(manifest));
const raw=fs.readFileSync(resolve(dir,'manifest.json'));
const proposal={scope:'OWNER_GUARDED_PUBLIC_ACCEPTANCE',token:'0'.repeat(48),candidateManifestSha256:sha(raw),externalGateSha256:sha(Buffer.from(source))};
fs.writeFileSync(resolve(dir,'proposal.json'),JSON.stringify(proposal));
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm','.pagefind':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
const results=[];
try{
 for(const scenario of ['success','public-byte-corruption','missing-noindex','success-proxy','public-byte-corruption-proxy']){
  const respond=input=>{
   const u=new URL(input);
   if(u.hostname==='www.tkkdy.me'||u.protocol==='http:')return {status:301,headers:{location:'https://tkkdy.me'+u.pathname+u.search},body:Buffer.alloc(0)};
   if(['tkkdy.me','preview.boenbot.top'].includes(u.hostname)){
    let n=decodeURIComponent(u.pathname).replace(/^\//,'');if(!n||n.endsWith('/'))n+='index.html';let body=data.get(n),status=200;
    if(!body){body=data.get('404.html');status=404;}
    if(scenario.startsWith('public-byte-corruption')&&n==='index.html')body=Buffer.from('WRONG CONTENT');
    const headers={'content-type':mime[extname(n)]||'application/octet-stream','x-robots-tag':'noindex'};
    if(scenario==='missing-noindex')delete headers['x-robots-tag'];
    return {status,headers,body};
   }
   if(u.hostname==='tkkdy.github.io')return {status:200,headers:{'content-type':'text/html'},body:Buffer.from('<link rel="canonical" href="https://tkkdy.github.io/tkkdyyy.github.io/">')};
   if(['music.leux.me','leux.me'].includes(u.hostname))return {status:200,headers:{},body:Buffer.from('fixture friend')};
   if(u.hostname==='editor.boenbot.top')return {status:302,headers:{location:'https://accounts.google.com/fixture'},body:Buffer.alloc(0)};
   if(['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname))return {status:200,headers:{'content-type':'text/css'},body:Buffer.alloc(0)};
   throw Error('Unexpected fixture host '+u.hostname);
  };
  const fakeChromium={launch:async opts=>{
   const browser=await chromium.launch(opts);
   return {close:()=>browser.close(),newContext:async options=>{
    assert.equal(options.ignoreHTTPSErrors,false);
    assert.equal(options.proxy?.server,scenario.endsWith('-proxy')?'http://127.0.0.1:9':undefined);
    const context=await browser.newContext(options);
    await context.route('**/*',async route=>{const r=respond(route.request().url());await route.fulfill({status:r.status,headers:r.headers,body:r.body});});
    return {close:()=>context.close(),newPage:()=>context.newPage(),request:{get:async url=>{
     const r=respond(url);return {status:()=>r.status,headers:()=>r.headers,body:async()=>r.body,text:async()=>r.body.toString()};
    }}};
   }};
  }};
  const output=resolve(dir,scenario+'.json');
  const fakeProcess={argv:['node',gate,resolve(dir,'proposal.json'),dir,output],env:{...process.env,PUBLIC_GATE_PROXY:scenario.endsWith('-proxy')?'http://127.0.0.1:9':''},exitCode:0};
  const context=vm.createContext({process:fakeProcess,console:{log:()=>{}},URL,Buffer,setTimeout,clearTimeout});
  const module=new vm.SourceTextModule(source,{context,identifier:gate,initializeImportMeta:meta=>{meta.url=urlOf(gate).href;}});
  await module.link(async spec=>{
   const exports=spec==='playwright'?{chromium:fakeChromium}:await import(spec);
   return new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v);},{context});
  });
  await module.evaluate();const report=JSON.parse(fs.readFileSync(output));
  assert.equal(report.passed,scenario.startsWith('success'),scenario+': '+report.error);
  if(scenario.startsWith('success'))assert.equal(report.mobile,true);
  results.push({scenario,status:'PASS',observerPassed:report.passed});
 }
 for(const bad of ['http://example.com:7897','https://127.0.0.1:7897','http://user:pass@127.0.0.1:7897','http://127.0.0.1:7897/path','http://127.0.0.1:7897/?query=1','http://127.0.0.1']){
  let launched=false;
  const context=vm.createContext({process:{argv:['node',gate,resolve(dir,'proposal.json'),dir,resolve(dir,'invalid.json')],env:{PUBLIC_GATE_PROXY:bad}},console,URL,Buffer});
  const module=new vm.SourceTextModule(source,{context,identifier:gate,initializeImportMeta:meta=>{meta.url=urlOf(gate).href;}});
  await module.link(async spec=>{
   const exports=spec==='playwright'?{chromium:{launch:()=>{launched=true;throw Error('must reject before launch');}}}:await import(spec);
   return new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v);},{context});
  });
  await assert.rejects(()=>module.evaluate(),/credential-free loopback HTTP proxy/);assert.equal(launched,false);results.push({scenario:'invalid-proxy-'+new URL(bad).hostname,status:'PASS'});
 }
 console.log(JSON.stringify({scope:'ISOLATED_OBSERVER_INTEGRATION_NO_PUBLIC_TLS',results}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
