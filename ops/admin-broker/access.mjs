/** Fail closed at the origin; never trust a forwarded email or Host as authentication. */
import {createPublicKey,verify} from 'node:crypto';
export function createAccessVerifier(config,{fetchImpl=fetch,clock=()=>Date.now()}={}){
 const issuer=new URL(config?.issuer||'');
 if(issuer.origin!==config.issuer||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(config.issuer)||typeof config.audience!=='string'||!config.audience)throw Error('Invalid Access configuration');
 let keys=[],until=0,pending;
 async function refresh(){
  if(!pending)pending=(async()=>{const r=await fetchImpl(issuer.origin+'/cdn-cgi/access/certs',{redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();const text=await r.text();if(text.length>65536)throw Error();const body=JSON.parse(text);if(!Array.isArray(body.keys)||body.keys.length>20)throw Error();keys=body.keys.filter(k=>k.kty==='RSA'&&typeof k.kid==='string'&&(!k.alg||k.alg==='RS256'));until=clock()+300000;})().finally(()=>{pending=null;});
  return pending;
 }
 return async request=>{
  try{
   const token=request.headers.get('cf-access-jwt-assertion');if(!token||token.length>16384)return false;
   const parts=token.split('.');if(parts.length!==3||parts.some(p=>!/^[-_a-zA-Z0-9]+$/.test(p)))return false;
   const header=JSON.parse(Buffer.from(parts[0],'base64url')),claims=JSON.parse(Buffer.from(parts[1],'base64url'));
   if(config.allowedEmail&&claims.email!==config.allowedEmail)return false;
   if(header.alg!=='RS256'||typeof header.kid!=='string'||header.crit)return false;
   if(clock()>=until)await refresh();
   const key=keys.find(k=>k.kid===header.kid);if(!key)return false;
   if(!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key,format:'jwk'}),Buffer.from(parts[2],'base64url')))return false;
   const now=Math.floor(clock()/1000),aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
   return claims.iss===issuer.origin&&aud.includes(config.audience)&&claims.type==='app'&&typeof claims.sub==='string'&&claims.sub.length>0&&Number.isFinite(claims.exp)&&claims.exp>now&&Number.isFinite(claims.iat)&&claims.iat<=now+30&&(!Object.hasOwn(claims,'nbf')||Number.isFinite(claims.nbf)&&claims.nbf<=now+30);
  }catch{return false;}
 };
}
