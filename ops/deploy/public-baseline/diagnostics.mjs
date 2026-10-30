import {AsyncLocalStorage} from 'node:async_hooks';
import {channel} from 'node:diagnostics_channel';
export function classify(events, error) {
 const p=new Set(events.map(e=>e.phase));
 const stage=p.has('httpHeaders')?'HTTP_BODY':p.has('tlsConnected')?'HTTP_HEADERS_WAIT':p.has('tcpConnected')?'TLS':p.has('dns')?'TCP':'DNS_OR_CONNECT';
 return {category:'CLIENT_TRANSPORT_INCONCLUSIVE',stage,deadlineInduced:/Timeout|deadline/i.test(String(error))};
}
export function installDiagnostics(report) {
 const storage=new AsyncLocalStorage(),ch=channel('http.client.request.start');
 const onStart=({request:req})=>{
  const row=storage.getStore();if(!row)return;
  const emit=(phase,data={})=>row.events.push({phase,ms:Date.now()-row.start,...data});
  let attached=false;
  const attach=s=>{if(attached||!s)return;attached=true;emit('socket',{reusedSocket:req.reusedSocket===true});
   s.on('lookup',(e,address,family)=>emit('dns',{error:e?.code,address,family}));
   s.on('connect',()=>emit('tcpConnected',{remoteAddress:s.remoteAddress,family:s.remoteFamily}));
   s.on('secureConnect',()=>emit('tlsConnected',{authorized:s.authorized,protocol:s.getProtocol(),remoteAddress:s.remoteAddress}));
   s.on('error',e=>emit('socketError',{code:e.code,message:e.message}));
   if(s.remoteAddress)emit('existingPeer',{remoteAddress:s.remoteAddress});
  };
  if(req.socket)attach(req.socket);else req.once('socket',attach);
  req.on('finish',()=>emit('requestSent'));
  req.on('response',r=>emit('httpHeaders',{status:r.statusCode,cfRay:r.headers['cf-ray'],server:r.headers.server}));
  req.on('error',e=>emit('requestError',{code:e.code,message:e.message}));
 };
 ch.subscribe(onStart);
 return {
  async get(context,url,label){
   const row={label,url,start:Date.now(),events:[]};report.requests.push(row);
   return await storage.run(row,async()=>{try{
    const r=await context.request.get(url,{timeout:30000,maxRedirects:0,maxRetries:0});
    row.status=r.status();row.cfRay=r.headers()['cf-ray'];const body=await r.body();row.bytes=body.length;row.ms=Date.now()-row.start;row.completed=true;
    return {status:r.status(),headers:r.headers(),body};
   }catch(e){row.ms=Date.now()-row.start;row.error=String(e);Object.assign(row,classify(row.events,e));throw e;}});
  },
  close(){ch.unsubscribe(onStart);}
 };
}
export function requireCheck(condition,message,category='RESPONSE_CONTRACT_FAILURE') {
 if(!condition){const e=new Error(message);e.category=category;throw e;}
}
