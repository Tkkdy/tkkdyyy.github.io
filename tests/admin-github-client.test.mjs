import test from 'node:test';import assert from 'node:assert/strict';import {createGitHubClient,readAdminSession,gitBlobSha} from '../src/lib/admin/github-content.mjs';
const sha='a'.repeat(40),next='b'.repeat(40);
test('browser client sends session-bound CSRF only to own origin and pins content reads and mutation to one head',async t=>{
 const original=globalThis.fetch,calls=[];t.after(()=>globalThis.fetch=original);
 globalThis.fetch=async(url,options)=>{calls.push({url,options});if(url==='/api/graphql')return Response.json({data:{createCommitOnBranch:{commit:{oid:next}}}});if(url.includes('/git/ref/'))return Response.json({object:{sha}});if(url.includes('/contents/'))return Response.json({type:'file',sha,content:btoa('body')});return Response.json({id:144055705});};
 const client=createGitHubClient({owner:'Tkkdy',repo:'tkkdyyy.github.io',branch:'codex/probe',csrf:'SYNTHETIC_CSRF'});assert.equal(await client.getHead(),sha);assert.equal((await client.readFile('src/content/essays/new.md',sha)).content,'body');
 assert.equal((await client.commitFiles({expectedHeadOid:sha,message:'Draft',files:[{path:'src/content/essays/new.md',contentBase64:btoa('body')}]})).sha,next);
 const mutation=calls.at(-1);assert.equal(mutation.url,'/api/graphql');assert.equal(mutation.options.headers['X-Admin-CSRF'],'SYNTHETIC_CSRF');const input=JSON.parse(mutation.options.body).variables.input;assert.equal(input.expectedHeadOid,sha);assert.equal(input.branch.branchName,'codex/probe');assert(calls.some(x=>x.url.endsWith('?ref='+sha)));assert(calls.every(x=>x.url.startsWith('/api/')&&!x.options.headers.Authorization));
 await assert.rejects(client.commitFiles({branch:'main',expectedHeadOid:sha,files:[]}),/分支/);
});
test('missing file remains distinguishable from authentication failure; GraphQL conflicts cannot report success',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);const client=createGitHubClient({owner:'Tkkdy',repo:'tkkdyyy.github.io',branch:'codex/probe',csrf:'CSRF'});
 globalThis.fetch=async()=>Response.json({error:'Missing'},{status:404});assert.equal(await client.readFile('new.md'),null);
 globalThis.fetch=async()=>Response.json({error:'Login'},{status:401});await assert.rejects(client.readFile('new.md'),e=>e.status===401);await assert.rejects(readAdminSession(),e=>e.status===401);
 globalThis.fetch=async()=>Response.json({errors:[{message:'Head moved'}]});await assert.rejects(client.commitFiles({expectedHeadOid:sha,message:'Draft',files:[]}),/尚未确认/);
});

test('Git blob identity matches the canonical hello newline object',async()=>{assert.equal(await gitBlobSha('hello\n'),'ce013625030ba8dba906f756967f9e9ca394464a');});

test('browser PR client uses only session CSRF, verifies proposal identity and never reports main deployment',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 const requestId='d8556e29-254b-4fe5-a949-09aa45ac8971',branch='codex/editorial-proposal-'+requestId;
 const calls=[],proposal={state:'PULL_REQUEST_OPEN',merged:false,deploymentConfirmed:false,commitSha:next,baseSha:sha,branch,pullRequestNumber:17,url:'https://github.com/Tkkdy/tkkdyyy.github.io/pull/17'};
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json(proposal);};
 const client=createGitHubClient({owner:'Tkkdy',repo:'tkkdyyy.github.io',branch:'main',csrf:'SYNTHETIC_CSRF'});
 const result=await client.proposeFiles({requestId,expectedHeadOid:sha,message:'Propose',files:[{path:'src/content/essays/new.md',contentBase64:btoa('fixture')}],deletePaths:[]});
 assert.equal(result.proposal.merged,false);assert.equal(result.sha,next);assert.equal(calls[0].url,'/api/proposals');assert.equal(calls[0].options.credentials,'same-origin');assert.equal(calls[0].options.headers['X-Admin-CSRF'],'SYNTHETIC_CSRF');assert(!calls[0].options.headers.Authorization);
 const body=JSON.parse(calls[0].options.body);assert.equal(body.requestId,requestId);assert.equal(body.expectedHeadOid,sha);assert(!body.branch);
 globalThis.fetch=async()=>Response.json({...proposal,url:'https://evil.example/'});
 await assert.rejects(client.proposeFiles({requestId,expectedHeadOid:sha,message:'Propose',files:[]}),/尚未核实/);
});

test('browser reads session PR status and rejects a malformed merged result',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);const client=createGitHubClient({owner:'Tkkdy',repo:'tkkdyyy.github.io',branch:'main',csrf:'CSRF'});let called;
 globalThis.fetch=async(url,options)=>{called={url,options};return Response.json({pullRequestNumber:17,state:'MERGED_ON_MAIN',merged:true,mergedSha:'c'.repeat(40),deploymentConfirmed:false});};
 assert.equal((await client.proposalStatus(17)).mergedSha,'c'.repeat(40));assert.equal(called.url,'/api/proposals/17');assert.equal(called.options.credentials,'same-origin');
 globalThis.fetch=async()=>Response.json({pullRequestNumber:17,state:'MERGED_ON_MAIN',merged:true,mergedSha:'main',deploymentConfirmed:false});await assert.rejects(client.proposalStatus(17),/尚未核实/);await assert.rejects(client.proposalStatus('../1'),/编号/);
});
