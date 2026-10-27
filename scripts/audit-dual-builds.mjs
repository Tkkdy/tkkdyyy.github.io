import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {parse} from 'parse5';
import YAML from 'yaml';
import {execFileSync} from 'node:child_process';
const args=process.argv.slice(2);
if(args.length!==2)throw new Error('Usage: node scripts/audit-dual-builds.mjs <builds-directory> <report.json>');
const buildRoot=resolve(args[0]), reportPath=resolve(args[1]), errors=[], targets={};
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(resolve(dir,e.name)):[resolve(dir,e.name)]);}
function require(ok,msg){if(!ok)errors.push(msg);}
function inspect(target,origin,base){
 const dir=resolve(buildRoot,target), all=files(dir), names=new Set(all.map(p=>relative(dir,p).replaceAll('\\','/'))), pages=new Map(); let refs=0;
 for(const name of [...names].filter(n=>n.endsWith('.html')&&!n.startsWith('admin/'))){
  const html=readFileSync(resolve(dir,name),'utf8'), tree=parse(html), url=new URL(base+name,origin), record={text:[],canonical:[],robots:[]};
  function visit(n){
   if(n.nodeName==='#text')record.text.push(n.value);
   if(['script','style','template'].includes(n.tagName))return;
   const a=Object.fromEntries((n.attrs??[]).map(x=>[x.name,x.value]));
   if(n.tagName==='link'&&a.rel==='canonical')record.canonical.push(a.href);
   if(n.tagName==='meta'&&a.name==='robots')record.robots.push(a.content);
   for(const key of ['href','src','poster'])if(a[key]){
    const u=new URL(a[key],url);if(u.origin!==origin||!['http:','https:'].includes(u.protocol))continue;
    require(u.pathname.startsWith(base),`${target}: outside base ${name} ${a[key]}`);
    const path=decodeURIComponent(u.pathname.slice(base.length)), candidate=path?(path.endsWith('/')?path+'index.html':path):'index.html';
    require(names.has(candidate)||names.has(path+'/index.html'),`${target}: broken ${name} -> ${a[key]}`);refs++;
   }
   for(const child of n.childNodes??[])visit(child);
  }
  visit(tree);record.text=record.text.join(' ').replace(/\s+/g,' ').trim();
  const canonical=new URL(base+name.replace(/index\.html$/,''),origin).href;
  require(JSON.stringify(record.canonical)===JSON.stringify(name==='404.html'?[]:[canonical]),`${target}: canonical ${name}`);
  if(target==='vps')require(record.robots.some(x=>x.split(/[,\s]+/).includes('noindex')),`vps: missing noindex ${name}`);
  pages.set(name,record);
 }
 targets[target]={dir,names,pages,refs};
 return {files:names.size,publicHtml:pages.size,localReferences:refs,adminFiles:[...names].filter(n=>n.startsWith('admin/')).length};
}
const stats={pages:inspect('pages','https://tkkdy.github.io','/tkkdyyy.github.io/'),vps:inspect('vps','https://preview.boenbot.top','/')};
require(stats.pages.adminFiles>0,'Pages Admin missing');require(stats.vps.adminFiles===0,'VPS Admin exposed');
require(JSON.stringify([...targets.pages.pages.keys()].sort())===JSON.stringify([...targets.vps.pages.keys()].sort()),'public routes differ');
for(const [name,p]of targets.pages.pages){const v=targets.vps.pages.get(name);require(p.text===v?.text,'visible text differs '+name);}
const inventory=[];
for(const p of files(resolve('src/content')).filter(p=>p.endsWith('.md'))){
 const raw=readFileSync(p,'utf8'), m=raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);if(!m)continue;
 const data=YAML.parse(m[1]), collection=relative(resolve('src/content'),p).split(/[\\/]/)[0];
 let route=collection+'/'+data.slug+'/index.html';
 // Fragments are presented in the public stream rather than independent detail routes.
 if(collection==='fragments')route='fragments/index.html';
 if(data.status!=='draft')require(targets.vps.pages.has(route),'missing published content '+route);
 inventory.push({file:relative(resolve('.'),p).replaceAll('\\','/'),collection,status:data.status,slug:data.slug,route});
}
const changes=execFileSync('git',['diff','--name-only','HEAD','--','src/content','public'],{encoding:'utf8'}).trim();require(!changes,'source content/assets changed: '+changes);
const report={state:errors.length?'FAIL':'PASS',baseline:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),stats,inventory,publicRoutes:[...targets.vps.pages.keys()].sort(),sourceContentUnchanged:!changes,errors};
writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify({state:report.state,stats,contentItems:inventory.length,errors}));if(errors.length)process.exitCode=1;
