import {validateWorkspaceSnapshot} from './workspace-recovery.mjs';
import {inspectContentProposal} from './proposal-status.mjs';
/** Explicit Sveltia staging workspace. No fake main commit, merge or deployment. */
import {randomUUID} from 'node:crypto';
import {authorizeGraphql,permittedPath,requirePolicy} from './policy.mjs';
const REPO='Tkkdy/tkkdyyy.github.io',ID=1355866312,OWNER=144055705,PREFIX='/repos/'+REPO,SHA=/^[a-f0-9]{40}$/;
export function createCmsWorkspace({github,enabled=false}){
 let state={state:'NOT_STARTED',branch:null,baseSha:null,headSha:null,deploymentConfirmed:false},pending=null;
 const commits=[],paths=new Set();
 const status=()=>structuredClone({...state,commitCount:commits.length});
 function exclusive(operation){
  requirePolicy(!pending,'另一个编辑操作尚未完成。');
  pending=Promise.resolve().then(operation).finally(()=>{pending=null;});return pending;
 }
 async function identity(){const repo=await github(PREFIX);requirePolicy(repo.id===ID&&repo.full_name===REPO&&repo.owner?.id===OWNER,'仓库身份变化。');}
 async function head(branch){const ref=await github(PREFIX+'/git/ref/heads/'+branch);requirePolicy(ref.object?.type==='commit'&&SHA.test(ref.object.sha||''),'分支身份无效。');return ref.object.sha;}
 async function noProposal(branch){const prs=await github(PREFIX+'/pulls?head='+encodeURIComponent('Tkkdy:'+branch)+'&state=all&per_page=1');requirePolicy(Array.isArray(prs)&&prs.length===0,'编辑分支已有PR或结果未知，停止而不重新发布。');}
 function stop(error,phase){state={...state,state:'STOPPED',phase};throw Object.assign(Error('编辑分支操作未确认，停止于'+phase+'；保留分支，不自动重试。'),{status:error.status===403?403:502});}
 async function begin(){
  requirePolicy(enabled,'内容PR模式尚未启用。');
  if(state.state==='EDITING'||state.state==='PULL_REQUEST_OPEN')return status();
  requirePolicy(state.state==='NOT_STARTED','当前编辑分支已停止，需要人工核对。');
  return exclusive(async()=>{
   let phase='READ_MAIN';
   try{await identity();const base=await head('main');state={...state,baseSha:base,headSha:base,branch:'codex/cms-proposal-'+randomUUID()};
    phase='CREATE_BRANCH';const ref=await github(PREFIX+'/git/refs',{method:'POST',body:JSON.stringify({ref:'refs/heads/'+state.branch,sha:base})});
    requirePolicy(ref.ref==='refs/heads/'+state.branch&&ref.object?.sha===base,'新分支身份不符。');state.state='EDITING';return status();
   }catch(error){return stop(error,phase);}
  });
 }
 async function mutate(body){
  requirePolicy(enabled&&state.state==='EDITING','必须先创建可编辑的内容分支。');
  const input=structuredClone(body),authorized=authorizeGraphql(input,{repository:REPO,branch:state.branch,allowMain:false});
  requirePolicy(authorized.mutation&&authorized.input.expectedHeadOid===state.headSha,'内容分支已变化，请重新读取。');
  requirePolicy(commits.length<30,'单个编辑分支最多30次保存。');
  const touched=[...(authorized.input.fileChanges.additions??[]),...(authorized.input.fileChanges.deletions??[])].map(file=>file.path);
  requirePolicy(new Set([...paths,...touched]).size<=64,'编辑分支累计文件超限。');
  return exclusive(async()=>{
   let phase='CHECK_BRANCH';
   try{await identity();requirePolicy(await head(state.branch)===state.headSha,'编辑分支已有其他更新。');
    await noProposal(state.branch);phase='SAVE_CONTENT';const result=await github('/graphql',{method:'POST',body:JSON.stringify(input)}),oid=result.data?.createCommitOnBranch?.commit?.oid;
    requirePolicy(!result.errors?.length&&SHA.test(oid||'')&&oid!==state.headSha,'保存结果未确认。');
    requirePolicy(await head(state.branch)===oid,'保存后的分支身份不符。');
    commits.push(oid);for(const path of touched)paths.add(path);state.headSha=oid;return result;
   }catch(error){return stop(error,phase);}
  });
 }
 async function submit(){
  requirePolicy(enabled&&state.state==='EDITING'&&commits.length>0,'没有可提交的已保存变更。');
  return exclusive(async()=>{
   let phase='VERIFY_SCOPE';
   try{await identity();requirePolicy(await head('main')===state.baseSha,'main已变化，请保留分支并检查差异。');requirePolicy(await head(state.branch)===state.headSha,'编辑分支已有其他更新。');
    const diff=await github(PREFIX+'/compare/'+state.baseSha+'...'+state.headSha);
    requirePolicy(diff.status==='ahead'&&diff.behind_by===0&&diff.total_commits===commits.length&&diff.commits?.length===commits.length&&diff.commits.every((c,i)=>c.sha===commits[i]),'分支包含未记录提交。');
    requirePolicy(Array.isArray(diff.files)&&diff.files.length>0&&diff.files.length<=64,'没有净变更或文件超限。');
    for(const file of diff.files){requirePolicy(['added','modified','removed','renamed'].includes(file.status)&&permittedPath(file.filename)&&paths.has(file.filename),'分支包含未批准文件。');if(file.status==='renamed')requirePolicy(permittedPath(file.previous_filename)&&paths.has(file.previous_filename),'重命名范围不符。');}
    // Recheck after potentially slow comparison. Never update/rebase main or an unknown branch.
    requirePolicy(await head('main')===state.baseSha&&await head(state.branch)===state.headSha,'提交前分支已变化。');
    await noProposal(state.branch);phase='CREATE_PULL_REQUEST';const pr=await github(PREFIX+'/pulls',{method:'POST',body:JSON.stringify({title:'Editorial CMS content proposal',head:state.branch,base:'main',body:'Saved with Sveltia on a content-only staging branch. Await checks and review. Neither site deployment is confirmed.',draft:false,maintainer_can_modify:false})});
    const url='https://github.com/'+REPO+'/pull/'+pr.number;
    requirePolicy(Number.isSafeInteger(pr.number)&&pr.number>0&&pr.state==='open'&&pr.merged===false&&pr.head?.ref===state.branch&&pr.head.sha===state.headSha&&pr.head.repo?.id===ID&&pr.base?.ref==='main'&&pr.base.sha===state.baseSha&&pr.base.repo?.id===ID&&pr.html_url===url,'PR身份不符。');
    state={...state,state:'PULL_REQUEST_OPEN',pullRequestNumber:pr.number,url};return status();
   }catch(error){return stop(error,phase);}
  });
 }
 async function inspect(){
  requirePolicy(enabled&&state.state==='PULL_REQUEST_OPEN','当前会话没有可追踪的CMS提案。');
  return inspectContentProposal({github,original:{state:'PULL_REQUEST_OPEN',branch:state.branch,baseSha:state.baseSha,commitSha:state.headSha,pullRequestNumber:state.pullRequestNumber,url:state.url,merged:false,deploymentConfirmed:false}});
 }
 function recoverySnapshot(){
  if(pending||!['EDITING','PULL_REQUEST_OPEN'].includes(state.state))return null;
  const s={state:state.state,branch:state.branch,baseSha:state.baseSha,headSha:state.headSha,commits:[...commits],paths:[...paths]};
  if(state.state==='PULL_REQUEST_OPEN'){s.pullRequestNumber=state.pullRequestNumber;s.url=state.url;}
  return validateWorkspaceSnapshot(s);
 }
 async function restore(snapshot){
  requirePolicy(enabled&&state.state==='NOT_STARTED','只能向尚未开始的当前会话恢复。');const saved=validateWorkspaceSnapshot(snapshot);
  return exclusive(async()=>{
   try{await identity();
    if(saved.state==='EDITING'){
     requirePolicy(await head('main')===saved.baseSha&&await head(saved.branch)===saved.headSha,'恢复版本与远端不一致，保留分支并停止。');await noProposal(saved.branch);
     if(saved.commits.length){const diff=await github(PREFIX+'/compare/'+saved.baseSha+'...'+saved.headSha);
      requirePolicy(diff.status==='ahead'&&diff.behind_by===0&&diff.total_commits===saved.commits.length&&diff.commits?.length===saved.commits.length&&diff.commits.every((c,i)=>c.sha===saved.commits[i])&&Array.isArray(diff.files)&&diff.files.length<=64,'恢复提交范围不符。');
      for(const file of diff.files){requirePolicy(['added','modified','removed','renamed'].includes(file.status)&&saved.paths.includes(file.filename),'恢复分支包含未记录文件。');if(file.status==='renamed')requirePolicy(saved.paths.includes(file.previous_filename),'恢复重命名范围不符。');}
     }
     requirePolicy(await head('main')===saved.baseSha&&await head(saved.branch)===saved.headSha,'恢复核验期间远端变化。');
    }else{
     const result=await inspectContentProposal({github,original:{state:'PULL_REQUEST_OPEN',branch:saved.branch,baseSha:saved.baseSha,commitSha:saved.headSha,pullRequestNumber:saved.pullRequestNumber,url:saved.url,merged:false,deploymentConfirmed:false}});
     requirePolicy(result.state!=='PROPOSAL_CHANGED','恢复PR已有其他更新。');
    }
    state={state:saved.state,branch:saved.branch,baseSha:saved.baseSha,headSha:saved.headSha,deploymentConfirmed:false,...(saved.state==='PULL_REQUEST_OPEN'?{pullRequestNumber:saved.pullRequestNumber,url:saved.url}:{})};
    commits.push(...saved.commits);for(const path of saved.paths)paths.add(path);return status();
   }catch(error){state={...state,branch:saved.branch,baseSha:saved.baseSha,headSha:saved.headSha};return stop(error,'RESTORE_VERIFY');}
  });
 }
 return {status,begin,mutate,submit,inspect,recoverySnapshot,restore};
}
