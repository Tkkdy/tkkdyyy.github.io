import {createGitHubClient,gitBlobSha} from './github-content.mjs';
/** Explicit Publish only: restore the signed proposal; never create a replacement PR. */
export async function continueCloudPublication({record,session,fetchImpl=fetch}){
 const stop=()=>{throw Error('此云端草稿已有未核实的提交，请保留内容并在历史提案中核验；未重复创建 PR。');};
 if(!record||typeof record.recoveryReceipt!=='string'||!Number.isSafeInteger(record.pullRequestNumber)||record.pullRequestNumber<1||!/^src\/content\/(articles|essays|fragments)\/[^/]+\.md$/.test(record.sourcePath||'')||!/^[a-f0-9]{40}$/.test(record.sourceBlobSha||'')||session.repository!=='Tkkdy/tkkdyyy.github.io'||session.branch!=='main'||session.publicationMode!=='pull-request')return stop();
 const post=async(path,body)=>{const r=await fetchImpl(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Admin-CSRF':session.csrf},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'提案核验失败，未创建新 PR。');return d;};
 const p=await post('/api/proposals/restore',{receipt:record.recoveryReceipt});
 if(p.pullRequestNumber!==record.pullRequestNumber||p.branch!==record.branch||p.commitSha!==record.commitSha||p.url!=='https://github.com/Tkkdy/tkkdyyy.github.io/pull/'+p.pullRequestNumber||!['PULL_REQUEST_OPEN','MERGED_ON_MAIN','PULL_REQUEST_CLOSED'].includes(p.state))return stop();
 const github=createGitHubClient({owner:'Tkkdy',repo:'tkkdyyy.github.io',branch:'main',csrf:session.csrf});
 const file=await github.readFile(record.sourcePath,p.commitSha);
 if(!file||file.sha!==record.sourceBlobSha||await gitBlobSha(file.content)!==record.sourceBlobSha)return stop();
 if(p.state==='PULL_REQUEST_OPEN'&&session.contentAutoMergeEnabled&&p.publication?.state!=='WAITING')p.publication=await post('/api/proposals/'+p.pullRequestNumber+'/publish',{expectedSha:p.commitSha});
 return {proposal:p,github,commitSha:p.commitSha,branch:p.branch,sourcePath:record.sourcePath,sourceBlobSha:record.sourceBlobSha,publicUrl:p.url};
}
