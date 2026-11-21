// Decode and integrity verification never block the UI thread.
self.onmessage=async({data:{url}})=>{
 try{
 const start=performance.now();
 const [response,payload]=await Promise.all([fetch(url),fetch(url.replace(/\.json$/,'.bin'))]);
 if(!response.ok||!payload.ok)throw Error('地形资源加载失败');
 const [cache,bytes]=await Promise.all([response.json(),new Response(payload.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()]);
 const downloadMs=performance.now()-start;
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 if(bytes.byteLength!==cache.byteLength||digest!==cache.sha256)throw Error('派生缓存摘要不匹配');
 self.postMessage({cache,bytes,timing:{downloadMs,decodeMs:performance.now()-start-downloadMs,totalMs:performance.now()-start}},[bytes]);
 }catch(e){self.postMessage({error:e.message})}
};
