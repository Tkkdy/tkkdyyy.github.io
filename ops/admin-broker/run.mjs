import {createAccessVerifier} from './access.mjs';
import {createGatewayVerifier} from './gateway-access.mjs';
import {openDraftStore} from './private-drafts.mjs';
/** Production/local entrypoint. Secret config arrives on stdin, never argv/env/logs. */
import {createBroker} from './core.mjs';import {createAdminServer} from './server.mjs';
if(process.argv.length!==3||process.argv[2]!=='--stdin-config'||process.stdin.isTTY){console.error('Supply protected configuration through stdin.');process.exit(2);}
let server,draftStore,backupTimer;
try{
 const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>131072)throw Error();chunks.push(chunk);}
 const config=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(!Number.isSafeInteger(config.listenPort)||config.listenPort<1024||config.listenPort>65535||typeof config.staticRoot!=='string')throw Error();
 const origin=new URL(config.origin);if(['127.0.0.1','localhost'].includes(origin.hostname)&&Number(origin.port||80)!==config.listenPort)throw Error();
 const cloud=!['127.0.0.1','localhost'].includes(origin.hostname);
 if(cloud&&((!config.access&&!config.gateway)||(config.access&&config.gateway)||typeof (config.access||config.gateway).allowedEmail!=='string'||!(config.access||config.gateway).allowedEmail.includes('@')||!config.draftDirectory||config.publicationMode!=='pull-request'||config.branch!=='main'||config.allowMain===true))throw Error();
 if(config.draftDirectory){draftStore=await openDraftStore({directory:config.draftDirectory,forbiddenRoots:[process.cwd(),config.staticRoot]});await draftStore.backup();backupTimer=setInterval(()=>draftStore.backup().catch(()=>console.error('Private draft backup failed.')),3600000);backupTimer.unref();}
 if(cloud&&config.gateway&&(config.gateway.host!==origin.host||config.gateway.port===config.listenPort))throw Error();
 const broker=createBroker(config,{draftStore});server=await createAdminServer({origin:config.origin,staticRoot:config.staticRoot,broker,verifyAccess:cloud?(config.access?createAccessVerifier(config.access):createGatewayVerifier(config.gateway)):null});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.listenPort,'127.0.0.1',resolve);});
 console.log('Authenticated editor listening on loopback port '+config.listenPort+'. Open '+config.origin+'/admin/');
 const close=()=>{clearInterval(backupTimer);server.close(async()=>{await draftStore?.close();process.exit(0);});};process.on('SIGTERM',close);process.on('SIGINT',close);
}catch{clearInterval(backupTimer);if(server)server.close();await draftStore?.close();console.error('Editor configuration or startup failed. No credentials were logged.');process.exitCode=1;}
