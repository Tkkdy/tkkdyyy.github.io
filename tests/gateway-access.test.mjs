import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {createGatewayVerifier} from '../ops/admin-broker/gateway-access.mjs';
import {createAdminServer} from '../ops/admin-broker/server.mjs';
const owner={allowedEmail:'owner@example.com',allowedUser:'Tkkdy',host:'editor.example',port:19445};
test('gateway verification trusts only loopback auth response, forwards only cookie, and fails closed',async()=>{
 let calls=0,status=202,email=owner.allowedEmail,user=owner.allowedUser;
 const verify=createGatewayVerifier(owner,{fetchImpl:async(url,options)=>{
  calls++;assert.equal(url,'http://127.0.0.1:19445/oauth2/auth');assert.equal(options.redirect,'manual');
  assert.deepEqual(options.headers,{host:'editor.example',cookie:'gateway=synthetic'});
  return new Response(null,{status,headers:{'x-auth-request-email':email,'x-auth-request-user':user}});
 }});
 const request=()=>new Request('https://editor.example/api/drafts',{headers:{cookie:'gateway=synthetic','x-auth-request-email':owner.allowedEmail,authorization:'Bearer fake','x-forwarded-host':'evil.example'}});
 assert.equal(await verify(new Request('https://editor.example',{headers:{'x-auth-request-email':owner.allowedEmail}})),false);assert.equal(calls,0);
 assert.equal(await verify(request()),true);
 for(const s of [200,302,401,403,500]){status=s;assert.equal(await verify(request()),false);}status=202;
 for(const e of ['other@example.com','OWNER@example.com','owner@example.com,other@example.com','']){email=e;assert.equal(await verify(request()),false);}email=owner.allowedEmail;
 user='someone-else';assert.equal(await verify(request()),false);
 assert.equal(await createGatewayVerifier(owner,{fetchImpl:async()=>{throw Error('gateway offline');}})(request()),false);
 for(const config of [{port:80},{port:'19445'},{host:'evil.example/path'},{allowedEmail:'a@b@c'},{allowedUser:''}])assert.throws(()=>createGatewayVerifier({...owner,...config}));
});

const binary=process.env.EDITORIAL_GATEWAY_TEST_BINARY;
test('real OAuth2 Proxy rejects outsiders and forged cookies before any private route; accepted owner still needs inner OAuth', {skip:!binary,timeout:45000},async t=>{
 const dir=await mkdtemp(join(tmpdir(),'editor-gateway-'));
 const servers=[],listen=async server=>{servers.push(server);await new Promise(r=>server.listen(0,'127.0.0.1',r));return server.address().port;};
 let gateway,brokerCalls=0,pkceVerified=0;
 t.after(async()=>{if(gateway&&gateway.exitCode===null){const exited=new Promise(r=>gateway.once('exit',r));gateway.kill();await exited;}await Promise.all(servers.map(s=>new Promise(r=>{s.closeAllConnections();s.close(r);})));await rm(dir,{recursive:true,force:true});});
 const identities={owner:{login:'Tkkdy',email:'owner@example.com',verified:true},other:{login:'OtherUser',email:'owner@example.com',verified:true},wrongmail:{login:'Tkkdy',email:'other@example.com',verified:true},unverified:{login:'Tkkdy',email:'owner@example.com',verified:false}};
 const challenges=new Map();
 const providerPort=await listen(http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://provider');
  const reply=(status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
  if(url.pathname==='/token'){
   let body='';for await(const c of req)body+=c;const form=new URLSearchParams(body);
   const code=form.get('code'),expected=challenges.get(code);
   if(!expected||createHash('sha256').update(form.get('code_verifier')||'').digest('base64url')!==expected)return reply(400,{error:'PKCE failed'});
   pkceVerified++;return reply(200,{access_token:code,token_type:'bearer'});
  }
  const token=(req.headers.authorization||'').replace(/^(?:Bearer|token)\s+/i,''),identity=identities[token];
  if(!identity)return reply(401,{message:'bad test token'});
  if(url.pathname==='/')return reply(200,{current_user_url:'synthetic'});
  if(url.pathname==='/user')return reply(200,{id:identity.login==='Tkkdy'?144055705:999,login:identity.login,email:identity.email});
  if(url.pathname==='/user/emails')return reply(200,[{email:identity.email,primary:true,verified:identity.verified}]);
  if(['/user/orgs','/user/teams'].includes(url.pathname))return reply(200,[]);
  reply(404,{message:'unhandled synthetic endpoint'});
 }));
 // Reserve a free loopback port, then let the child bind it.
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const gatewayPort=probe.address().port;await new Promise(r=>probe.close(r));
 const verifier=createGatewayVerifier({...owner,port:gatewayPort});
 await writeFile(join(dir,'index.html'),'PRIVATE EDITOR CONTENT');
 const broker={handle:async request=>{brokerCalls++;return Response.json({error:'Inner GitHub App login required'},{status:401});},authenticate:async()=>{throw Error();}};
 const brokerPort=await listen(await createAdminServer({origin:'https://editor.example',staticRoot:dir,broker,verifyAccess:verifier}));
 await writeFile(join(dir,'allowed-emails'),'owner@example.com\n');
 const args=[
 '--provider=github','--client-id=SYNTHETIC_OUTER_CLIENT','--client-secret=SYNTHETIC_OUTER_SECRET',
 '--github-user=Tkkdy','--scope=user:email read:org','--authenticated-emails-file='+join(dir,'allowed-emails'),
 '--http-address=127.0.0.1:'+gatewayPort,'--upstream=http://127.0.0.1:'+brokerPort+'/',
 '--redirect-url=http://editor.example/oauth2/callback','--login-url=http://127.0.0.1:'+providerPort+'/authorize',
 '--redeem-url=http://127.0.0.1:'+providerPort+'/token','--validate-url=http://127.0.0.1:'+providerPort+'/',
 '--cookie-secret='+randomBytes(32).toString('base64url'),'--cookie-secure=false','--cookie-name=synthetic-gateway',
 '--cookie-refresh=15m','--cookie-expire=8h','--cookie-csrf-per-request=true','--code-challenge-method=S256',
 '--skip-provider-button=true','--set-xauthrequest=true','--pass-user-headers=false','--pass-access-token=false',
 '--request-logging=false','--auth-logging=false','--api-route=^/api/'
 ];
 let startup='';gateway=spawn(binary,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
 gateway.stdout.on('data',c=>{startup+=c;});gateway.stderr.on('data',c=>{startup+=c;});
 const rawRequest=(port,path,headers={})=>new Promise((resolve,reject)=>{const req=http.get({host:'127.0.0.1',port,path,headers:{host:'editor.example',...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const h=new Headers();for(let i=0;i<res.rawHeaders.length;i+=2)h.append(res.rawHeaders[i],res.rawHeaders[i+1]);resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:h}));});});req.on('error',reject);});
 const request=(path,cookie='',extra={})=>rawRequest(gatewayPort,path,{...(cookie?{cookie}:{}),...extra});
 let ready=false;for(let i=0;i<80;i++){if(gateway.exitCode!==null)throw Error('Gateway startup failed: '+startup.slice(-1800));try{if((await request('/ping')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready,'Gateway ready');
 const direct=(path,headers={})=>rawRequest(brokerPort,path,headers);
 const outsiders={'x-auth-request-email':owner.allowedEmail,'x-auth-request-user':'Tkkdy','x-forwarded-user':'Tkkdy','x-forwarded-email':owner.allowedEmail};
 for(const path of ['/','/api/drafts','/auth/login']){
  assert.equal((await direct(path,outsiders)).status,403);
  const result=await request(path,'synthetic-gateway=forged',outsiders);assert([302,401,403].includes(result.status));assert(!(await result.text()).includes('PRIVATE EDITOR CONTENT'));
 }
 assert.equal(brokerCalls,0);
 let ownerCookie;const rejectionStatuses={};
 for(const identity of Object.keys(identities)){
  const start=await request('/oauth2/start?rd=%2F');assert.equal(start.status,302);
  const authorization=new URL(start.headers.get('location'));assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');
  challenges.set(identity,authorization.searchParams.get('code_challenge'));
  const csrf=start.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  const callback=await request('/oauth2/callback?code='+identity+'&state='+encodeURIComponent(authorization.searchParams.get('state')),csrf);
  if(identity==='owner'){
   assert.equal(callback.status,302,(await callback.text()).slice(-1800)+'\n'+startup.slice(-1800));ownerCookie=callback.headers.getSetCookie().filter(c=>c.startsWith('synthetic-gateway=')).map(c=>c.split(';')[0]).join('; ');assert(ownerCookie);
   }else{rejectionStatuses[identity]=callback.status;assert([403,500].includes(callback.status),identity+' must be denied');assert(!callback.headers.getSetCookie().some(c=>c.startsWith('synthetic-gateway=')&&!c.startsWith('synthetic-gateway=;')),'Rejected user gets no session');}
 }
 t.diagnostic('Synthetic rejected identities: '+JSON.stringify(rejectionStatuses));assert.equal(pkceVerified,4);
 const accepted=await request('/',ownerCookie);assert.equal(accepted.status,303);assert.equal(accepted.headers.get('location'),'/admin/');const privatePage=await request('/admin/',ownerCookie);assert.equal(privatePage.status,401);assert(!(await privatePage.text()).includes('PRIVATE EDITOR CONTENT'));
 const inner=await request('/api/drafts',ownerCookie);assert.equal(inner.status,401);assert.equal((await inner.json()).error,'Inner GitHub App login required');assert.equal(brokerCalls,1);
 assert.equal((await direct('/',{cookie:ownerCookie+'tamper'})).status,403);
 const fakeCallback=await request('/oauth2/callback?code=owner&state=forged%3Abad');assert.equal(fakeCallback.status,403);
 gateway.kill();await new Promise(r=>gateway.once('exit',r));gateway=null;
 assert.equal((await direct('/',{cookie:ownerCookie})).status,403);
});
