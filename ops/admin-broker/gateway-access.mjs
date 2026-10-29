/** Independently ask the loopback gateway to validate its encrypted session cookie.
 * Never authorize from client-supplied X-Forwarded-* or Authorization headers. */
export function createGatewayVerifier(config,{fetchImpl=fetch}={}){
 const google=config?.identityProvider==='google-oidc';
 if(config?.identityProvider&&!['github','google-oidc'].includes(config.identityProvider))throw Error('Invalid gateway identity provider');
 if(google&&!config.allowedEmail?.endsWith('@gmail.com'))throw Error('Google gateway requires the exact owner Gmail address');
 if(!Number.isSafeInteger(config?.port)||config.port<1024||config.port>65535||typeof config.host!=='string'||!/^[-a-z0-9.]+$/.test(config.host)||typeof config.allowedEmail!=='string'||!/^[^@\s]+@[^@\s]+$/.test(config.allowedEmail)||(!google&&(typeof config.allowedUser!=='string'||!config.allowedUser)))throw Error('Invalid gateway configuration');
 const endpoint='http://127.0.0.1:'+config.port+'/oauth2/auth';
 return async request=>{
  try{
   const cookie=request.headers.get('cookie');
   if(!cookie||cookie.length>16384)return false;
   const response=await fetchImpl(endpoint,{redirect:'manual',signal:AbortSignal.timeout(3000),headers:{host:config.host,cookie}});
   const user=response.headers.get('x-auth-request-user');
   const allowed=response.status===202&&response.headers.get('x-auth-request-email')===config.allowedEmail&&(google?/^[0-9]{6,40}$/.test(user||''):user===config.allowedUser);
   await response.body?.cancel();
   return allowed;
  }catch{return false;}
 };
}
