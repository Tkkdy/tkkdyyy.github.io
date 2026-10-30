import {parse as parseYaml,stringify as yamlStringify} from 'yaml';
/** Loopback HTTP adapter. No credentials/config files are served from the static root. */
import http from 'node:http';
import {readFile,realpath,lstat} from 'node:fs/promises';
import {resolve,relative,sep,extname} from 'node:path';
import {createHash} from 'node:crypto';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.gif':'image/gif','.woff2':'font/woff2'};
const safeHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Resource-Policy':'same-origin'};
function htmlPolicy(body,{cms=false,cmsFrame=false}={}){
 const hashes=[...body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter(([,attrs])=>!/(?:^|\s)src\s*=/i.test(attrs)).map(([, ,script])=>"'sha256-"+createHash('sha256').update(script).digest('base64')+"'");
 return `default-src 'self'; script-src 'self' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self'; media-src 'self' https:; connect-src 'self'${cms?' blob:':''}; frame-src 'self'; frame-ancestors ${cmsFrame?"'self'":"'none'"}; object-src 'none'; base-uri 'none'; form-action 'self'`;
}
export async function createAdminServer({origin,staticRoot,broker,verifyAccess=null,maxBodyBytes=30_000_000}){
 const expected=new URL(origin);if(!['127.0.0.1','localhost'].includes(expected.hostname)&&expected.protocol!=='https:')throw Error('Public origin requires HTTPS.');
 const root=await realpath(staticRoot);
 const server=http.createServer(async(req,res)=>{
  const send=(status,body='',headers={})=>{res.writeHead(status,{...safeHeaders,...headers});res.end(req.method==='HEAD'?undefined:body);};
  try{
   if(req.headers.host!==expected.host)return send(421,'Host mismatch');
   if(verifyAccess){if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||!await verifyAccess(new Request(expected.origin,{headers:req.headers})))return send(403,'Access verification required');}
   if(!['GET','HEAD','POST'].includes(req.method))return send(405);
   // Validate raw path before URL normalizes dot segments. Never trust forwarding headers.
   const raw=(req.url||'').split('?')[0];let decoded;try{decoded=decodeURIComponent(raw);}catch{return send(400);}
   if(!raw.startsWith('/')||raw.startsWith('//')||/[\\\0%]/.test(decoded)||decoded.split('/').some(x=>x==='..'||x==='.'||x.startsWith('.')))return send(400);
   const url=new URL(req.url,expected);
   let body;
   if(req.method==='POST'){
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>maxBodyBytes){send(413);req.destroy();return;}chunks.push(chunk);}body=Buffer.concat(chunks);
   }
   const request=new Request(url,{method:req.method,headers:req.headers,...(body?{body}:{} )});
   if(url.pathname.startsWith('/auth/')||url.pathname.startsWith('/api/')){
    const result=await broker.handle(request);const headers=Object.fromEntries(result.headers);const cookies=result.headers.getSetCookie();if(cookies.length)headers['set-cookie']=cookies;
    return send(result.status,Buffer.from(await result.arrayBuffer()),headers);
   }
   if(!['GET','HEAD'].includes(req.method))return send(405);
   if(decoded==='/')return send(303,'',{Location:'/admin/'});
   let authenticated;try{authenticated=await broker.authenticate(request);}catch{return send(401,'<!doctype html><meta charset="utf-8"><title>编辑站登录</title><h1>需要登录</h1><p><a href="/auth/login?back=/admin/">使用 GitHub 所有者账号登录</a></p>',{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});}
   if(decoded==='/admin/content-schema.json'){const schema=parseYaml(await readFile(resolve(root,'admin/config.yml'),'utf8'),{maxAliasCount:0});return send(200,JSON.stringify({collections:schema.collections.filter(c=>['projects','images'].includes(c.name))}),{'Content-Type':'application/json; charset=utf-8'});}
   if(decoded==='/admin/config.yml'){
    if(authenticated?.repository!=='Tkkdy/tkkdyyy.github.io'||!authenticated.branch)return send(403);
    if(authenticated.publicationMode==='pull-request'&&authenticated.cmsWorkspace?.state!=='EDITING')return send(403,'Start an explicit CMS content workspace first.');
    const cmsBranch=authenticated.publicationMode==='pull-request'?authenticated.cmsWorkspace.branch:authenticated.branch;
    const config=parseYaml(await readFile(resolve(root,'admin/config.yml'),'utf8'),{maxAliasCount:0});
    config.backend={name:'github',repo:authenticated.repository,branch:cmsBranch,auth_methods:['oauth'],include_credentials:true,api_root:origin+'/api/v3',graphql_api_root:origin+'/api/graphql',base_url:origin,auth_endpoint:'auth/sveltia'};
    config.public_folder='/uploads';
    return send(200,yamlStringify(config),{'Content-Type':'application/yaml; charset=utf-8','Content-Security-Policy':"default-src 'none'"});
   }
   const historicalImage=/^\/(?:projects|images|brand)\/.+\.(?:png|jpe?g|webp|avif|gif|svg)$/i.test(decoded);
   if(!(historicalImage||decoded.startsWith('/admin/')||decoded.startsWith('/_astro/')||decoded.startsWith('/uploads/')||decoded==='/favicon.svg'||decoded==='/brand/tkkdy-logo.png'))return send(404);
   const candidate=resolve(root,'.'+decoded+(decoded.endsWith('/')?'index.html':''));
   const rel=relative(root,candidate);if(rel.startsWith('..')||rel.startsWith(sep))return send(404);
   // Reject every symlink component, including links whose final target is still inside root.
   let current=root;for(const part of rel.split(sep)){current=resolve(current,part);if((await lstat(current)).isSymbolicLink())return send(404);}
   if(!(await lstat(candidate)).isFile())return send(404);
   const extension=extname(candidate);if(!MIME[extension])return send(404);
   const bytes=await readFile(candidate);
   return send(200,bytes,{'Content-Type':MIME[extension],'Content-Security-Policy':extension==='.html'?htmlPolicy(bytes.toString('utf8'),{cms:['/admin/sveltia.html','/admin/sveltia-workspace.html'].includes(decoded),cmsFrame:decoded==='/admin/sveltia-workspace.html'&&authenticated.publicationMode==='pull-request'}):"default-src 'none'; sandbox"});
  }catch(error){return send(error.code==='ENOENT'||error.code==='ENOTDIR'?404:500);}
 });
 server.requestTimeout=30_000;server.headersTimeout=15_000;server.keepAliveTimeout=5000;
 return server;
}
