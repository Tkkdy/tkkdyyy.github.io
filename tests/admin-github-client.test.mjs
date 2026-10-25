import test from 'node:test';import assert from 'node:assert/strict';import {createGitHubClient,readAdminSession} from '../src/lib/admin/github-content.mjs';
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
