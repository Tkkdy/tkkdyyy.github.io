import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import http from 'node:http';
import {once} from 'node:events';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const setup=fileURLToPath(new URL('../ops/admin-broker/Setup-LocalAdmin.ps1',import.meta.url));
const start=fileURLToPath(new URL('../ops/admin-broker/Start-LocalAdmin.ps1',import.meta.url));
const quote=s=>"'"+s.replaceAll("'","''")+"'";
function ps(script){return execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop';"+script],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});}
async function fixture(t){const dir=await mkdtemp(join(tmpdir(),'admin-launcher-'));t.after(()=>rm(dir,{recursive:true,force:true}));await mkdir(join(dir,'static','admin'),{recursive:true});await writeFile(join(dir,'static','admin','index.html'),'<title>Private fixture</title>');return {dir,root:join(dir,'static'),config:join(dir,'local.json')};}
function prepare(f,args=''){return ps("function Read-Host {param([string]$Prompt,[switch]$AsSecureString);ConvertTo-SecureString 'SYNTHETIC_LAUNCHER_SECRET' -AsPlainText -Force}; & "+quote(setup)+" -ClientId SYNTHETIC_APP -ConfigPath "+quote(f.config)+" -StaticRoot "+quote(f.root)+' '+args);}
// Invoke the actual launcher and real Node stdin pipeline; the probe never prints decrypted secrets.
function launch(f){const probe="let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{const c=JSON.parse(s);if(c.clientSecret!=='SYNTHETIC_LAUNCHER_SECRET'||c.encryptedClientSecret)process.exit(7);console.log(JSON.stringify({mode:c.publicationMode??'direct',branch:c.branch,allowMain:c.allowMain,origin:c.origin}));});";
return ps("$global:FixtureNode=(Get-Command node -CommandType Application | Select-Object -First 1).Source;function node {param($Entry,$Flag);if($Flag -ne '--stdin-config' -or -not $Entry.EndsWith('run.mjs')){throw 'Wrong entry'};$input | & $global:FixtureNode -e "+quote(probe)+'};& '+quote(start)+' -ConfigPath '+quote(f.config));}

const win={skip:process.platform!=='win32'};
test('Windows setup keeps default direct test branch, DPAPI and stdin-only launcher',win,async t=>{const f=await fixture(t);const output=prepare(f);const raw=await readFile(f.config,'utf8'),c=JSON.parse(raw);assert.equal(c.publicationMode,'direct');assert.equal(c.branch,'codex/admin-local-probe');assert.equal(c.allowMain,false);assert(!raw.includes('SYNTHETIC_LAUNCHER_SECRET'));assert(!output.includes('SYNTHETIC_LAUNCHER_SECRET'));assert.deepEqual(JSON.parse(launch(f)),{mode:'direct',branch:c.branch,allowMain:false,origin:'http://127.0.0.1:19443'});});
test('explicit PR setup selects read-only main mode; launcher preserves PR setting',win,async t=>{const f=await fixture(t);prepare(f,'-PublicationMode pull-request');const c=JSON.parse(await readFile(f.config,'utf8'));assert.equal(c.branch,'main');assert.equal(c.allowMain,false);assert.equal(c.publicationMode,'pull-request');assert.equal(JSON.parse(launch(f)).mode,'pull-request');const before=await readFile(f.config);assert.throws(()=>prepare(f,'-PublicationMode pull-request'));assert.deepEqual(await readFile(f.config),before);});
test('setup rejects incompatible mode/branch before prompting or creating config',win,async t=>{for(const args of ['-Branch main','-PublicationMode pull-request -Branch codex/test','-PublicationMode unknown',"-Branch ' '"]){const f=await fixture(t);assert.throws(()=>prepare(f,args));await assert.rejects(readFile(f.config));}});
test('legacy schema retains direct test mode; unsafe edited records refuse before decryption',win,async t=>{const f=await fixture(t);prepare(f);const original=JSON.parse(await readFile(f.config,'utf8'));delete original.publicationMode;await writeFile(f.config,JSON.stringify(original));assert.equal(JSON.parse(launch(f)).mode,'direct');for(const patch of [{branch:'main'},{allowMain:true},{allowMain:'false'},{publicationMode:'pull-request'},{publicationMode:'unknown'},{origin:'https://other.example'},{listenPort:'19443'}]){const c={...original,...patch,encryptedClientSecret:'INVALID_MUST_NOT_DECRYPT'};await writeFile(f.config,JSON.stringify(c));assert.throws(()=>launch(f),e=>{assert(!String(e.stderr).includes('SYNTHETIC_LAUNCHER_SECRET'));assert(!String(e.stderr).includes('ConvertTo-SecureString'));return true;});}});

test('actual Windows PR launcher decrypts and starts real authenticated loopback broker',win,async t=>{
 const f=await fixture(t);prepare(f,'-PublicationMode pull-request');const reserve=http.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));const c=JSON.parse(await readFile(f.config,'utf8'));c.listenPort=port;c.origin='http://127.0.0.1:'+port;await writeFile(f.config,JSON.stringify(c));
 const child=spawn('pwsh',['-NoProfile','-NonInteractive','-File',start,'-ConfigPath',f.config],{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);const finished=once(child,'exit');
 t.after(async()=>{if(child.exitCode===null){execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}await finished;});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Launcher startup timeout')),7000);child.stdout.on('data',()=>{if(output.includes('listening on loopback')){clearTimeout(timer);resolve();}});child.once('exit',()=>{clearTimeout(timer);reject(Error('Launcher exited before readiness'));});});
 assert.equal((await fetch(c.origin+'/admin/')).status,401);assert.equal((await fetch(c.origin+'/api/session')).status,401);const login=await fetch(c.origin+'/auth/login',{redirect:'manual'});assert.equal(login.status,303);assert.equal(new URL(login.headers.get('location')).hostname,'github.com');assert.equal(new URL(login.headers.get('location')).searchParams.get('redirect_uri'),c.origin+'/auth/callback');assert(!output.includes('SYNTHETIC_LAUNCHER_SECRET'));assert(!output.includes(c.encryptedClientSecret));
});
