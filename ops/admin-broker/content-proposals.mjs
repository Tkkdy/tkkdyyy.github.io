/** Opt-in PR preparation. No main write, merge, credentials or default enablement. */
import {createHash} from 'node:crypto';
import {requirePolicy,validateCommit} from './policy.mjs';
const REPOSITORY='Tkkdy/tkkdyyy.github.io',REPO_ID=1355866312,OWNER_ID=144055705;
const SHA=/^[a-f0-9]{40}$/,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const MUTATION='mutation($input:CreateCommitOnBranchInput!){createCommitOnBranch(input:$input){commit{oid}}}';

export function createContentProposalService({github,enabled=false,clock=()=>Date.now()}){
 const requests=new Map(),prefix='/repos/'+REPOSITORY;
 async function submit(request){
  requirePolicy(enabled===true,'内容PR模式尚未启用。');
  requirePolicy(request&&typeof request==='object'&&!Array.isArray(request)&&Object.keys(request).every(k=>['requestId','expectedHeadOid','message','fileChanges'].includes(k)),'提案参数不允许。');
  const input=structuredClone(request);
  requirePolicy(UUID.test(input.requestId||''),'提案请求标识无效。');
  const branch='codex/editorial-proposal-'+input.requestId;
  const commit={branch:{repositoryNameWithOwner:REPOSITORY,branchName:branch},expectedHeadOid:input.expectedHeadOid,message:input.message,fileChanges:input.fileChanges};
  const validated=validateCommit(commit,{repository:REPOSITORY,branch,allowMain:false});
  const fingerprint=createHash('sha256').update(JSON.stringify(commit)).digest('hex');
  for(const [key,value]of requests)if(value.complete&&value.expires<=clock())requests.delete(key);
  const previous=requests.get(input.requestId);
  if(previous){requirePolicy(previous.fingerprint===fingerprint,'相同请求标识不能用于不同内容。');return previous.promise;}
  requirePolicy(requests.size<100,'提案请求过多，请稍后继续。');
  const state={fingerprint,expires:clock()+1800000,complete:false};
  // Defer upstream calls until the in-flight entry is stored: concurrent clicks share one operation.
  state.promise=Promise.resolve().then(()=>publish(commit,validated.paths,branch)).finally(()=>{state.complete=true;});
  requests.set(input.requestId,state);return state.promise;
 }
 async function publish(commit,paths,branch){
  let phase='READ_BASE',commitSha=null;
  try{
   const repo=await github(prefix);
   requirePolicy(repo.id===REPO_ID&&repo.full_name===REPOSITORY&&repo.owner?.id===OWNER_ID,'仓库身份变化。');
   const base=await github(prefix+'/git/ref/heads/main');
   requirePolicy(base.object?.type==='commit'&&base.object.sha===commit.expectedHeadOid,'main已变化，请重新读取并检查内容。');
   phase='CREATE_CONTENT_BRANCH';
   const ref=await github(prefix+'/git/refs',{method:'POST',body:JSON.stringify({ref:'refs/heads/'+branch,sha:commit.expectedHeadOid})});
   requirePolicy(ref.ref==='refs/heads/'+branch&&ref.object?.sha===commit.expectedHeadOid,'新分支身份不符。');
   phase='COMMIT_CONTENT';
   const result=await github('/graphql',{method:'POST',body:JSON.stringify({query:MUTATION,variables:{input:commit}})});
   requirePolicy(!result.errors?.length,'内容提交冲突。');commitSha=result.data?.createCommitOnBranch?.commit?.oid;
   requirePolicy(SHA.test(commitSha||'')&&commitSha!==commit.expectedHeadOid,'提交版本无效。');
   phase='VERIFY_CONTENT_DIFF';
   const head=await github(prefix+'/git/ref/heads/'+branch);
   requirePolicy(head.object?.sha===commitSha,'提案分支已有其他更新。');
   const diff=await github(prefix+'/compare/'+commit.expectedHeadOid+'...'+commitSha);
   requirePolicy(diff.status==='ahead'&&diff.behind_by===0&&diff.total_commits===1&&diff.commits?.length===1&&diff.commits[0].sha===commitSha&&Array.isArray(diff.files),'提案提交范围不符。');
   const actual=[];
   for(const file of diff.files){
    requirePolicy(['added','modified','removed','renamed'].includes(file.status),'提案文件状态不符。');
    actual.push(file.filename);if(file.status==='renamed')actual.push(file.previous_filename);
   }
   requirePolicy(actual.length===paths.length&&new Set(actual).size===actual.length&&paths.every(p=>actual.includes(p)),'提案包含未批准文件或缺少文件。');
   requirePolicy((await github(prefix+'/git/ref/heads/main')).object?.sha===commit.expectedHeadOid,'main在提案准备中变化，停止而不自动重放。');
   phase='CREATE_PULL_REQUEST';
   const pr=await github(prefix+'/pulls',{method:'POST',body:JSON.stringify({title:commit.message.headline,head:branch,base:'main',body:'Editorial content proposal. Await repository checks and merge; neither site deployment is confirmed.',draft:false,maintainer_can_modify:false})});
   requirePolicy(Number.isSafeInteger(pr.number)&&pr.number>0&&pr.state==='open'&&pr.merged!==true&&pr.head?.ref===branch&&pr.head.sha===commitSha&&pr.head.repo?.id===REPO_ID&&pr.base?.ref==='main'&&pr.base.sha===commit.expectedHeadOid&&pr.base.repo?.id===REPO_ID,'PR身份或基准不符。');
   const url='https://github.com/'+REPOSITORY+'/pull/'+pr.number;requirePolicy(pr.html_url===url,'PR地址不符。');
   return {state:'PULL_REQUEST_OPEN',branch,baseSha:commit.expectedHeadOid,commitSha,pullRequestNumber:pr.number,url,merged:false,deploymentConfirmed:false};
  }catch(error){
   // Do not replay a timed-out write or delete an uncertain branch/commit/PR.
   throw Object.assign(Error('内容提案未确认完成，停止于'+phase+'；未执行main写入或合并。'),{status:error.status===403?403:502,code:'PROPOSAL_STOPPED_NO_RETRY',phase,branch,commitSha,automaticRetry:false});
  }
 }
 return {submit};
}
