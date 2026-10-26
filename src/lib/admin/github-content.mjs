const API_ROOT = '/api/v3';
function bytesToBase64(bytes) {let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary);}
function base64ToText(value){return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\n/g,'')),c=>c.charCodeAt(0)));}
export function textToBase64(value){return bytesToBase64(new TextEncoder().encode(value));}
/** Browser receives an opaque session-bound CSRF value, never a GitHub token. */
export async function readAdminSession(){
 const r=await fetch('/api/session',{credentials:'same-origin',cache:'no-store'});
 if(!r.ok)throw Object.assign(new Error('请先在受保护的编辑站登录；静态站上的草稿可导出后迁移。'),{status:r.status});return r.json();
}
export function createGitHubClient({owner,repo,branch,csrf}){
 if(!branch||!csrf)throw Error('缺少认证会话。');
 async function request(path,options={}){
  const r=await fetch(path,{...options,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(options.method==='POST'?{'Content-Type':'application/json','X-Admin-CSRF':csrf}:{}),...options.headers}});
  const result=await r.json().catch(()=>({}));if(!r.ok||result.errors?.length)throw Object.assign(Error(result.error||'仓库操作失败；内容尚未确认写入。'),{status:r.status});return result;
 }
 return{
  branch,
  async deploymentStatus(sha){return request('/api/deployments?sha='+encodeURIComponent(sha));},
  async authenticate(){return request(API_ROOT+'/user');},
  async getHead(){return (await request(`${API_ROOT}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`)).object.sha;},
  async readFile(path,ref=branch){try{const f=await request(`${API_ROOT}/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g,'/')}?ref=${encodeURIComponent(ref)}`);if(f.type!=='file'||!f.content)throw Error('内容文件无法读取。');return{path,sha:f.sha,content:base64ToText(f.content)};}catch(e){if(e.status===404)return null;throw e;}},
  async proposeFiles({requestId=crypto.randomUUID(),expectedHeadOid,message,files,deletePaths=[]}){
   if(!/^[a-f0-9]{40}$/.test(expectedHeadOid||''))throw Error('内容基准版本失效。');
   const proposal=await request('/api/proposals',{method:'POST',body:JSON.stringify({requestId,expectedHeadOid,message:{headline:message},fileChanges:{additions:files.map(f=>({path:f.path,contents:f.contentBase64})),deletions:deletePaths.map(path=>({path}))}})});
   if(proposal.state!=='PULL_REQUEST_OPEN'||proposal.merged!==false||proposal.deploymentConfirmed!==false||!/^[a-f0-9]{40}$/.test(proposal.commitSha||'')||proposal.baseSha!==expectedHeadOid||proposal.branch!=='codex/editorial-proposal-'+requestId||!Number.isSafeInteger(proposal.pullRequestNumber)||proposal.pullRequestNumber<1||proposal.url!==`https://github.com/${owner}/${repo}/pull/${proposal.pullRequestNumber}`)throw Error('提案结果尚未核实。');
   return {sha:proposal.commitSha,proposal};
  },
  async commitFiles({branch:target=branch,expectedHeadOid,message,files,deletePaths=[]}){
   if(target!==branch||!/^[a-f0-9]{40}$/.test(expectedHeadOid||''))throw Error('分支或基准版本失效。');
   const input={branch:{repositoryNameWithOwner:`${owner}/${repo}`,branchName:branch},expectedHeadOid,message:{headline:message},fileChanges:{additions:files.map(f=>({path:f.path,contents:f.contentBase64})),deletions:deletePaths.map(path=>({path}))}};
   const result=await request('/api/graphql',{method:'POST',body:JSON.stringify({query:'mutation($input:CreateCommitOnBranchInput!){createCommitOnBranch(input:$input){commit{oid}}}',variables:{input}})});return{sha:result.data.createCommitOnBranch.commit.oid,proposal:null};
  },
 };
}

/** Git blob identity of the exact UTF-8 bytes sent to createCommitOnBranch. */
export async function gitBlobSha(text){
 const bytes=new TextEncoder().encode(text),header=new TextEncoder().encode('blob '+bytes.length+'\0'),buffer=new Uint8Array(header.length+bytes.length);buffer.set(header);buffer.set(bytes,header.length);
 return [...new Uint8Array(await crypto.subtle.digest('SHA-1',buffer))].map(value=>value.toString(16).padStart(2,'0')).join('');
}
