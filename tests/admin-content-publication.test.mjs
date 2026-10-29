import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {advanceContentPublication,createContentPublisher} from '../ops/admin-broker/content-publication.mjs';
const base='a'.repeat(40),head='b'.repeat(40),merged='c'.repeat(40),ROOT='/repos/Tkkdy/tkkdyyy.github.io';
const branch='codex/editorial-proposal-d8556e29-254b-4fe5-a949-09aa45ac8971';
const original={pullRequestNumber:123,branch,baseSha:base,commitSha:head,url:'https://github.com/Tkkdy/tkkdyyy.github.io/pull/123'};
const path='src/content/essays/one-click.md',text='---\ntitle: Test\nslug: one-click\nstatus: draft\npublishedAt: 2026-10-29\n---\nDraft text\n';
const raw=Buffer.from(text),blobSha=createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex');
function fixture(change=()=>undefined){
 const calls=[];let prReads=0,mainReads=0;
 const pr={number:123,html_url:original.url,user:{id:144055705},state:'open',merged:false,draft:false,changed_files:1,head:{sha:head,ref:branch,repo:{id:1355866312}},base:{ref:'main',repo:{id:1355866312}},mergeable:true,mergeable_state:'clean'};
 const run={id:10,event:'pull_request',path:'.github/workflows/ci.yml',head_sha:head,head_branch:branch,head_repository:{id:1355866312},pull_requests:[],status:'completed',conclusion:'success'};
 const github=async(url,options={})=>{
  calls.push({url,...options});
  const altered=await change({url,options,prReads,mainReads,pr:structuredClone(pr),run:structuredClone(run)});if(altered!==undefined)return altered;
  if(url===ROOT)return{id:1355866312,full_name:'Tkkdy/tkkdyyy.github.io',owner:{id:144055705}};
  if(url===ROOT+'/pulls/123'){prReads++;return structuredClone(pr);}
  if(url===ROOT+'/branches/main')return{protected:true};
  if(url.endsWith('/git/ref/heads/main')){mainReads++;return{object:{type:'commit',sha:base}};}
  if(url.includes('/compare/'))return{status:'ahead',behind_by:0,files:[{status:'added',filename:path}]};
  if(url.includes('/git/trees/'))return{truncated:false,tree:[{path,type:'blob',mode:'100644',size:raw.length,sha:blobSha}]};
  if(url.includes('/git/blobs/'))return{sha:blobSha,encoding:'base64',size:raw.length,content:raw.toString('base64')};
  if(url.includes('/actions/workflows/'))return{total_count:1,workflow_runs:[run]};
  if(url.includes('/actions/runs/'))return{total_count:1,jobs:[{name:'check',status:'completed',conclusion:'success'}]};
  if(url.endsWith('/merge'))return{merged:true,sha:merged};
  throw Error('Unexpected URL '+url);
 };
 return{github,calls};
}
const writes=f=>f.calls.filter(c=>c.method);
test('actual full diff and Git blob pass; required CI; exact-head squash only',async()=>{
 const f=fixture();assert.deepEqual(await advanceContentPublication({...f,original}),{state:'MERGED',sha:merged,runId:10});
 assert.equal(writes(f).length,1);assert.equal(writes(f)[0].method,'PUT');assert.deepEqual(JSON.parse(writes(f)[0].body),{sha:head,merge_method:'squash'});
});
for(const name of ['workflow','config','admin','dependency','traversal','case','rename'])test('reject engineering actual scope: '+name,async()=>{
 const paths={workflow:'.github/workflows/ci.yml',config:'nginx.conf',admin:'src/pages/admin/index.astro',dependency:'package.json',traversal:'src/content/essays/../x.md',case:'Src/content/essays/a.md',rename:path};
 const f=fixture(({url})=>url.includes('/compare/')?{status:'ahead',behind_by:0,files:[{status:name==='rename'?'renamed':'modified',filename:paths[name],previous_filename:'.github/workflows/ci.yml'}]}:undefined);
 await assert.rejects(advanceContentPublication({...f,original}));assert.equal(writes(f).length,0);
});
for(const kind of ['symlink','executable','submodule','truncated','wrongblob','activeSVG','secret'])test('reject file tree/content: '+kind,async()=>{
 let filename=path,body=raw;if(kind==='activeSVG'){filename='public/uploads/a.svg';body=Buffer.from('<svg onload="evil()"></svg>');}if(kind==='secret')body=Buffer.from(text+'\nghp_'+'a'.repeat(36));
 const sha=createHash('sha1').update(Buffer.from('blob '+body.length+'\0')).update(body).digest('hex');
 const f=fixture(({url})=>{
  if(url.includes('/compare/'))return{status:'ahead',behind_by:0,files:[{status:'added',filename}]};
  if(url.includes('/git/trees/'))return{truncated:kind==='truncated',tree:[{path:filename,type:kind==='submodule'?'commit':'blob',mode:kind==='symlink'?'120000':kind==='executable'?'100755':'100644',size:body.length,sha}]};
  if(url.includes('/git/blobs/'))return{sha,encoding:'base64',size:body.length,content:(kind==='wrongblob'?Buffer.from('x'.repeat(body.length)):body).toString('base64')};
 });await assert.rejects(advanceContentPublication({...f,original}));assert.equal(writes(f).length,0);
});
for(const kind of ['failed','pending','skipped','wrongSHA','wrongBranch','wrongWorkflow','wrongRepo','tooMany','jobSkipped'])test('CI gate: '+kind,async()=>{
 const f=fixture(({url,run})=>{
  if(url.includes('/actions/workflows/')){if(kind==='failed')run.conclusion='failure';if(kind==='pending')run.status='in_progress';if(kind==='skipped')run.conclusion='skipped';if(kind==='wrongSHA')run.head_sha=base;if(kind==='wrongBranch')run.head_branch='other';if(kind==='wrongWorkflow')run.path='.github/workflows/other.yml';if(kind==='wrongRepo')run.head_repository.id=1;return{total_count:kind==='tooMany'?101:1,workflow_runs:[run]};}
  if(kind==='jobSkipped'&&url.includes('/actions/runs/'))return{total_count:1,jobs:[{name:'check',status:'completed',conclusion:'skipped'}]};
 });try{assert.notEqual((await advanceContentPublication({...f,original})).state,'MERGED');}catch{}assert.equal(writes(f).length,0);
});
for(const kind of ['headChanged','baseChanged','unprotected','conflict','blocked','behind','repoTransferred','closed','foreignAuthor','draft','oversizedDiff'])test('identity and concurrency: '+kind,async()=>{
 const f=fixture(({url,pr,prReads,mainReads})=>{
  if(kind==='repoTransferred'&&url===ROOT)return{id:1};
  if(kind==='unprotected'&&url.endsWith('/branches/main'))return{protected:false};
  if(kind==='baseChanged'&&url.endsWith('/git/ref/heads/main')&&mainReads>0)return{object:{sha:merged}};
  if(url===ROOT+'/pulls/123'){
   if(kind==='headChanged'&&prReads>0)pr.head.sha=merged;
   if(kind==='conflict')pr.mergeable_state='dirty';if(kind==='blocked')pr.mergeable_state='blocked';if(kind==='behind')pr.mergeable_state='behind';if(kind==='closed')pr.state='closed';if(kind==='draft')pr.draft=true;if(kind==='foreignAuthor')pr.user.id=1;if(kind==='oversizedDiff')pr.changed_files=65;
   // Let fixture advance read counters for unchanged first reads.
   if(kind!=='headChanged'||prReads>0)return pr;
  }
 });try{assert.notEqual((await advanceContentPublication({...f,original})).state,'MERGED');}catch{}assert.equal(writes(f).length,0);
});
test('session expiry just before CAS refuses all writes',async()=>{
 const f=fixture();let count=0;await assert.rejects(advanceContentPublication({...f,original,active:()=>++count===1}));assert.equal(writes(f).length,0);
});
test('two clicks and concurrent wait ticks share one task; browser not required',async()=>{
 const f=fixture(),tasks=[];const publisher=createContentPublisher({...f,enabled:true,schedule:f=>{tasks.push(f);return tasks.length;},cancel:()=>{}});
 assert.equal(publisher.start(original).state,'WAITING');publisher.start(original);assert.equal(tasks.length,1);
 await tasks.shift()();assert.equal(publisher.status(123).state,'MERGED');publisher.start(original);assert.equal(writes(f).length,1);assert.equal(tasks.length,0);
});
test('timeout is stopped with no automatic repeated merge; a new authenticated session reconciles merged PR',async()=>{
 const tasks=[],f=fixture(({url})=>{if(url.endsWith('/merge'))throw Error('SYNTHETIC_SECRET');});
 const publisher=createContentPublisher({...f,enabled:true,schedule:f=>tasks.push(f)});publisher.start(original);await tasks.shift()();assert.deepEqual(publisher.status(123),{state:'STOPPED',reason:'VERIFY_OR_MERGE_UNCONFIRMED'});assert.equal(tasks.length,0);assert.equal(writes(f).length,1);assert(!JSON.stringify(publisher.status(123)).includes('SECRET'));
 const recovered=fixture(({url,pr})=>url===ROOT+'/pulls/123'?{...pr,state:'closed',merged:true,merge_commit_sha:merged}:undefined);
 assert.equal((await advanceContentPublication({...recovered,original})).state,'MERGED');assert.equal(writes(recovered).length,0);
});
test('default off, logout and expired sessions cannot schedule or mutate',async()=>{
 const f=fixture(),tasks=[];assert.equal(createContentPublisher(f).start(original).state,'MANUAL');
 let active=true;const p=createContentPublisher({...f,enabled:true,active:()=>active,schedule:f=>tasks.push(f),cancel:()=>{}});p.start(original);active=false;await tasks.shift()();assert.equal(p.status(123).state,'SESSION_EXPIRED');assert.equal(f.calls.length,0);
 const q=createContentPublisher({...f,enabled:true,schedule:f=>tasks.push(f),cancel:()=>{}});q.start(original);q.stop();await tasks.shift()();assert.equal(f.calls.length,0);
});
import {createBroker} from '../ops/admin-broker/core.mjs';
test('real broker HTTP: one publish click queues once; GET remains read-only; recovery requires owner+CSRF+exact SHA',async()=>{
 const f=fixture(),calls=f.calls;let committed=false,mergedPR=false,resolveMerge;
 const done=new Promise(resolve=>{resolveMerge=resolve;});
 const github=async(url,options={})=>{
  if(url===ROOT+'/git/refs')return{ref:'refs/heads/'+branch,object:{sha:base}};
  if(url==='/graphql'){committed=true;return{data:{createCommitOnBranch:{commit:{oid:head}}}};}
  if(url===ROOT+'/git/ref/heads/'+branch)return{object:{sha:committed?head:base}};
  if(url===ROOT+'/pulls')return{number:123,state:'open',merged:false,head:{ref:branch,sha:head,repo:{id:1355866312}},base:{ref:'main',sha:base,repo:{id:1355866312}},html_url:original.url};
  if(url.includes('/compare/'))return{status:'ahead',behind_by:0,total_commits:1,commits:[{sha:head}],files:[{status:'added',filename:path}]};
  const r=await f.github(url,options);if(url===ROOT+'/pulls/123'&&mergedPR)return{...r,state:'closed',merged:true,merge_commit_sha:merged};
  if(url.endsWith('/merge')){mergedPR=true;resolveMerge();}return r;
 };
 const config={origin:'https://studio.example',repository:'Tkkdy/tkkdyyy.github.io',repositoryId:1355866312,ownerId:144055705,branch:'main',allowMain:false,publicationMode:'pull-request',contentAutoMergeEnabled:true,clientId:'SYNTHETIC_CLIENT',clientSecret:'SYNTHETIC_SECRET'};
 const broker=createBroker(config,{fetchImpl:async(url,options)=>{
  if(url.endsWith('/access_token'))return Response.json({access_token:'SYNTHETIC_TOKEN',expires_in:1800,token_type:'bearer'});
  if(url.endsWith('/user'))return Response.json({id:144055705,login:'Tkkdy'});
  return Response.json(await github(url.replace('https://api.github.com',''),options));
 }});
 const req=(path,options={})=>new Request(config.origin+path,options);
 const start=await broker.handle(req('/auth/login')),state=new URL(start.headers.get('location')).searchParams.get('state');
 const callback=await broker.handle(req('/auth/callback?code=synthetic&state='+state,{headers:{cookie:start.headers.getSetCookie()[0].split(';')[0]}}));
 const cookie=callback.headers.getSetCookie().find(v=>v.startsWith('__Host-editorial-session='))?.split(';')[0];
 const session=await(await broker.handle(req('/api/session',{headers:{cookie}}))).json();assert.equal(session.contentAutoMergeEnabled,true);
 const headers={cookie,origin:config.origin,'x-admin-csrf':session.csrf};
 const request={requestId:branch.replace('codex/editorial-proposal-',''),expectedHeadOid:base,message:{headline:'Publish one click'},fileChanges:{additions:[{path,contents:raw.toString('base64')}],deletions:[]}};
 const results=await Promise.all([1,2].map(()=>broker.handle(req('/api/proposals',{method:'POST',headers,body:JSON.stringify(request)}))));
 const p=await results[0].json();assert.equal(results[0].status,200,JSON.stringify(p));assert.equal(p.publication.state,'WAITING');assert.equal(typeof p.recoveryReceipt,'string');assert(!JSON.stringify(p).includes('SYNTHETIC_TOKEN'));
 await Promise.race([done,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Synthetic merge not reached')),3000);t.unref();})]);
 assert.equal(writes(f).length,1);
 const count=writes(f).length;
 assert.equal((await broker.handle(req('/api/proposals/123/publish',{method:'POST',headers:{cookie},body:JSON.stringify({expectedSha:head})}))).status,403);
 assert.equal((await broker.handle(req('/api/proposals/123/publish',{method:'POST',headers,body:JSON.stringify({expectedSha:base})}))).status,403);
 assert.equal((await broker.handle(req('/api/proposals/123',{headers:{cookie}}))).status,200);
 assert.equal((await broker.handle(req('/api/proposals/restore',{method:'POST',headers,body:JSON.stringify({receipt:p.recoveryReceipt})}))).status,200);
 assert.equal(writes(f).length,count);
 assert.equal((await broker.handle(req('/api/logout',{method:'POST',headers}))).status,200);
 assert.equal((await broker.handle(req('/api/proposals/123/publish',{method:'POST',headers,body:JSON.stringify({expectedSha:head})}))).status,401);
});
test('explicit resume after failed CI revalidates without duplicating a pending task',async()=>{
 let failed=true;const f=fixture(({url,run})=>url.includes('/actions/workflows/')?{total_count:1,workflow_runs:[{...run,conclusion:failed?'failure':'success'}]}:undefined),tasks=[];
 const p=createContentPublisher({...f,enabled:true,schedule:f=>tasks.push(f),cancel:()=>{}});p.start(original);await tasks.shift()();assert.equal(p.status(123).state,'CI_FAILED');assert.equal(writes(f).length,0);
 failed=false;p.resume(original);p.resume(original);assert.equal(tasks.length,1);await tasks.shift()();assert.equal(p.status(123).state,'MERGED');assert.equal(writes(f).length,1);
});
