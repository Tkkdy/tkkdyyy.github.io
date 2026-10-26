import test from 'node:test';
import assert from 'node:assert/strict';
import {createContentProposalService} from '../ops/admin-broker/content-proposals.mjs';
const base='a'.repeat(40),next='b'.repeat(40),id='d8556e29-254b-4fe5-a949-09aa45ac8971',repo='Tkkdy/tkkdyyy.github.io',rid=1355866312;
const path='src/content/essays/proposal-test.md';
const markdown='---\ntitle: Proposal\nslug: proposal-test\nstatus: draft\npublishedAt: 2026-10-26\n---\nbody\n';
const request=()=>({requestId:id,expectedHeadOid:base,message:{headline:'Save isolated draft'},fileChanges:{additions:[{path,contents:Buffer.from(markdown).toString('base64')}],deletions:[]}});
function fixture(override=()=>undefined){
 const calls=[];let head=base,branch,mainReads=0;
 const github=async(url,options={})=>{
  const body=options.body?JSON.parse(options.body):null;calls.push({url,method:options.method||'GET',body});
  const injected=await override({url,options,body,mainReads,calls});if(injected!==undefined)return injected;
  if(url==='/repos/'+repo)return {id:rid,full_name:repo,owner:{id:144055705}};
  if(url.endsWith('/git/ref/heads/main')){mainReads++;return {object:{type:'commit',sha:base}};}
  if(url.endsWith('/git/refs')){branch=body.ref.slice('refs/heads/'.length);return {ref:body.ref,object:{sha:base}};}
  if(url==='/graphql'){head=next;return {data:{createCommitOnBranch:{commit:{oid:next}}}};}
  if(url.endsWith('/git/ref/heads/'+branch))return {object:{sha:head}};
  if(url.includes('/compare/'))return {status:'ahead',behind_by:0,total_commits:1,commits:[{sha:next}],files:[{filename:path,status:'added'}]};
  if(url.endsWith('/pulls'))return {number:17,state:'open',merged:false,head:{ref:branch,sha:next,repo:{id:rid}},base:{ref:'main',sha:base,repo:{id:rid}},html_url:'https://github.com/'+repo+'/pull/17'};
  throw Error('Unexpected fixture request '+url);
 };
 return {github,calls};
}
test('disabled by default and invalid content cannot touch GitHub',async()=>{
 const f=fixture();await assert.rejects(createContentProposalService({github:f.github}).submit(request()),/尚未启用/);
 const service=createContentProposalService({...f,enabled:true});
 for(const patch of [{requestId:'../main'},{expectedHeadOid:'main'},{branch:'main'},{fileChanges:{additions:[{path:'.github/workflows/deploy.yml',contents:'eA=='}]}},{fileChanges:{additions:[{path:'public/uploads/x.svg',contents:Buffer.from('<svg onload="x"></svg>').toString('base64')}]}}])await assert.rejects(service.submit({...request(),...patch}));
 assert.equal(f.calls.length,0);
});
test('successful proposal pins base, writes only server-named branch and reports neither merge nor deployment',async()=>{
 const f=fixture();const result=await createContentProposalService({...f,enabled:true}).submit(request());
 assert.equal(result.state,'PULL_REQUEST_OPEN');assert.equal(result.merged,false);assert.equal(result.deploymentConfirmed,false);assert.equal(result.baseSha,base);assert.equal(result.commitSha,next);
 const writes=f.calls.filter(c=>c.method==='POST');assert.deepEqual(writes.map(c=>c.url),['/repos/'+repo+'/git/refs','/graphql','/repos/'+repo+'/pulls']);
 assert.equal(writes[0].body.sha,base);assert(writes[0].body.ref.startsWith('refs/heads/codex/editorial-proposal-'));
 assert.equal(writes[1].body.variables.input.expectedHeadOid,base);assert.notEqual(writes[1].body.variables.input.branch.branchName,'main');
 assert.equal(writes[2].body.base,'main');assert(f.calls.every(c=>!['PATCH','DELETE','PUT'].includes(c.method)));
});
test('concurrent duplicate click creates one branch, one commit and one PR',async()=>{
 const f=fixture(),service=createContentProposalService({...f,enabled:true});
 const result=await Promise.all([service.submit(request()),service.submit(request())]);assert.deepEqual(result[0],result[1]);assert.equal(f.calls.filter(c=>c.method==='POST').length,3);
 await service.submit(request());assert.equal(f.calls.filter(c=>c.method==='POST').length,3);
 await assert.rejects(service.submit({...request(),message:{headline:'Different content'}}),/相同请求标识/);
});
test('repository transfer and stale main stop before any write',async()=>{
 for(const replacement of [{id:1,full_name:repo,owner:{id:144055705}},{id:rid,full_name:repo,owner:{id:1}},{object:{type:'commit',sha:next}}]){
  const f=fixture(({url})=>url.endsWith('/main')?replacement.object?replacement:undefined:replacement.object?undefined:replacement);
  await assert.rejects(createContentProposalService({...f,enabled:true}).submit(request()),e=>e.phase==='READ_BASE');assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 }
});
test('ambiguous branch creation failure is retained and never blindly retried or deleted',async()=>{
 const f=fixture(({url})=>{if(url.endsWith('/git/refs'))throw Error('SYNTHETIC_UPSTREAM_SECRET_MUST_NOT_ESCAPE');});const service=createContentProposalService({...f,enabled:true});
 for(let i=0;i<2;i++)await assert.rejects(service.submit(request()),e=>e.phase==='CREATE_CONTENT_BRANCH'&&e.automaticRetry===false&&!e.message.includes('SYNTHETIC_UPSTREAM'));
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert(!f.calls.some(c=>c.method==='DELETE'));
});
test('head conflicts, unexpected code diff and moving main cannot create a PR',async()=>{
 const overrides=[({url})=>url==='/graphql'?{errors:[{message:'head conflict'}]}:undefined,({url})=>url.includes('/compare/')?{status:'ahead',behind_by:0,total_commits:1,commits:[{sha:next}],files:[{filename:'.github/workflows/deploy.yml',status:'modified'}]}:undefined,({url,mainReads})=>url.endsWith('/main')&&mainReads===1?{object:{type:'commit',sha:next}}:undefined];
 for(const override of overrides){const f=fixture(override);await assert.rejects(createContentProposalService({...f,enabled:true}).submit(request()),e=>e.code==='PROPOSAL_STOPPED_NO_RETRY');assert(!f.calls.some(c=>c.url.endsWith('/pulls')));}
});
test('PR creation timeout does not replay commit or claim publication',async()=>{
 const f=fixture(({url})=>{if(url.endsWith('/pulls'))throw Error('ambiguous timeout');}),service=createContentProposalService({...f,enabled:true});
 for(let i=0;i<2;i++)await assert.rejects(service.submit(request()),e=>e.phase==='CREATE_PULL_REQUEST'&&e.commitSha===next);
 assert.equal(f.calls.filter(c=>c.url==='/graphql').length,1);assert.equal(f.calls.filter(c=>c.url.endsWith('/pulls')).length,1);
});
test('untrusted PR URL or head cannot be displayed as success',async()=>{
 const f=fixture(({url})=>url.endsWith('/pulls')?{number:1,state:'open',merged:false,head:{ref:'other',sha:next,repo:{id:rid}},base:{ref:'main',sha:base,repo:{id:rid}},html_url:'https://evil.example/'}:undefined);
 await assert.rejects(createContentProposalService({...f,enabled:true}).submit(request()),e=>e.phase==='CREATE_PULL_REQUEST');
});
import {createBroker} from '../ops/admin-broker/core.mjs';
function brokerFixture(mode='pull-request'){
 const upstream=fixture();
 const config={origin:'https://studio.example',repository:repo,repositoryId:rid,ownerId:144055705,branch:mode==='pull-request'?'main':'codex/test',allowMain:false,clientId:'SYNTHETIC_CLIENT',clientSecret:'SYNTHETIC_SECRET',publicationMode:mode};
 const broker=createBroker(config,{fetchImpl:async(url,options)=>{
  if(url.endsWith('/access_token'))return Response.json({access_token:'SYNTHETIC_SERVER_TOKEN',expires_in:1800,token_type:'bearer'});
  if(url.endsWith('/user'))return Response.json({id:144055705,login:'Tkkdy'});
  return Response.json(await upstream.github(url.replace('https://api.github.com',''),options));
 }});
 const req=(path,options={})=>new Request(config.origin+path,options);
 async function login(){
  const start=await broker.handle(req('/auth/login')),state=new URL(start.headers.get('location')).searchParams.get('state');
  const callback=await broker.handle(req('/auth/callback?code=synthetic&state='+state,{headers:{cookie:start.headers.getSetCookie()[0].split(';')[0]}}));assert.equal(callback.status,303);
  const cookie=callback.headers.getSetCookie().find(v=>v.startsWith('__Host-editorial-session='))?.split(';')[0];
  const session=await(await broker.handle(req('/api/session',{headers:{cookie}}))).json();
  return {cookie,session,headers:{cookie,origin:config.origin,'x-admin-csrf':session.csrf}};
 }
 return {broker,req,login,calls:upstream.calls};
}
test('HTTP PR endpoint requires owner session, exact Origin and CSRF before upstream writes',async()=>{
 const f=brokerFixture();assert.equal((await f.broker.handle(f.req('/api/proposals',{method:'POST',body:JSON.stringify(request())}))).status,401);
 const auth=await f.login();assert.equal(auth.session.branch,'main');assert.equal(auth.session.publicationMode,'pull-request');assert(!JSON.stringify(auth.session).includes('SYNTHETIC_SERVER_TOKEN'));
 const before=f.calls.length;
 for(const headers of [{cookie:auth.cookie},{...auth.headers,origin:'https://public.example'},{...auth.headers,'x-admin-csrf':'wrong'}])assert.equal((await f.broker.handle(f.req('/api/proposals',{method:'POST',headers,body:JSON.stringify(request())}))).status,403);
 assert.equal(f.calls.length,before);
 const result=await f.broker.handle(f.req('/api/proposals',{method:'POST',headers:auth.headers,body:JSON.stringify(request())}));assert.equal(result.status,200);assert.equal((await result.json()).state,'PULL_REQUEST_OPEN');
 const writes=f.calls.filter(c=>c.method==='POST');assert.equal(writes.length,3);
 const direct={branch:{repositoryNameWithOwner:repo,branchName:'main'},expectedHeadOid:base,message:{headline:'Unsafe direct'},fileChanges:request().fileChanges};
 const mutation=await f.broker.handle(f.req('/api/graphql',{method:'POST',headers:auth.headers,body:JSON.stringify({query:'mutation($input:CreateCommitOnBranchInput!){createCommitOnBranch(input:$input){commit{oid}}}',variables:{input:direct}})}));
 assert.equal(mutation.status,403);assert.equal(f.calls.filter(c=>c.method==='POST').length,3);
});
test('legacy test-branch mode does not enable PR permissions and unsafe mode combinations refuse startup',async()=>{
 const f=brokerFixture('direct'),auth=await f.login();const before=f.calls.length;
 assert.equal((await f.broker.handle(f.req('/api/proposals',{method:'POST',headers:auth.headers,body:JSON.stringify(request())}))).status,403);assert.equal(f.calls.length,before);
 const cfg={origin:'https://studio.example',repository:repo,repositoryId:rid,ownerId:144055705,branch:'main',clientId:'synthetic',clientSecret:'synthetic'};
 assert.throws(()=>createBroker({...cfg,publicationMode:'pull-request',allowMain:true}),/禁止直接/);
 assert.throws(()=>createBroker({...cfg,publicationMode:'unknown'}),/模式/);
});
