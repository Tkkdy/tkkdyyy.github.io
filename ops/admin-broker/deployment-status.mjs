/** Read-only acceptance of public version markers. Does not claim functional/full-file acceptance. */
export async function inspectTargets({targets,branch,expectedSha,fetchImpl=fetch}){
 if(!/^[a-f0-9]{40}$/.test(expectedSha||''))throw Error('Invalid source SHA');
 return Promise.all(['pages','vps'].map(async target=>{
  const base={target,expectedSha,actualSha:null,status:'UNKNOWN',scope:'PUBLIC_VERSION_AND_HTTP_HEALTH'};
  const configured=targets?.[target];if(!configured)return {...base,reason:'TARGET_NOT_CONFIGURED'};
  try{
  const origin=new URL(configured);if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||!origin.pathname.endsWith('/'))throw Error('Invalid public target');
  const url=new URL('deployment.json',origin),homepage=origin.href;
   // Each target fails independently; one observation, no retries or arbitrary caller URLs.
   const version=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
   if(!version.ok)return {...base,status:branch!=='main'?'NOT_DEPLOYED':'UNKNOWN',reason:'VERSION_MARKER_UNAVAILABLE',httpStatus:version.status,url:homepage};
   const raw=await version.text();if(Buffer.byteLength(raw)>16000)throw Error('Version marker too large');const data=JSON.parse(raw);
   if(!/^[a-f0-9]{40}$/.test(data.sourceSha||'')||data.target!==target)return {...base,reason:'INVALID_VERSION_MARKER',url:homepage};
   const actualSha=data.sourceSha;
   if(actualSha!==expectedSha)return {...base,actualSha,status:branch!=='main'?'NOT_DEPLOYED':'VERSION_DIFFERS',reason:branch!=='main'?'TEST_BRANCH_NOT_PRODUCTION':'REQUESTED_VERSION_NOT_LIVE',url:homepage};
   const health=await fetchImpl(origin,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(20000)});
   return {...base,actualSha,status:health.status===200?'CURRENT_VERSION_VERIFIED':'FAILED',httpStatus:health.status,url:homepage,reason:health.status===200?'PUBLIC_MARKER_AND_HEALTH_MATCH':'PUBLIC_HEALTH_FAILED'};
  }catch{return {...base,status:'UNKNOWN',reason:'PUBLIC_CHECK_FAILED'};}
 }));
}
