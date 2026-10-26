/** Production/local entrypoint. Secret config arrives on stdin, never argv/env/logs. */
import {createBroker} from './core.mjs';import {createAdminServer} from './server.mjs';
if(process.argv.length!==3||process.argv[2]!=='--stdin-config'||process.stdin.isTTY){console.error('Supply protected configuration through stdin.');process.exit(2);}
let server;
try{
 const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>131072)throw Error();chunks.push(chunk);}
 const config=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(!Number.isSafeInteger(config.listenPort)||config.listenPort<1024||config.listenPort>65535||typeof config.staticRoot!=='string')throw Error();
 const origin=new URL(config.origin);if(['127.0.0.1','localhost'].includes(origin.hostname)&&Number(origin.port||80)!==config.listenPort)throw Error();
 const broker=createBroker(config);server=await createAdminServer({origin:config.origin,staticRoot:config.staticRoot,broker});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.listenPort,'127.0.0.1',resolve);});
 console.log('Authenticated editor listening on loopback port '+config.listenPort+'. Open '+config.origin+'/admin/');
 const close=()=>server.close(()=>process.exit(0));process.on('SIGTERM',close);process.on('SIGINT',close);
}catch{if(server)server.close();console.error('Editor configuration or startup failed. No credentials were logged.');process.exitCode=1;}
