import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {createBroker} from '../ops/admin-broker/core.mjs';
const cfg={origin:'https://studio.example',repository:'Tkkdy/tkkdyyy.github.io',repositoryId:1355866312,ownerId:144055705,branch:'codex/admin-probe',allowMain:false,clientId:'SYNTHETIC_CLIENT',clientSecret:'SYNTHETIC_SERVER_SECRET'};
function fixture(options={}){
 const user=options.user??144055705,expires='expires' in options?options.expires:28800;
 let now=0;const calls=[];const broker=createBroker(cfg,{clock:()=>now,fetchImpl:async(url,options)=>{
  calls.push({url,options});const data=url.endsWith('/access_token')?{access_token:'SYNTHETIC_GITHUB_TOKEN',refresh_token:'SYNTHETIC_REFRESH',expires_in:expires,token_type:'bearer'}:url.endsWith('/user')?{id:user,login:'Tkkdy'}:url.endsWith('/graphql')?{data:{repository:{name:'tkkdyyy.github.io'}}}:{id:cfg.repositoryId,full_name:cfg.repository};return Response.json(data);
 }});
 const req=(path,options={})=>new Request(cfg.origin+path,options);
 async function start(){const result=await broker.handle(req('/auth/login?back=/admin/'));return {result,url:new URL(result.headers.get('location')),cookie:result.headers.getSetCookie()[0].split(';')[0]};}
 async function login(){const initial=await start(),callback=await broker.handle(req('/auth/callback?code=synthetic-code&state='+initial.url.searchParams.get('state'),{headers:{cookie:initial.cookie}}));const cookie=callback.headers.getSetCookie().find(x=>x.startsWith('__Host-editorial-session='))?.split(';')[0];return {initial,callback,cookie};}
 return {broker,calls,req,start,login,setNow:n=>now=n};
}
test('login uses PKCE; callback is cookie-bound and one-use; raw credentials never reach browser',async()=>{
 const f=fixture(),s=await f.login();assert.equal(s.callback.status,303);assert(s.cookie);assert(s.callback.headers.getSetCookie().some(x=>/HttpOnly/.test(x)&&/Secure/.test(x)));const exchange=JSON.parse(f.calls[0].options.body);
 assert.equal(createHash('sha256').update(exchange.code_verifier).digest('base64url'),s.initial.url.searchParams.get('code_challenge'));assert.equal(exchange.repository_id,cfg.repositoryId);
 const response=await f.broker.handle(f.req('/api/session',{headers:{cookie:s.cookie}}));const body=await response.text();assert.equal(response.status,200);for(const secret of ['SYNTHETIC_GITHUB_TOKEN','SYNTHETIC_REFRESH','SYNTHETIC_SERVER_SECRET'])assert(!body.includes(secret));assert(JSON.parse(body).csrf);
 const replay=await f.broker.handle(f.req('/auth/callback?code=again&state='+s.initial.url.searchParams.get('state'),{headers:{cookie:s.initial.cookie}}));assert.equal(replay.status,403);
});
test('wrong cookie, cross-origin callback state theft and external return redirect fail before credential exchange',async()=>{
 const f=fixture(),s=await f.start();const result=await f.broker.handle(f.req('/auth/callback?code=theft&state='+s.url.searchParams.get('state'),{headers:{cookie:'wrong=value'}}));assert.equal(result.status,403);assert.equal(f.calls.length,0);
 for(const back of ['https://evil.example','//evil.example','/api/session'])assert.equal((await f.broker.handle(f.req('/auth/login?back='+encodeURIComponent(back)))).status,403);
});
test('non-owner and tokens without expiry cannot create an authenticated session',async()=>{
 for(const options of [{user:1},{expires:undefined},{expires:0}]){const f=fixture(options),s=await f.login();assert.equal(s.callback.status,403);assert(!s.cookie);}
});
test('missing session returns401 and expired sessions cannot read or publish',async()=>{
 const f=fixture();assert.equal((await f.broker.handle(f.req('/api/session'))).status,401);const s=await f.login();f.setNow(1800001);assert.equal((await f.broker.handle(f.req('/api/session',{headers:{cookie:s.cookie}}))).status,401);
});
test('same-site sibling and missing CSRF cannot invoke even GraphQL reads',async()=>{
 const f=fixture(),s=await f.login(),session=await (await f.broker.handle(f.req('/api/session',{headers:{cookie:s.cookie}}))).json();const before=f.calls.length;
 for(const headers of [{cookie:s.cookie,origin:'https://public.example','x-admin-csrf':session.csrf},{cookie:s.cookie,origin:cfg.origin}])assert.equal((await f.broker.handle(f.req('/api/graphql',{method:'POST',headers,body:JSON.stringify({query:'query {repository(owner:"Tkkdy",name:"tkkdyyy.github.io"){name}}'})}))).status,403);
 assert.equal(f.calls.length,before);
});
test('only cookie plus session-bound CSRF reaches server-side GitHub credential, and logout revokes it',async()=>{
 const f=fixture(),s=await f.login(),session=await (await f.broker.handle(f.req('/api/session',{headers:{cookie:s.cookie}}))).json();const headers={cookie:s.cookie,origin:cfg.origin,authorization:'Bearer '+session.csrf};
 const result=await f.broker.handle(f.req('/api/graphql',{method:'POST',headers,body:JSON.stringify({query:'query {repository(owner:"Tkkdy",name:"tkkdyyy.github.io"){name}}'})}));assert.equal(result.status,200);assert.equal(f.calls.at(-1).options.headers.Authorization,'Bearer SYNTHETIC_GITHUB_TOKEN');assert(!(await result.text()).includes('SYNTHETIC_GITHUB_TOKEN'));
 assert.equal((await f.broker.handle(f.req('/api/logout',{method:'POST',headers}))).status,200);assert.equal((await f.broker.handle(f.req('/api/session',{headers:{cookie:s.cookie}}))).status,401);
});
test('host mismatch and arbitrary REST methods/other repositories are refused',async()=>{
 const f=fixture(),s=await f.login();assert.equal((await f.broker.handle(new Request('https://evil.example/api/session',{headers:{cookie:s.cookie}}))).status,403);
 for(const [path,method]of [['/api/v3/repos/other/repo','GET'],['/api/v3/repos/Tkkdy/tkkdyyy.github.io/git/refs/heads/main','PATCH']]){const r=await f.broker.handle(f.req(path,{method,headers:{cookie:s.cookie}}));assert([403,404].includes(r.status));}
});

test('Sveltia popup bridge exposes only session CSRF, with exact opener origin and hashed inline CSP',async()=>{
 const f=fixture(),s=await f.login();const session=await(await f.broker.handle(f.req('/api/session',{headers:{cookie:s.cookie}}))).json();
 const response=await f.broker.handle(f.req('/auth/sveltia',{headers:{cookie:s.cookie}}));assert.equal(response.status,200);const html=await response.text();assert(html.includes(session.csrf));assert(html.includes('event.origin===origin&&event.source===window.opener'));assert(!html.includes('SYNTHETIC_GITHUB_TOKEN'));assert(!html.includes('SYNTHETIC_REFRESH'));assert.match(response.headers.get('content-security-policy'),/script-src 'sha256-/);
 assert.equal((await f.broker.handle(f.req('/auth/sveltia'))).status,401);
});

test('Sveltia token scheme still requires the exact session CSRF and only owner collaborator lookup is readable',async()=>{
 const f=fixture(),s=await f.login(),session=await(await f.broker.handle(f.req('/api/session',{headers:{cookie:s.cookie}}))).json();
 const query={query:'query {repository(owner:"Tkkdy",name:"tkkdyyy.github.io"){name}}'};
 assert.equal((await f.broker.handle(f.req('/api/graphql',{method:'POST',headers:{cookie:s.cookie,origin:cfg.origin,authorization:'token '+session.csrf},body:JSON.stringify(query)}))).status,200);
 assert.equal((await f.broker.handle(f.req('/api/v3/repos/'+cfg.repository+'/collaborators/Tkkdy',{headers:{cookie:s.cookie}}))).status,200);
 assert.equal((await f.broker.handle(f.req('/api/v3/repos/'+cfg.repository+'/collaborators/another-user',{headers:{cookie:s.cookie}}))).status,403);
});
