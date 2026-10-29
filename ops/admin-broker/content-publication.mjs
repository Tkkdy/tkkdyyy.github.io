import {createHash} from 'node:crypto';
import {permittedPath, validateAddition, requirePolicy} from './policy.mjs';
const ROOT='/repos/Tkkdy/tkkdyyy.github.io', ID=1355866312, OWNER=144055705;
const SHA=/^[a-f0-9]{40}$/;
const BRANCH=/^codex\/(editorial|cms)-proposal-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const wait=reason=>({state:'WAITING',reason});
/** Only server-created, exact-head content proposals. Never bypasses branch protection. */
export async function advanceContentPublication({github,original,active=()=>true,inspectOnly=false}) {
 requirePolicy(active(),'发布会话已结束。');
 const repo=await github(ROOT);
 requirePolicy(repo.id===ID&&repo.full_name==='Tkkdy/tkkdyyy.github.io'&&repo.owner?.id===OWNER,'仓库身份变化。');
 const path=ROOT+'/pulls/'+original.pullRequestNumber;
 const pr=await github(path);
 requirePolicy(pr.number===original.pullRequestNumber&&pr.html_url===original.url&&pr.base?.repo?.id===ID&&pr.base.ref==='main'&&pr.head?.repo?.id===ID&&pr.head.ref===original.branch&&BRANCH.test(pr.head.ref)&&pr.user?.id===OWNER,'内容PR身份不符。');
 requirePolicy(pr.head.sha===original.commitSha&&SHA.test(pr.head.sha),'提案提交已变化，需重新发布。');
 if(pr.merged===true){requirePolicy(pr.state==='closed'&&SHA.test(pr.merge_commit_sha||''),'合并记录无效。');return {state:'MERGED',sha:pr.merge_commit_sha};}
 requirePolicy(pr.state==='open'&&pr.draft===false,'提案已关闭或为草稿PR。');
 requirePolicy(Number.isSafeInteger(pr.changed_files)&&pr.changed_files>0&&pr.changed_files<=64,'文件数超限或范围未知。');
 requirePolicy((await github(ROOT+'/branches/main')).protected===true,'main保护未生效。');
 const main=(await github(ROOT+'/git/ref/heads/main')).object?.sha;
 requirePolicy(SHA.test(main||''),'main身份无效。');
 const diff=await github(ROOT+'/compare/'+main+'...'+pr.head.sha);
 if(diff.behind_by>0)return {state:'NEEDS_UPDATE',reason:'MAIN_ADVANCED'};
 requirePolicy(diff.status==='ahead'&&diff.behind_by===0&&diff.files?.length===pr.changed_files&&diff.files.length<=64,'实际差异不完整。');
 const tree=await github(ROOT+'/git/trees/'+pr.head.sha+'?recursive=1');
 requirePolicy(tree.truncated===false&&Array.isArray(tree.tree),'完整文件树不可用。');
 const entries=new Map(tree.tree.map(x=>[x.path,x]));let bytes=0;
 for(const file of diff.files){
  requirePolicy(['added','modified','removed','renamed'].includes(file.status)&&permittedPath(file.filename),'工程变更不得自动合并。');
  if(file.status==='renamed')requirePolicy(permittedPath(file.previous_filename),'重命名原路径不允许。');
  if(file.status==='removed')continue;
  const entry=entries.get(file.filename);
  requirePolicy(entry?.type==='blob'&&entry.mode==='100644'&&SHA.test(entry.sha)&&entry.size<=8_000_000,'符号链接、可执行文件或大文件不允许。');
  const blob=await github(ROOT+'/git/blobs/'+entry.sha);
  requirePolicy(blob.sha===entry.sha&&blob.encoding==='base64'&&blob.size===entry.size,'文件身份不符。');
  const contents=blob.content.replace(/\n/g,'');
  requirePolicy(Buffer.from(contents,'base64').length===entry.size,'文件字节不完整。');
  const raw=Buffer.from(contents,'base64');
  requirePolicy(createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex')===entry.sha,'Git blob哈希不符。');
  bytes+=validateAddition({path:file.filename,contents});
  requirePolicy(bytes<=20_000_000,'内容总量超限。');
 }
 const runs=await github(ROOT+'/actions/workflows/ci.yml/runs?event=pull_request&head_sha='+pr.head.sha+'&per_page=100');
 requirePolicy(Number.isSafeInteger(runs.total_count)&&runs.total_count<=100&&Array.isArray(runs.workflow_runs),'CI列表不完整。');
 const run=runs.workflow_runs.filter(x=>x.head_sha===pr.head.sha&&x.event==='pull_request'&&x.path==='.github/workflows/ci.yml'&&x.head_repository?.id===ID&&x.head_branch===pr.head.ref).sort((a,b)=>b.id-a.id)[0];
 if(!run||run.status!=='completed')return wait('CI_PENDING');
 if(run.conclusion!=='success')return {state:'CI_FAILED',reason:'REQUIRED_CI_FAILED',runId:run.id};
 const jobs=await github(ROOT+'/actions/runs/'+run.id+'/jobs?filter=latest&per_page=100');
 requirePolicy(jobs.total_count<=100&&Array.isArray(jobs.jobs),'CI任务列表不完整。');
 requirePolicy(jobs.jobs.filter(j=>j.name==='check').length===1&&jobs.jobs.some(j=>j.name==='check'&&j.status==='completed'&&j.conclusion==='success'),'必需CI任务未成功。');
 // GitHub clean + enforce_admins/strict required checks remain the final authority.
 const fresh=await github(path);
 requirePolicy(fresh.head?.sha===pr.head.sha&&fresh.base?.repo?.id===ID&&fresh.base.ref==='main'&&fresh.state==='open'&&fresh.draft===false,'合并前身份变化。');
 if(fresh.mergeable_state==='behind')return {state:'NEEDS_UPDATE',reason:'MAIN_ADVANCED'};
 if(fresh.mergeable_state==='dirty')return {state:'CONFLICT',reason:'MERGE_CONFLICT'};
 if(fresh.mergeable!==true||fresh.mergeable_state!=='clean')return wait('GITHUB_PROTECTION_PENDING');
 if((await github(ROOT+'/git/ref/heads/main')).object?.sha!==main)return wait('MAIN_MOVED_DURING_VALIDATION');
 requirePolicy(active(),'发布会话已结束。');
 if(inspectOnly)return {state:'READY_READ_ONLY',headSha:pr.head.sha,baseSha:main,runId:run.id,files:diff.files.length,bytes};
 // sha is a server-side compare-and-swap. No admin/bypass flag, force update or rebase.
 const result=await github(path+'/merge',{method:'PUT',body:JSON.stringify({sha:pr.head.sha,merge_method:'squash'})});
 requirePolicy(result.merged===true&&SHA.test(result.sha||''),'合并结果未知，请核验后恢复。');
 return {state:'MERGED',sha:result.sha,runId:run.id};
}

/** Bounded, credential-free state; session token remains inside the existing github closure. */
export function createContentPublisher({github,enabled=false,active=()=>true,schedule=(f,ms)=>{const t=setTimeout(f,ms);t.unref?.();return t;},cancel=clearTimeout}) {
 const jobs=new Map();let stopped=false;
 function start(original){
  if(!enabled)return {state:'MANUAL',reason:'AUTO_PUBLISH_DISABLED'};
  const key=original.pullRequestNumber,old=jobs.get(key);
  requirePolicy(!stopped&&active(),'发布会话已结束。');
  if(old){requirePolicy(old.sha===original.commitSha,'同一PR提交变化。');return structuredClone(old.result);}
  requirePolicy(jobs.size<100,'发布任务数量超限。');
  const job={sha:original.commitSha,result:wait('CI_PENDING'),timer:null};jobs.set(key,job);
  async function tick(){
   if(stopped||!active()){job.result={state:'SESSION_EXPIRED',reason:'LOGIN_AND_RESTORE'};return;}
   try{job.result=await advanceContentPublication({github,original,active:()=>!stopped&&active()});}
   catch{job.result={state:'STOPPED',reason:'VERIFY_OR_MERGE_UNCONFIRMED'};}
   if(job.result.state==='WAITING'&&!stopped&&active())job.timer=schedule(tick,15000);
  }
  job.timer=schedule(tick,0);return structuredClone(job.result);
 }
 return {start,resume(original){const old=jobs.get(original.pullRequestNumber);if(old&&old.result.state!=='WAITING'&&old.result.state!=='MERGED'){requirePolicy(old.sha===original.commitSha,'同一PR提交变化。');jobs.delete(original.pullRequestNumber);}return start(original);},status:number=>structuredClone(jobs.get(number)?.result??{state:enabled?'NOT_REQUESTED':'MANUAL'}),stop(){stopped=true;for(const j of jobs.values())cancel(j.timer);}};
}
