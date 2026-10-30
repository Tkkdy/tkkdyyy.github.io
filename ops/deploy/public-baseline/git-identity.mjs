import {spawnSync} from 'node:child_process';
import {realpathSync} from 'node:fs';
import {requireCheck as check} from './diagnostics.mjs';

const MARKER='.github/owner-observation-run.json';
const LIMIT=4096;
export function verifyObserverCode({root,base,report,env=process.env,git='git'}) {
 root=realpathSync(root);
 check(/^[a-f0-9]{40}$/.test(base),'Invalid observer code commit','IDENTITY_FAILURE');
 // Trust only this workspace for this process; never write global configuration.
 const args=['-c','safe.directory=','-c',`safe.directory=${root}`,'diff','--no-ext-diff','--no-textconv','--name-only',base,'HEAD','--'];
 const delta=spawnSync(git,args,{cwd:root,env,encoding:'utf8',timeout:30000,maxBuffer:65536});
 const stdout=delta.stdout||'',stderr=delta.stderr||'';
 report.gitIdentity={workspace:root,base,exitCode:delta.status,signal:delta.signal,
  error:delta.error?{code:delta.error.code,message:delta.error.message}:null,
  stdout:stdout.slice(0,LIMIT),stderr:stderr.slice(0,LIMIT),
  stdoutTruncated:stdout.length>LIMIT,stderrTruncated:stderr.length>LIMIT};
 check(!delta.error&&delta.status===0,'Observer Git execution failed','ENVIRONMENT_FAILURE');
 // Compare the complete output, never the diagnostic excerpt.
 check(stdout.trim()===MARKER,'Unreviewed observer code changes','IDENTITY_FAILURE');
}
