/** Independently ask the loopback gateway to validate its encrypted session cookie.
 * Never authorize from client-supplied X-Forwarded-* or Authorization headers. */
export function createGatewayVerifier(config,{fetchImpl=fetch}={}){
 if(!Number.isSafeInteger(config?.port)||config.port<1024||config.port>65535||typeof config.host!=='string'||!/^[-a-z0-9.]+$/.test(config.host)||typeof config.allowedEmail!=='string'||!/^[^@\s]+@[^@\s]+$/.test(config.allowedEmail)||typeof config.allowedUser!=='string'||!config.allowedUser)throw Error('Invalid gateway configuration');
 const endpoint='http://127.0.0.1:'+config.port+'/oauth2/auth';
 return async request=>{
  try{
   const cookie=request.headers.get('cookie');
   if(!cookie||cookie.length>16384)return false;
   const response=await fetchImpl(endpoint,{redirect:'manual',signal:AbortSignal.timeout(3000),headers:{host:config.host,cookie}});
   const allowed=response.status===202&&response.headers.get('x-auth-request-email')===config.allowedEmail&&response.headers.get('x-auth-request-user')===config.allowedUser;
   await response.body?.cancel();
   return allowed;
  }catch{return false;}
 };
}
