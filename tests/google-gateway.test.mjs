import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,createHash,randomBytes,sign} from 'node:crypto';
import {createGatewayVerifier} from '../ops/admin-broker/gateway-access.mjs';
import {createAdminServer} from '../ops/admin-broker/server.mjs';

test('Google gateway requires an exact Gmail and a subject from the independently validated session',async()=>{
 const config={identityProvider:'google-oidc',port:19445,host:'editor.example',allowedEmail:'owner@gmail.com'};
 let email=config.allowedEmail,user='123456789012345678901';
 const verify=createGatewayVerifier(config,{fetchImpl:async()=>new Response(null,{status:202,headers:{'x-auth-request-email':email,'x-auth-request-user':user}})});
 const request=new Request('https://editor.example',{headers:{cookie:'synthetic=only'}});
 assert.equal(await verify(request),true);
 for(const other of ['other@gmail.com','owner@example.com','OWNER@gmail.com']){email=other;assert.equal(await verify(request),false);}email=config.allowedEmail;
 for(const invalid of ['','Tkkdy','123','123456,evil']){user=invalid;assert.equal(await verify(request),false);}
 assert.throws(()=>createGatewayVerifier({...config,allowedEmail:'owner@example.com'}));
 assert.throws(()=>createGatewayVerifier({...config,identityProvider:'untrusted'}));
});

const binary=process.env.EDITORIAL_GATEWAY_TEST_BINARY;
test('real OIDC gateway verifies signature, issuer, audience, expiry, nonce and verified exact email before inner GitHub login',{skip:!binary,timeout:45000},async t=>{
 const dir=await mkdtemp(join(tmpdir(),'google-editor-gateway-')),servers=[];
 let gateway,innerCalls=0,pkceVerified=0;
 t.after(async()=>{if(gateway&&gateway.exitCode===null){const exited=new Promise(r=>gateway.once('exit',r));gateway.kill();await exited;}await Promise.all(servers.map(s=>new Promise(r=>{s.closeAllConnections();s.close(r);})));await rm(dir,{recursive:true,force:true});});
 const listen=async s=>{servers.push(s);await new Promise(r=>s.listen(0,'127.0.0.1',r));return s.address().port;};
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}),badKey=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey;
 const jwk={...publicKey.export({format:'jwk'}),kid:'synthetic-key',alg:'RS256',use:'sig'},flows=new Map();
 let issuer;
 const providerPort=await listen(http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://synthetic');
  const reply=(status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
  if(url.pathname==='/.well-known/openid-configuration')return reply(200,{issuer,authorization_endpoint:issuer+'/authorize',token_endpoint:issuer+'/token',jwks_uri:issuer+'/jwks',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256'],code_challenge_methods_supported:['S256']});
  if(url.pathname==='/jwks')return reply(200,{keys:[jwk]});
  if(url.pathname==='/token'){
   let body='';for await(const c of req)body+=c;const params=new URLSearchParams(body),code=params.get('code'),flow=flows.get(code);
   if(!flow||createHash('sha256').update(params.get('code_verifier')||'').digest('base64url')!==flow.challenge)return reply(400,{error:'PKCE failed'});
   pkceVerified++;const now=Math.floor(Date.now()/1000);
   const claims={iss:issuer,aud:'SYNTHETIC_GOOGLE_CLIENT',sub:'123456789012345678901',email:'owner@gmail.com',email_verified:true,iat:now,exp:now+3600,nonce:flow.nonce};
   if(code==='other')claims.email='other@gmail.com';
   if(code==='unverified')claims.email_verified=false;
   if(code==='wrong-audience')claims.aud='another-client';
   if(code==='wrong-issuer')claims.iss='https://untrusted.example';
   if(code==='expired')claims.exp=now-60;
   if(code==='wrong-nonce')claims.nonce='not-the-requested-nonce';
   const parts=[{alg:'RS256',kid:'synthetic-key'},claims].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url'));
   parts.push(sign('RSA-SHA256',Buffer.from(parts.join('.')),code==='bad-signature'?badKey:privateKey).toString('base64url'));
   return reply(200,{access_token:'SYNTHETIC',token_type:'Bearer',expires_in:3600,id_token:parts.join('.')});
  }
  reply(404,{error:'unsupported synthetic endpoint'});
 }));
 issuer='http://127.0.0.1:'+providerPort;
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const verifyAccess=createGatewayVerifier({identityProvider:'google-oidc',port,host:'editor.example',allowedEmail:'owner@gmail.com'});
 const broker={handle:async()=>{innerCalls++;return Response.json({error:'Inner GitHub App required'},{status:401});},authenticate:async()=>{throw Error();}};
 const brokerPort=await listen(await createAdminServer({origin:'https://editor.example',staticRoot:dir,broker,verifyAccess}));
 await writeFile(join(dir,'emails'),'owner@gmail.com\n');
 const args=['--provider=oidc','--oidc-issuer-url='+issuer,'--client-id=SYNTHETIC_GOOGLE_CLIENT','--client-secret=SYNTHETIC_SECRET','--scope=openid email profile','--insecure-oidc-skip-nonce=false','--insecure-oidc-allow-unverified-email=false','--skip-claims-from-profile-url=true','--authenticated-emails-file='+join(dir,'emails'),'--http-address=127.0.0.1:'+port,'--upstream=http://127.0.0.1:'+brokerPort+'/','--redirect-url=http://editor.example/oauth2/callback','--cookie-secret='+randomBytes(32).toString('base64url'),'--cookie-secure=false','--cookie-name=synthetic-google','--set-xauthrequest=true','--pass-user-headers=false','--code-challenge-method=S256','--cookie-csrf-per-request=true','--skip-provider-button=true','--api-route=^/api/','--request-logging=false','--auth-logging=false'];
 let log='';gateway=spawn(binary,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});gateway.stdout.on('data',c=>{log+=c;});gateway.stderr.on('data',c=>{log+=c;});
 const request=(targetPort,path,cookie='',extra={})=>new Promise((resolve,reject)=>{const r=http.get({host:'127.0.0.1',port:targetPort,path,headers:{host:'editor.example',...(cookie?{cookie}:{}),...extra}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const h=new Headers();for(let i=0;i<res.rawHeaders.length;i+=2)h.append(res.rawHeaders[i],res.rawHeaders[i+1]);resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:h}));});});r.on('error',reject);});
 let ready=false;for(let i=0;i<100;i++){if(gateway.exitCode!==null)throw Error('Gateway startup failed: '+log.slice(-1200));try{if((await request(port,'/ping')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready);
 assert.equal((await request(brokerPort,'/api/drafts','',{'x-auth-request-email':'owner@gmail.com','x-auth-request-user':'123456789012345678901'})).status,403);
 assert.equal((await request(port,'/api/drafts')).status,401);
 const cases=['owner','other','unverified','wrong-audience','wrong-issuer','expired','wrong-nonce','bad-signature'],statuses={};let cookie;
 for(const code of cases){
  const start=await request(port,'/oauth2/start?rd=%2F');assert.equal(start.status,302);
  const url=new URL(start.headers.get('location'));assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert(url.searchParams.get('nonce'));
  flows.set(code,{challenge:url.searchParams.get('code_challenge'),nonce:url.searchParams.get('nonce')});
  const csrf=start.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  const result=await request(port,'/oauth2/callback?code='+code+'&state='+encodeURIComponent(url.searchParams.get('state')),csrf);
  statuses[code]=result.status;
  const issued=result.headers.getSetCookie().filter(c=>c.startsWith('synthetic-google=')&&!c.startsWith('synthetic-google=;'));
  if(code==='owner'){assert.equal(result.status,302,log.slice(-1000));assert.equal(issued.length,1);cookie=issued[0].split(';')[0];}
  else{assert([403,500].includes(result.status),code+' denied');assert.equal(issued.length,0);}
 }
 assert.equal(pkceVerified,cases.length);assert.equal(innerCalls,0);
 assert.equal((await request(port,'/',cookie)).status,303);
 assert.equal((await request(port,'/api/drafts',cookie)).status,401);assert.equal(innerCalls,1);
 assert.equal((await request(brokerPort,'/api/drafts',cookie+'tamper')).status,403);
 t.diagnostic('Synthetic OIDC callback statuses: '+JSON.stringify(statuses));
});
