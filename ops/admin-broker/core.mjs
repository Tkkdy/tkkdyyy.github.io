import {inspectTargets} from './deployment-status.mjs';
/** OAuth/session core. GitHub tokens stay server-side; no refresh token persistence. */
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {requirePolicy,authorizeGraphql} from './policy.mjs';
const nonce=()=>randomBytes(32).toString('base64url');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
function cookies(request){return Object.fromEntries((request.headers.get('cookie')||'').split(';').map(x=>x.trim().split(/=(.*)/s)).filter(x=>x.length>1).map(([k,v])=>[k,v]));}
function boundedJSON(request,limit=30_000_000){return request.text().then(raw=>{requirePolicy(Buffer.byteLength(raw)<=limit,'请求体过大。');return JSON.parse(raw);});}
export function createBroker(config,{fetchImpl=fetch,clock=()=>Date.now()}={}){
 const origin=new URL(config.origin);requirePolicy(origin.origin===config.origin&&origin.pathname==='/'&&!origin.username&&!origin.password,'认证服务地址必须是纯origin。');
 const local=['127.0.0.1','localhost'].includes(origin.hostname);requirePolicy(origin.protocol==='https:'||local&&origin.protocol==='http:','仅回环服务可使用HTTP。');
 requirePolicy(config.repository==='Tkkdy/tkkdyyy.github.io'&&config.repositoryId===1355866312&&config.ownerId===144055705,'仓库或所有者身份不匹配。');
 requirePolicy(config.clientId&&config.clientSecret&&config.branch,'缺少App配置。');requirePolicy(config.branch!=='main'||config.allowMain===true,'main写入尚未批准。');
 const sessions=new Map(),flows=new Map(),cookieName=local?'editorial-local-session':'__Host-editorial-session',flowCookie=local?'editorial-local-oauth':'__Host-editorial-oauth';
 const cookie=(name,value,seconds)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${origin.protocol==='https:'?'; Secure':''}`;
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
 const response=(body,status=200,extra={})=>new Response(body===null?null:JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8',...extra}});
 const redirect=(path,extra={})=>new Response(null,{status:303,headers:{...headers,Location:new URL(path,origin).href,...extra}});
 function purge(){for(const map of [sessions,flows])for(const [key,value]of map)if(value.expires<=clock())map.delete(key);}
 function session(request){const id=cookies(request)[cookieName],value=sessions.get(id);if(!value||value.expires<=clock())throw Object.assign(Error('需要登录。'),{status:401});return {id,...value};}
 function mutationGuard(request,value){requirePolicy(request.headers.get('origin')===config.origin,'请求来源不匹配。');const candidate=request.headers.get('x-admin-csrf')??request.headers.get('authorization')?.replace(/^(?:Bearer|token) /i,'');requirePolicy(equal(candidate,value.csrf),'安全校验失效，请重新登录。');}
 async function remote(url,options={}){
  const r=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(20000),...options});const raw=await r.text();requirePolicy(Buffer.byteLength(raw)<=25_000_000,'上游响应过大。');
  if(!r.ok)throw Object.assign(Error('GitHub服务请求失败。'),{status:[401,404].includes(r.status)?r.status:502});return raw?JSON.parse(raw):null;
 }
 async function github(path,token,options={}){return remote('https://api.github.com'+path,{...options,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'editorial-owner-broker',Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});}
 function publicSession(s){return {authenticated:true,user:s.user,csrf:s.csrf,repository:config.repository,branch:config.branch,expiresAt:s.expires};}
 return {
  async authenticate(request){purge();requirePolicy(new URL(request.url).origin===config.origin,'Host不匹配。');return publicSession(session(request));},
  async handle(request){
   purge();try{
    const url=new URL(request.url);requirePolicy(url.origin===config.origin,'Host不匹配。');const path=url.pathname;
    if(path==='/auth/login'&&request.method==='GET'){
     requirePolicy(flows.size<40,'登录尝试过多，请稍后操作。');const state=nonce(),verifier=nonce(),back=url.searchParams.get('back')||'/admin/';requirePolicy(back.startsWith('/admin/')&&!back.startsWith('//')&&!/[\r\n\\]/.test(back),'返回地址不允许。');
     flows.set(state,{verifier,back,expires:clock()+300000});const authorize=new URL('https://github.com/login/oauth/authorize');for(const [key,value]of Object.entries({client_id:config.clientId,redirect_uri:config.origin+'/auth/callback',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',login:'Tkkdy',allow_signup:'false'}))authorize.searchParams.set(key,value);
     return new Response(null,{status:303,headers:{...headers,Location:authorize.href,'Set-Cookie':cookie(flowCookie,state,300)}});
    }
    if(path==='/auth/callback'&&request.method==='GET'){
     const state=url.searchParams.get('state'),flow=flows.get(state);requirePolicy(flow&&flow.expires>clock()&&equal(cookies(request)[flowCookie],state),'登录会话不匹配或已过期。');flows.delete(state);
     const code=url.searchParams.get('code');requirePolicy(typeof code==='string'&&code.length<2048&&code.length>0,'缺少登录授权。');
     const token=await remote('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:config.clientId,client_secret:config.clientSecret,code,redirect_uri:config.origin+'/auth/callback',code_verifier:flow.verifier,repository_id:config.repositoryId})});
     requirePolicy(typeof token.access_token==='string'&&token.token_type==='bearer'&&Number.isFinite(token.expires_in)&&token.expires_in>0,'App必须启用短期用户令牌。');
     const user=await github('/user',token.access_token);requirePolicy(user.id===config.ownerId,'此账号不是站点所有者。');
     const repo=await github('/repos/'+config.repository,token.access_token);requirePolicy(repo.id===config.repositoryId&&repo.full_name===config.repository,'目标仓库不匹配。');
     requirePolicy(sessions.size<30,'登录会话过多。');const id=nonce(),s={csrf:nonce(),token:token.access_token,user:{id:user.id,login:user.login},expires:clock()+Math.min(1800,token.expires_in)*1000};sessions.set(id,s);
     const result=redirect(flow.back);result.headers.append('Set-Cookie',cookie(cookieName,id,1800));result.headers.append('Set-Cookie',cookie(flowCookie,'',0));return result;
    }
    const s=session(request);
    if(path==='/auth/sveltia'&&request.method==='GET'){
     const script=`const origin=${JSON.stringify(config.origin)};const payload=${JSON.stringify({token:s.csrf,provider:'github'})};if(window.opener){addEventListener('message',event=>{if(event.origin===origin&&event.source===window.opener&&event.data==='authorizing:github'){window.opener.postMessage('authorization:github:success:'+JSON.stringify(payload),origin);window.close();}});window.opener.postMessage('authorizing:github',origin);}`;
     const hash=createHash('sha256').update(script).digest('base64');
     return new Response('<!doctype html><meta charset="utf-8"><title>连接编辑器</title><p>正在连接已登录会话。</p><script>'+script+'</script>',{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'sha256-${hash}'; frame-ancestors 'none'; base-uri 'none'`}});
    }
    if(path==='/api/deployments'&&request.method==='GET'){const expectedSha=url.searchParams.get('sha');requirePolicy(/^[a-f0-9]{40}$/.test(expectedSha||''),'提交版本无效。');return response({targets:await inspectTargets({targets:config.targets,branch:config.branch,expectedSha,fetchImpl})});}
    if(path==='/api/session'&&request.method==='GET')return response(publicSession(s));
    if(path==='/api/logout'&&request.method==='POST'){mutationGuard(request,s);sessions.delete(s.id);return response({loggedOut:true},200,{'Set-Cookie':cookie(cookieName,'',0)});}
    if(path==='/api/graphql'&&request.method==='POST'){
     mutationGuard(request,s);const body=await boundedJSON(request);authorizeGraphql(body,config);return response(await github('/graphql',s.token,{method:'POST',body:JSON.stringify(body)}));
    }
    if(path.startsWith('/api/v3/')&&request.method==='GET'){
     const route=decodeURIComponent(path.slice('/api/v3'.length));requirePolicy(!/%|\\|\0/.test(route),'API路径编码不允许。');
     requirePolicy(route==='/user'||route==='/repos/'+config.repository||route==='/repos/'+config.repository+'/collaborators/'+s.user.login||route.startsWith('/repos/'+config.repository+'/contents/')||route.startsWith('/repos/'+config.repository+'/git/')||route.startsWith('/repos/'+config.repository+'/actions/'),'API路径不允许。');
     requirePolicy(route==='/user'||!route.slice(1).split('/').some(x=>x==='..'||x==='.'),'API路径不允许。');
     return response(await github(route+url.search,s.token));
    }
    return response({error:'未开放此操作。'},404);
   }catch(error){if(error.status===401)sessions.delete(cookies(request)[cookieName]);return response({error:error.status===401?'登录已失效。':error.status===403?error.message:'请求失败，请检查内容或重新登录。'},[401,403,404].includes(error.status)?error.status:502);}
  }
 };
}
