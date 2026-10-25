import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import http from 'node:http';import {createAdminServer} from '../ops/admin-broker/server.mjs';
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'editorial-adapter-'));await mkdir(join(dir,'admin'));await writeFile(join(dir,'admin/index.html'),'<script>window.test=1</script><h1>Protected</h1>');await writeFile(join(dir,'admin/secret.env'),'PRIVATE');await writeFile(join(dir,'admin/config.yml'),'backend:\n  name: github\ncollections: []\n');
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const origin='http://127.0.0.1:'+port;
 const broker={authenticate:async req=>{if(req.headers.get('cookie')!=='synthetic=owner')throw Error('unauthorized');return {repository:'Tkkdy/tkkdyyy.github.io',branch:'codex/probe'};},handle:async()=>new Response('{}',{headers:{'set-cookie':['first=1; HttpOnly','second=2; HttpOnly']}})};
 const server=await createAdminServer({origin,staticRoot:dir,broker,maxBodyBytes:32});await new Promise(r=>server.listen(port,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});return{dir,origin,port};
}
test('actual loopback HTTP gates static admin and assets, emits restrictive CSP and rejects rebinding',async t=>{
 const f=await fixture(t);assert.equal((await fetch(f.origin+'/admin/')).status,401);
 const r=await fetch(f.origin+'/admin/',{headers:{cookie:'synthetic=owner'}});assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/script-src 'self' 'sha256-/);assert(!r.headers.get('content-security-policy').includes("script-src 'unsafe-inline'"));assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');
 const forged=await new Promise((resolve,reject)=>{const req=http.get({host:'127.0.0.1',port:f.port,path:'/admin/',headers:{host:'evil.example',cookie:'synthetic=owner'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});assert.equal(forged,421);
 for(const path of ['/admin/secret.env','/admin/missing/','/other.html'])assert.equal((await fetch(f.origin+path,{headers:{cookie:'synthetic=owner'}})).status,404);
});
test('raw traversal, double decoding and cross-site paths never reach protected static files',async t=>{
 const f=await fixture(t);for(const path of ['/admin/../admin/','/admin/%2e%2e/admin/','/admin/%252e%252e/','//evil.example/admin/','/admin/%5csecret.env']){
  const status=await new Promise((resolve,reject)=>{const req=http.get({host:'127.0.0.1',port:f.port,path,headers:{cookie:'synthetic=owner'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});assert.equal(status,400,path);
 }
});
test('POST input is bounded before broker and static directories cannot be listed',async t=>{
 const f=await fixture(t);const oversized=await fetch(f.origin+'/api/graphql',{method:'POST',body:'x'.repeat(33)});assert.equal(oversized.status,413);
 assert.equal((await fetch(f.origin+'/admin/',{method:'POST',body:'x'})).status,405);
 await mkdir(join(f.dir,'admin/empty'));assert.equal((await fetch(f.origin+'/admin/empty/',{headers:{cookie:'synthetic=owner'}})).status,404);
});

test('CMS configuration is authenticated, same-origin and cannot select main or PAT authentication',async t=>{
 const f=await fixture(t);assert.equal((await fetch(f.origin+'/admin/config.yml')).status,401);
 const response=await fetch(f.origin+'/admin/config.yml',{headers:{cookie:'synthetic=owner'}});assert.equal(response.status,200);const config=await response.text();assert.match(config,/branch: codex\/probe/);assert.match(config,/auth_methods:\n    - oauth/);assert(config.includes(f.origin+'/api/v3'));assert(!config.includes('token'));assert(!config.includes('branch: main'));
});
