import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {openDraftStore} from '../ops/admin-broker/private-drafts.mjs';
import {createAccessVerifier} from '../ops/admin-broker/access.mjs';
import {createCloudDraftClient} from '../src/lib/admin/cloud-drafts.mjs';
import {createBroker} from '../ops/admin-broker/core.mjs';
const key='draft-12345678-1234',state={id:key,title:'私有标题',body:'中文正文',updatedAt:'2026-10-28',cover:'data:image/png;base64,iVBORw0KGgo='};
async function storeFixture(t,options={}){const dir=await mkdtemp(join(tmpdir(),'cloud-editor-'));const store=await openDraftStore({directory:dir,...options});t.after(async()=>{await store.close();await rm(dir,{recursive:true,force:true});});return{dir,store};}
test('private drafts survive a second connection and preserve image bytes; stale concurrent writer gets 409',async t=>{
 const f=await storeFixture(t),first=await f.store.save(key,state,0);assert.equal(first.revision,1);
 const other=await openDraftStore({directory:f.dir});try{assert.deepEqual((await other.read(key)).state,state);await other.save(key,{...state,body:'设备B'},1);await assert.rejects(f.store.save(key,{...state,body:'设备A'},1),e=>e.status===409);assert.equal((await f.store.read(key)).state.body,'设备B');}finally{await other.close();}
});
test('quota rejection rolls back content/history; versions restore with a new revision',async t=>{
 const f=await storeFixture(t,{maxBytes:1200,maxDraftBytes:1000});await f.store.save(key,{title:'old'},0);await f.store.save(key,{title:'new'},1);
 await assert.rejects(f.store.save(key,{body:'x'.repeat(1100)},2),e=>e.status===413);assert.equal((await f.store.read(key)).revision,2);
 await f.store.restore(key,1,2);assert.equal((await f.store.read(key)).state.title,'old');assert.equal((await f.store.read(key)).revision,3);
 await f.store.save('draft-abcdefgh',{body:'x'.repeat(700)},0);await assert.rejects(f.store.save('draft-ijklmnop',{body:'y'.repeat(700)},0),e=>e.status===507);assert.equal(await f.store.read('draft-ijklmnop'),null);
});
test('consistent SQLite backup reopens independently and history retention is bounded',async t=>{
 const f=await storeFixture(t);for(let revision=0;revision<7;revision++)await f.store.save(key,{body:String(revision)},revision);assert.equal((await f.store.history(key)).length,3);
 const {name}=await f.store.backup(),db=new DatabaseSync(join(f.dir,'backups',name),{readOnly:true});try{assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');assert.equal(JSON.parse(db.prepare('SELECT payload FROM drafts WHERE key=?').get(key).payload).body,'6');}finally{db.close();}
 await assert.rejects(f.store.remove(key,1),e=>e.status===409);await f.store.remove(key,7);assert.equal((await f.store.list()).length,0);
});
test('storage rejects a repository/static descendant, unsafe keys and credential envelope fields',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'cloud-forbidden-'));t.after(()=>rm(dir,{recursive:true,force:true}));await assert.rejects(openDraftStore({directory:join(dir,'private'),forbiddenRoots:[dir]}),/outside/);
 const f=await storeFixture(t);for(const candidate of ['../secret','/etc/passwd','src/content/projects/../secret.md'])await assert.rejects(f.store.save(candidate,state,0),e=>e.status===400);
 await assert.rejects(f.store.save(key,{...state,token:'synthetic'},0),e=>e.status===400);
});
test('Access verifies RS256, issuer, audience, expiry and subject, and fails closed on missing/JWKS failure',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...publicKey.export({format:'jwk'}),kid:'test-key',alg:'RS256'};
 const cfg={issuer:'https://synthetic-team.cloudflareaccess.com',audience:'synthetic-audience',allowedEmail:'owner@example.com'};let calls=0;
 const validate=createAccessVerifier(cfg,{clock:()=>1000000,fetchImpl:async url=>{assert.equal(url,cfg.issuer+'/cdn-cgi/access/certs');calls++;return Response.json({keys:[jwk]});}});
 const claims={iss:cfg.issuer,aud:[cfg.audience],exp:1100,iat:900,sub:'synthetic-user',type:'app',email:'owner@example.com'};
 function request(overrides={},header={alg:'RS256',kid:'test-key'}){const parts=[header,{...claims,...overrides}].map(o=>Buffer.from(JSON.stringify(o)).toString('base64url'));const signature=sign('RSA-SHA256',Buffer.from(parts.join('.')),privateKey).toString('base64url');return new Request('https://editor.example',{headers:{'cf-access-jwt-assertion':[...parts,signature].join('.')}});}
 assert.equal(await validate(request()),true);assert.equal(calls,1);
 for(const override of [{iss:'https://evil.example'},{aud:['wrong']},{exp:999},{iat:2000},{sub:''},{type:'service'},{email:'other@example.com'},{email:'other@gmail.com'},{email:undefined},{nbf:2000}])assert.equal(await validate(request(override)),false);
 assert.equal(await validate(request({}, {alg:'none',kid:'test-key'})),false);assert.equal(await validate(new Request('https://editor.example')),false);
 assert.equal(await createAccessVerifier(cfg,{fetchImpl:async()=>{throw Error('offline');}})(request()),false);
 const wrongKey=generateKeyPairSync('rsa',{modulusLength:2048}).publicKey.export({format:'jwk'});
 assert.equal(await createAccessVerifier(cfg,{clock:()=>1000000,fetchImpl:async()=>Response.json({keys:[{...wrongKey,kid:'test-key'}]})})(request()),false);
});
test('browser save queue uses increasing revisions and does not replay a conflict',async()=>{
 const calls=[],client=createCloudDraftClient({key,session:async()=>({csrf:'synthetic'}),fetchImpl:async(url,options)=>{if(!options.method)return Response.json({draft:null});const body=JSON.parse(options.body);calls.push(body);if(calls.length===3)return Response.json({error:'conflict'},{status:409});return Response.json({draft:{revision:calls.length}});}});
 await client.load();await Promise.all([client.save({body:'first'}),client.save({body:'second'})]);assert.deepEqual(calls.map(c=>c.expectedRevision),[0,1]);await assert.rejects(client.save({body:'third'}),e=>e.status===409);await assert.rejects(client.save({body:'fourth'}),e=>e.status===409);assert.equal(calls.length,3);
});
test('draft HTTP API authenticates, enforces exact Origin and CSRF, never uses GitHub for autosave',async t=>{
 const {store}=await storeFixture(t),config={origin:'https://editor.example',sessionSeconds:28800,repository:'Tkkdy/tkkdyyy.github.io',repositoryId:1355866312,ownerId:144055705,branch:'main',publicationMode:'pull-request',clientId:'SYNTHETIC',clientSecret:'SYNTHETIC_SECRET'},calls=[];
 const broker=createBroker(config,{draftStore:store,fetchImpl:async url=>{calls.push(url);return Response.json(url.endsWith('/access_token')?{access_token:'SYNTHETIC_TOKEN',token_type:'bearer',expires_in:3600}:url.endsWith('/user')?{id:144055705,login:'Tkkdy'}:{id:1355866312,full_name:config.repository});}});
 const req=(path,options={})=>new Request(config.origin+path,options);
 assert.equal((await broker.handle(req('/api/drafts'))).status,401);
 const login=await broker.handle(req('/auth/login')),flow=new URL(login.headers.get('location')).searchParams.get('state');
 const callback=await broker.handle(req('/auth/callback?code=synthetic&state='+flow,{headers:{cookie:login.headers.getSetCookie()[0].split(';')[0]}}));
 const cookie=callback.headers.getSetCookie().find(c=>c.startsWith('__Host-editorial-session=')).split(';')[0];
 const session=await(await broker.handle(req('/api/session',{headers:{cookie}}))).json();assert.equal(session.privateDrafts,true);assert(callback.headers.getSetCookie().some(c=>c.includes('Max-Age=3600')));const before=calls.length;
 const headers={cookie,origin:config.origin,'x-admin-csrf':session.csrf};const body=JSON.stringify({key,state,expectedRevision:0});
 assert.equal((await broker.handle(req('/api/drafts',{method:'POST',headers:{...headers,origin:'https://public.example'},body}))).status,403);
 assert.equal((await broker.handle(req('/api/drafts',{method:'POST',headers,body}))).status,200);
 assert.equal((await broker.handle(req('/api/drafts',{method:'POST',headers,body}))).status,409);
 assert.equal((await(await broker.handle(req('/api/drafts?key='+key,{headers:{cookie}}))).json()).draft.state.body,state.body);assert.equal(calls.length,before);
 const proposal={requestId:'12345678-1234-4123-8123-123456789012',expectedHeadOid:'a'.repeat(40),message:{headline:'Do not publish a private draft'},fileChanges:{additions:[{path:'src/content/essays/private.md',contents:Buffer.from('---\nslug: private\nstatus: draft\n---\nPrivate text').toString('base64')}]}};
 assert.equal((await broker.handle(req('/api/proposals',{method:'POST',headers,body:JSON.stringify(proposal)}))).status,403);assert.equal(calls.length,before);
});

test('offline recovery refuses overwrites and produces an independently readable database',async t=>{
 const f=await storeFixture(t);await f.store.save(key,state,0);const {name}=await f.store.backup();
 const {restoreDraftBackup}=await import('../ops/admin-broker/restore-drafts.mjs');
 const target=join(f.dir,'recovered');await restoreDraftBackup(join(f.dir,'backups',name),target);
 await assert.rejects(restoreDraftBackup(join(f.dir,'backups',name),target));
 const restored=await openDraftStore({directory:target});try{assert.equal((await restored.read(key)).state.cover,state.cover);}finally{await restored.close();}
});
test('public HTTP origin checks Access before OAuth and rejects Host/forwarding spoofing',async t=>{
 const {createAdminServer}=await import('../ops/admin-broker/server.mjs');const http=await import('node:http');
 const dir=await mkdtemp(join(tmpdir(),'cloud-edge-'));let brokerCalls=0;
 const broker={handle:async()=>{brokerCalls++;return Response.json({ok:true});},authenticate:async()=>{throw Error();}};
 const server=await createAdminServer({origin:'https://editor.example',staticRoot:dir,broker,verifyAccess:async request=>request.headers.get('cf-access-jwt-assertion')==='SYNTHETIC_VERIFIED'});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});
 const status=headers=>new Promise((resolve,reject)=>{const r=http.get({host:'127.0.0.1',port:server.address().port,path:'/auth/login',headers},res=>{res.resume();resolve(res.statusCode);});r.on('error',reject);});
 assert.equal(await status({host:'editor.example','x-forwarded-proto':'https','cf-access-authenticated-user-email':'owner@example.com'}),403);assert.equal(brokerCalls,0);
 assert.equal(await status({host:'evil.example','cf-access-jwt-assertion':'SYNTHETIC_VERIFIED'}),421);assert.equal(brokerCalls,0);
 assert.equal(await status({host:'editor.example','cf-access-jwt-assertion':'SYNTHETIC_VERIFIED'}),200);assert.equal(brokerCalls,1);
});


test('periodic backups and a reopened service reuse the backup directory and retain three snapshots',async t=>{
 const f=await storeFixture(t);await f.store.save(key,state,0);
 for(let i=0;i<5;i++){await f.store.backup();await new Promise(resolve=>setTimeout(resolve,3));}
 assert.equal((await readdir(join(f.dir,'backups'))).filter(n=>n.endsWith('.sqlite')).length,3);
 const reopened=await openDraftStore({directory:f.dir});try{const {name}=await reopened.backup();const copy=new DatabaseSync(join(f.dir,'backups',name),{readOnly:true});try{assert.equal(JSON.parse(copy.prepare('SELECT payload FROM drafts WHERE key=?').get(key).payload).cover,state.cover);}finally{copy.close();}}finally{await reopened.close();}
});
