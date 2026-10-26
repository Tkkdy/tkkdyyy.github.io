/** Read only one approved production workflow; unrelated green checks never prove deployment. */
export async function inspectWorkflow({github,repository,expectedSha,branch}){
 const unknown=reason=>Object.fromEntries(['pages','vps'].map(t=>[t,{state:'UNKNOWN',reason}]));
 if(branch!=='main')return Object.fromEntries(['pages','vps'].map(t=>[t,{state:'NOT_REQUESTED',reason:'TEST_BRANCH_NOT_PRODUCTION'}]));
 try{
  const result=await github(`/repos/${repository}/actions/workflows/deploy.yml/runs?head_sha=${expectedSha}&branch=main&per_page=20`);
  const runs=(result.workflow_runs??[]).filter(x=>x.head_sha===expectedSha&&x.head_branch==='main'&&x.path==='.github/workflows/deploy.yml'&&['push','workflow_dispatch'].includes(x.event)&&Number.isSafeInteger(x.id));
  const run=runs.sort((a,b)=>b.id-a.id)[0];if(!run)return unknown('NO_MATCHING_PRODUCTION_RUN');
  const details=await github(`/repos/${repository}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
  if(details.total_count>100)return unknown('JOB_LIST_INCOMPLETE');
  return Object.fromEntries(['pages','vps'].map(target=>{
   const jobs=(details.jobs??[]).filter(j=>[target+'-build',target+'-deploy'].includes(j.name));const base={runId:run.id,url:`https://github.com/${repository}/actions/runs/${run.id}`};
   if(jobs.length!==2)return [target,{...base,state:'UNKNOWN',reason:'TARGET_JOBS_NOT_RECOGNIZED'}];
   const failed=jobs.find(j=>['failure','timed_out','cancelled','action_required','startup_failure','stale'].includes(j.conclusion));
   if(failed)return[target,{...base,state:'FAILED',reason:failed.conclusion,job:failed.name,step:(failed.steps??[]).find(s=>s.conclusion==='failure')?.name?.slice(0,200)||null}];
   if(jobs.some(j=>j.status!=='completed'))return[target,{...base,state:'PENDING',reason:'TARGET_JOBS_RUNNING'}];
   if(jobs.every(j=>j.conclusion==='success'))return[target,{...base,state:'SUCCEEDED',reason:'TARGET_JOBS_SUCCEEDED'}];
   return[target,{...base,state:'SKIPPED',reason:'TARGET_NOT_DEPLOYED'}];
  }));
 }catch{return unknown('WORKFLOW_STATUS_UNAVAILABLE');}
}
