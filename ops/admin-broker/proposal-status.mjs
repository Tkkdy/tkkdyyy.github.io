/** Shared read-only PR identity and final main-SHA verification for Studio and CMS. */
import {requirePolicy} from './policy.mjs';
const prefix='/repos/Tkkdy/tkkdyyy.github.io',REPO_ID=1355866312,SHA=/^[a-f0-9]{40}$/;
export async function inspectContentProposal({github,original}){
  const number=original.pullRequestNumber,pr=await github(prefix+'/pulls/'+number);
  requirePolicy(pr.number===number&&pr.html_url===original.url&&pr.base?.ref==='main'&&pr.base.repo?.id===REPO_ID&&pr.head?.ref===original.branch&&pr.head.repo?.id===REPO_ID,'PR身份变化。');
  const result={...original,merged:false,mergedSha:null,mainShaObserved:null,deploymentConfirmed:false,scope:'READ_ONLY_PR_AND_MAIN_ANCESTRY'};
  if(pr.head.sha!==original.commitSha)return {...result,state:'PROPOSAL_CHANGED'};
  requirePolicy(['open','closed'].includes(pr.state)&&typeof pr.merged==='boolean','PR状态无效。');
  if(!pr.merged)return {...result,state:pr.state==='closed'?'PULL_REQUEST_CLOSED':'PULL_REQUEST_OPEN'};
  // Before merge GitHub may expose a synthetic test merge SHA. Never use it without merged=true.
  requirePolicy(pr.state==='closed'&&SHA.test(pr.merge_commit_sha||''),'已合并提交无效。');
  const main=await github(prefix+'/git/ref/heads/main'),mainSha=main.object?.sha;
  requirePolicy(main.object?.type==='commit'&&SHA.test(mainSha||''),'main版本无效。');
  const ancestry=await github(prefix+'/compare/'+pr.merge_commit_sha+'...'+mainSha);
  requirePolicy(['identical','ahead'].includes(ancestry.status)&&ancestry.behind_by===0,'合并版本未在当前main历史内。');
  return {...result,state:'MERGED_ON_MAIN',merged:true,mergedSha:pr.merge_commit_sha,mainShaObserved:mainSha};
}
