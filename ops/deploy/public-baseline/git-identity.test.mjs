import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,chownSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {verifyObserverCode} from './git-identity.mjs';

const marker='.github/owner-observation-run.json';
function fixture(fn){
 const root=mkdtempSync(join(tmpdir(),'observer-git-identity-'));
 const git=(...args)=>{
  const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);return r.stdout.trim();
 };
 try {
  git('init','-q');git('config','user.name','Isolated Fixture');git('config','user.email','fixture@example.invalid');
  writeFileSync(join(root,'observer.mjs'),'reviewed code\n');git('add','.');git('commit','-qm','reviewed');
  const base=git('rev-parse','HEAD');mkdirSync(join(root,'.github'));writeFileSync(join(root,marker),'{}\n');git('add','.');git('commit','-qm','request only');
  fn({root,base,git});
 }finally{rmSync(root,{recursive:true,force:true});}
}
function rejects(report,fn,category){assert.throws(fn,e=>e.category===category);assert.ok(report.gitIdentity);}

test('exact reviewed base and sole request marker pass',()=>fixture(({root,base})=>{
 const report={};verifyObserverCode({root,base,report});assert.equal(report.gitIdentity.exitCode,0);assert.equal(report.gitIdentity.stdout.trim(),marker);
}));
test('ownership rejection is repaired only for the exact workspace process',()=>fixture(({root,base})=>{
 const env={...process.env,GIT_TEST_ASSUME_DIFFERENT_OWNER:'1'};
 const blocked=spawnSync('git',['-c','safe.directory=','diff','--name-only',base,'HEAD'],{cwd:root,env,encoding:'utf8'});
 assert.notEqual(blocked.status,0);
 const wrong=spawnSync('git',['-c','safe.directory=','-c','safe.directory='+join(root,'unrelated'),'rev-parse','HEAD'],{cwd:root,env,encoding:'utf8'});
 assert.notEqual(wrong.status,0);
 const report={};verifyObserverCode({root,base,report,env});assert.equal(report.gitIdentity.exitCode,0);
 const after=spawnSync('git',['-c','safe.directory=','rev-parse','HEAD'],{cwd:root,env,encoding:'utf8'});assert.notEqual(after.status,0,'No persistent trust exception');
}));
test('additional observer code change remains an identity failure',()=>fixture(({root,base,git})=>{
 writeFileSync(join(root,'observer.mjs'),'unreviewed code\n');git('add','.');git('commit','-qm','unreviewed');
 const report={};rejects(report,()=>verifyObserverCode({root,base,report}),'IDENTITY_FAILURE');assert.equal(report.gitIdentity.exitCode,0);assert.match(report.gitIdentity.stdout,/observer.mjs/);
}));
test('missing base preserves nonzero exit and stderr',()=>fixture(({root})=>{
 const report={};rejects(report,()=>verifyObserverCode({root,base:'0'.repeat(40),report}),'ENVIRONMENT_FAILURE');assert.notEqual(report.gitIdentity.exitCode,0);assert.match(report.gitIdentity.stderr,/bad object|bad revision|unknown revision/i);
}));
test('unavailable Git preserves spawn error and never passes',()=>fixture(({root,base})=>{
 const report={};rejects(report,()=>verifyObserverCode({root,base,report,git:join(root,'missing-git')}),'ENVIRONMENT_FAILURE');assert.equal(report.gitIdentity.error.code,'ENOENT');assert.equal(report.gitIdentity.exitCode,null);
}));
test('unchanged tree without a request marker is still rejected',()=>fixture(({root,git})=>{
 const report={};rejects(report,()=>verifyObserverCode({root,base:git('rev-parse','HEAD'),report}),'IDENTITY_FAILURE');assert.equal(report.gitIdentity.stdout,'');
}));
test('Linux root and genuinely different repository owner reproduce the container failure',{
 skip:process.platform!=='linux'||process.getuid?.()!==0?'Requires Linux container root':false
},()=>fixture(({root,base})=>{
 const env={...process.env};delete env.GIT_TEST_ASSUME_DIFFERENT_OWNER;
 chownSync(root,65534,65534);chownSync(join(root,'.git'),65534,65534);
 const original=spawnSync('git',['-c','safe.directory=','diff','--name-only',base,'HEAD'],{cwd:root,env,encoding:'utf8'});assert.notEqual(original.status,0);
 const explicit=spawnSync('git',['-c','safe.directory=','rev-parse','HEAD'],{cwd:root,env,encoding:'utf8'});assert.match(explicit.stderr,/dubious ownership/);
 const report={};verifyObserverCode({root,base,report,env});assert.equal(report.gitIdentity.exitCode,0);
 const after=spawnSync('git',['-c','safe.directory=','rev-parse','HEAD'],{cwd:root,env,encoding:'utf8'});assert.notEqual(after.status,0);
 console.log(JSON.stringify({platform:process.platform,uid:process.getuid(),repositoryUid:65534,originalExitCode:original.status,originalStderr:original.stderr,ownershipStderr:explicit.stderr,fixed:report.gitIdentity}));
}));
