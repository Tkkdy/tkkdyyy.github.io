/** Read-only, exact-head CI details. No log bodies, credentials or mutations. */
export async function inspectProposalChecks({github, original}) {
 const unknown = reason => ({state:'UNKNOWN', reason});
 try {
  const root='/repos/Tkkdy/tkkdyyy.github.io';
  const result=await github(`${root}/actions/workflows/ci.yml/runs?event=pull_request&head_sha=${original.commitSha}&per_page=100`);
  if(!Number.isSafeInteger(result.total_count)||result.total_count>100||!Array.isArray(result.workflow_runs))return unknown('CI_LIST_INCOMPLETE');
  const run=result.workflow_runs.filter(r=>r.head_sha===original.commitSha&&r.head_branch===original.branch&&r.event==='pull_request'&&r.path==='.github/workflows/ci.yml'&&r.head_repository?.id===1355866312&&Number.isSafeInteger(r.id)).sort((a,b)=>b.id-a.id)[0];
  if(!run)return {state:'PENDING',reason:'CI_NOT_STARTED'};
  const base={runId:run.id,url:`https://github.com/Tkkdy/tkkdyyy.github.io/actions/runs/${run.id}`};
  const details=await github(`${root}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
  if(!Number.isSafeInteger(details.total_count)||details.total_count>100||!Array.isArray(details.jobs))return {...base,...unknown('CI_JOBS_INCOMPLETE')};
  const jobs=details.jobs;
  const failed=jobs.find(j=>['failure','timed_out','cancelled','action_required','startup_failure','stale'].includes(j.conclusion));
  const active=failed||jobs.find(j=>j.status==='in_progress')||jobs.find(j=>j.status!=='completed');
  const step=active?.steps?.find(s=>s.conclusion==='failure'||s.conclusion==='timed_out')||active?.steps?.find(s=>s.status==='in_progress');
  // Only bounded job/step names; a fixed-origin run URL leads to the full diagnostic.
  const progress={job:typeof active?.name==='string'?active.name.slice(0,160):null,step:typeof step?.name==='string'?step.name.slice(0,200):null};
  if(failed)return {...base,...progress,state:'FAILED',reason:failed.conclusion};
  if(run.status!=='completed')return {...base,...progress,state:'PENDING',reason:'CI_RUNNING'};
  if(run.conclusion!=='success')return {...base,...progress,state:'FAILED',reason:run.conclusion||'CI_NOT_SUCCEEDED'};
  const expected=['check','profiles (preview)','profiles (production)','isolated-acceptance'];
  if(expected.every(name=>jobs.filter(j=>j.name===name&&j.status==='completed'&&j.conclusion==='success').length===1))return {...base,state:'PASSED',reason:'ALL_CHECKS_PASSED'};
  return {...base,...unknown('CI_JOBS_INCOMPLETE')};
 }catch{return unknown('CI_STATUS_UNAVAILABLE');}
}
