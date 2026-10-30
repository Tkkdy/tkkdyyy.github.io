import test from 'node:test';
import assert from 'node:assert/strict';
import {classify,installDiagnostics,requireCheck} from './diagnostics.mjs';
import http from 'node:http';
import {once} from 'node:events';
test('TLS established without HTTP is not labeled DNS failure',()=>{
 assert.equal(classify([{phase:'dns'},{phase:'tcpConnected'},{phase:'tlsConnected'}],'read ECONNRESET').stage,'HTTP_HEADERS_WAIT');
});
test('deadline cancellation is not another unsolicited peer reset',()=>{
 assert.deepEqual(classify([{phase:'tcpConnected'}],'Timeout 30000ms'),{category:'CLIENT_TRANSPORT_INCONCLUSIVE',stage:'TLS',deadlineInduced:true});
});
test('HTTP body interruption and response failure remain distinct',()=>{
 assert.equal(classify([{phase:'httpHeaders'}],'aborted').stage,'HTTP_BODY');
 assert.throws(()=>requireCheck(false,'wrong status'),e=>e.category==='RESPONSE_CONTRACT_FAILURE');
});
test('passive channel records a real fresh socket without changing request',async()=>{
 const report={requests:[]},probe=installDiagnostics(report);
 const server=http.createServer((req,res)=>{res.writeHead(200);res.end('complete body')});server.listen(0,'127.0.0.1');await once(server,'listening');
 try {
  const context={request:{get:async url=>await new Promise((resolve,reject)=>{
   http.get(url,res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({status:()=>res.statusCode,headers:()=>res.headers,body:async()=>Buffer.concat(chunks)}))}).on('error',reject);
  })}};
  const result=await probe.get(context,'http://127.0.0.1:'+server.address().port,'fixture');
  assert.equal(result.body.toString(),'complete body');assert.equal(report.requests.length,1);
  assert.ok(report.requests[0].events.some(e=>e.phase==='tcpConnected'));
  assert.ok(report.requests[0].events.some(e=>e.phase==='httpHeaders'));
 } finally {probe.close();server.close();await once(server,'close');}
});

test('frozen manifest identity uses exact original bytes on every platform',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {createHash}=await import('node:crypto');
 const bytes=await readFile(new URL('./preview-manifest.json',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'bdbd0dff0af30ac2b7c3631f22b3228ef501a0f5dcfe6203ed4055c3a5ebd6a0');
 assert.equal(JSON.parse(bytes).length,115);
});
