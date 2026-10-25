import { readFileSync,writeFileSync } from 'node:fs';
import YAML from 'yaml';
const w=YAML.parse(readFileSync(new URL('./preview-vps.workflow.DRAFT.yml',import.meta.url),'utf8'));
const check=(ok,msg)=>{if(!ok)throw Error(msg);};
check(JSON.stringify(Object.keys(w.on))===JSON.stringify(['workflow_dispatch']),'manual dispatch only');
check(w.permissions.contents==='read'&&Object.keys(w.permissions).length===1,'minimal token');
check(w.concurrency['cancel-in-progress']===false,'no midway cancellation');
check(w.jobs.deploy.needs==='build'&&w.jobs.deploy.environment.name==='vps-preview','build before protected deploy');
check(w.jobs.deploy.if==="vars.VPS_AUTODEPLOY_ENABLED == 'true'",'disabled unless configured');
for(const [jobName,job] of Object.entries(w.jobs)){
 for(const step of job.steps){
  if(step.uses)check(/@[a-f0-9]{40}$/.test(step.uses),'action must use full SHA');
  if(step.run)check(!step.run.includes(String.fromCharCode(36)+'{'+'{'),'untrusted expression in shell source');
  if(jobName==='build')check(!JSON.stringify(step).includes('secrets.'),'build must not receive deployment secret');
 }
}
writeFileSync(new URL('./workflow-validation.json',import.meta.url),JSON.stringify({status:'PASS_LOCAL_STATIC_ONLY',manualDispatchOnly:true,minimalToken:true,pinnedActions:true,separateCredentialJob:true,environmentProtectionConfigured:false,githubRunPerformed:false},null,2));
console.log('Workflow local structural validation PASS; GitHub environment and runs NOT configured.');
