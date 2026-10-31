// Isolated candidate browser test. Never visits or changes a production host.
import {createServer} from 'node:http';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname,dirname} from 'node:path';
import {spawn} from 'node:child_process';
const [dir,mode]=process.argv.slice(2), root=resolve(dir);
if(!['pages','preview','production'].includes(mode))throw Error('Invalid mode');
const base=mode==='pages'?'/tkkdyyy.github.io/':'/';
const canonical=mode==='pages'?'https://tkkdy.github.io/tkkdyyy.github.io/':mode==='preview'?'https://preview.boenbot.top/':'https://tkkdy.me/';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer((req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!pathname.startsWith(base))throw Error('base');
  let file=resolve(root,pathname.slice(base.length)||'.');
  if(file!==root&&!file.startsWith(root+sep))throw Error('escape');
  if(statSync(file).isDirectory())file=resolve(file,'index.html');
  const body=readFileSync(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(body);
 }catch{res.writeHead(404);res.end('not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const child=spawn(process.execPath,[resolve(dirname(fileURLToPath(import.meta.url)),'../ops/deploy/browser_gate.mjs')],{stdio:'inherit',env:{...process.env,SITE_URL:`http://127.0.0.1:${server.address().port}${base}`,CANONICAL_SITE_URL:canonical,VPS_INDEXING_PROFILE:mode==='preview'?'preview':'production'}});
try{process.exitCode=await new Promise(r=>child.on('exit',r));}finally{server.close();}
