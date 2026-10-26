// Fixed-version CMS edits a real branch. Never masquerade PR preparation as a main commit.
const status=document.querySelector('[data-status]'),begin=document.querySelector('[data-begin]'),submit=document.querySelector('[data-submit]'),refresh=document.querySelector('[data-refresh]'),link=document.querySelector('[data-pr]'),frame=document.querySelector('iframe');
const deployments=document.querySelector('[data-deployments]');
const recoveryList=document.querySelector('[data-recovery-list]'),restoreButton=document.querySelector('[data-restore]'),exportButton=document.querySelector('[data-export]'),importButton=document.querySelector('[data-import]'),importFile=document.querySelector('[data-import-file]'),recoveryNote=document.querySelector('[data-recovery-note]');
const recoveryKey='editorial-cms:recovery-records-v1';let records=[],currentReceipt=null;
try{const keys=Object.keys(localStorage).filter(k=>k.startsWith(recoveryKey+':'));if(keys.length>50)throw Error();records=keys.map(k=>{const raw=localStorage.getItem(k);if(!raw||raw.length>33000)throw Error();const r=JSON.parse(raw);if(typeof r.receipt!=='string'||r.receipt.length>32000||typeof r.branch!=='string')throw Error();return r;});}catch{recoveryNote.textContent='部分本地恢复记录无法读取，未覆盖原记录；可导入已导出的恢复文件。';}

function recoveryOptions(){const selected=recoveryList.value;recoveryList.replaceChildren(new Option('请选择',''),...records.map((r,i)=>new Option(r.branch+' · '+(r.state??'待核验'),String(i))));recoveryList.value=selected;restoreButton.disabled=busy||session?.cmsWorkspace?.state!=='NOT_STARTED'||!recoveryList.value;exportButton.disabled=!currentReceipt&&!recoveryList.value;}
function remember(){
 const receipt=session.cmsRecoveryReceipt,w=session.cmsWorkspace;if(!receipt)return;currentReceipt=receipt;
 const key=recoveryKey+':'+w.branch,entry={branch:w.branch,state:w.state,headSha:w.headSha,commitCount:w.commitCount,receipt};
 try{const raw=localStorage.getItem(key),old=raw?JSON.parse(raw):null;
  if(old&&(typeof old.receipt!=='string'||!Number.isSafeInteger(old.commitCount)||old.commitCount>w.commitCount||old.state==='PULL_REQUEST_OPEN'&&w.state!=='PULL_REQUEST_OPEN'||old.commitCount===w.commitCount&&old.headSha!==w.headSha))throw Error();
  if(!old&&Object.keys(localStorage).filter(k=>k.startsWith(recoveryKey+':')).length>=50)throw Error();
  localStorage.setItem(key,JSON.stringify(entry));const index=records.findIndex(r=>r.branch===w.branch);if(index<0)records.push(entry);else records[index]=entry;
  recoveryNote.textContent='已保存签名恢复元数据；未确认的写入不会自动重放。';
 }catch{recoveryNote.textContent='未覆盖旧恢复记录，请导出当前记录；可能存在较新记录、记录损坏或存储限制。';}
 recoveryOptions();
}

let session,busy=false,failure=null,readGeneration=0;
function targetRows(message){deployments.replaceChildren(...[['GitHub Pages','pages'],['VPS','vps']].map(([label,target])=>{const row=document.createElement('p');row.dataset.targetStatus=target;row.textContent=label+'：'+message;return row;}));}
async function track(){
 const generation=++readGeneration;targetRows('正在核对提案，尚未确认部署。');
 try{
 const r=await fetch('/api/cms-workspace/status',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('提案状态核验失败，未确认部署。');
 const p=await r.json();if(generation!==readGeneration)return;
 const w=session.cmsWorkspace;if(p.pullRequestNumber!==w.pullRequestNumber||p.branch!==w.branch||p.commitSha!==w.headSha||p.url!==w.url||p.deploymentConfirmed!==false)throw Error('提案身份或状态不符。');
 if(p.state!=='MERGED_ON_MAIN'){const label={PULL_REQUEST_OPEN:'提案待合并，尚未部署。',PULL_REQUEST_CLOSED:'提案已关闭且未合并。',PROPOSAL_CHANGED:'提案已被修改，停止追踪。'}[p.state];if(!label||p.merged!==false)throw Error('提案状态无效。');targetRows(label);return;}
 if(p.merged!==true||!/^[a-f0-9]{40}$/.test(p.mergedSha||''))throw Error('最终合并版本无效。');
 targetRows('已合并 '+p.mergedSha.slice(0,12)+'，正在分别核对两站。');
 const d=await fetch('/api/deployments?sha='+encodeURIComponent(p.mergedSha),{credentials:'same-origin',cache:'no-store'});if(!d.ok)throw Error('两站核验失败，未确认部署。');
 const body=await d.json();if(generation!==readGeneration)return;
 if(!Array.isArray(body.targets)||body.targets.length!==2||new Set(body.targets.map(t=>t.target)).size!==2||!body.targets.every(t=>['pages','vps'].includes(t.target)&&t.expectedSha===p.mergedSha))throw Error('两站状态响应无效。');
 if(!body.targets.every(t=>['CURRENT_VERSION_VERIFIED','VERSION_DIFFERS','UNKNOWN','FAILED','NOT_DEPLOYED'].includes(t.status)&&(t.actualSha===null||/^[a-f0-9]{40}$/.test(t.actualSha||''))&&(t.status!=='CURRENT_VERSION_VERIFIED'||t.actualSha===p.mergedSha&&t.httpStatus===200)))throw Error('两站版本与健康状态不符。');
 const labels={CURRENT_VERSION_VERIFIED:'公开版本标记与健康检查匹配',VERSION_DIFFERS:'仍为其他版本',UNKNOWN:'状态未知',FAILED:'健康检查失败',NOT_DEPLOYED:'尚未部署'};
 deployments.replaceChildren(...['pages','vps'].map(target=>{const t=body.targets.find(t=>t.target===target),row=document.createElement('p');row.dataset.targetStatus=target;row.textContent=(target==='pages'?'GitHub Pages':'VPS')+'：'+(labels[t.status]??'状态未知')+'；实际版本 '+(t.actualSha?.slice(0,12)??'未知')+'；流水线 '+(t.pipeline?.state??'UNKNOWN')+'。仅核验版本标记与HTTP健康，不代表完整功能验收。';return row;}));
 }catch(error){if(generation===readGeneration)targetRows(error.message);}
}

async function read(){
 const generation=++readGeneration;targetRows('正在核对会话，尚未确认部署。');
 try{const r=await fetch('/api/session',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('登录已失效，请返回 Studio 重新登录。');const next=await r.json();if(generation!==readGeneration)return;session=next;if(!session.authenticated||session.publicationMode!=='pull-request')throw Error('此入口仅用于已登录的内容 PR 模式。');remember();render();if(session.cmsWorkspace.state==='PULL_REQUEST_OPEN')await track();else targetRows('尚未提交可追踪提案，未确认部署。');}
 catch(error){if(generation===readGeneration)targetRows(error.message);throw error;}
}
function render(){recoveryOptions();const w=session.cmsWorkspace;begin.hidden=w.state!=='NOT_STARTED';begin.disabled=busy;submit.hidden=w.state!=='EDITING';submit.disabled=busy||!w.commitCount;refresh.disabled=busy;
 status.textContent=failure??(w.state==='NOT_STARTED'?'尚未创建分支；此操作不会修改 main。':`状态：${w.state==='PULL_REQUEST_OPEN'?'编辑已冻结，提案状态见下方':w.state}；分支：${w.branch}；已确认保存 ${w.commitCount} 次。尚未确认双站部署。`);
 if(w.state==='EDITING'&&!frame.src){frame.src='./sveltia-workspace.html';frame.hidden=false;}
 if(w.state!=='EDITING'){frame.hidden=true;frame.removeAttribute('src');}
 if(w.state==='PULL_REQUEST_OPEN'){link.href=w.url;link.hidden=false;}
}
async function act(action,receipt){if(busy)return;busy=true;failure=null;render();try{const r=await fetch('/api/cms-workspace',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Admin-CSRF':session.csrf},body:JSON.stringify(action==='restore'?{action,receipt}:{action})});if(!r.ok)throw Error((await r.json()).error||'操作未确认；不要重复提交，请保留分支并核对。');await read();}catch(error){try{await read();}catch{}failure=error.message;status.textContent=failure;}finally{busy=false;if(session)render();}}
recoveryList.addEventListener('change',recoveryOptions);
restoreButton.addEventListener('click',()=>{const selected=records[Number(recoveryList.value)];if(recoveryList.value&&selected)act('restore',selected.receipt);});
exportButton.addEventListener('click',()=>{const selected=recoveryList.value?records[Number(recoveryList.value)]:null,receipt=selected?.receipt??currentReceipt;if(!receipt)return;const url=URL.createObjectURL(new Blob([JSON.stringify({schema:1,receipt})],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='editorial-cms-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
importButton.addEventListener('click',()=>importFile.click());importFile.addEventListener('change',async()=>{try{const file=importFile.files?.[0];if(!file||file.size>33000)throw Error();const parsed=JSON.parse(await file.text());if(parsed.schema!==1||typeof parsed.receipt!=='string'||parsed.receipt.length>32000||Object.keys(parsed).length!==2||records.length>=50)throw Error();records.push({branch:'导入记录（待服务端核验）',state:'待核验',receipt:parsed.receipt});recoveryOptions();recoveryList.value=String(records.length-1);recoveryOptions();recoveryNote.textContent='已导入，尚未信任；选择核验并恢复后由服务端检查签名和远端版本。';}catch{recoveryNote.textContent='恢复文件无效或过大，未替换现有工作区。';}finally{importFile.value='';}});
addEventListener('message',event=>{if(event.origin===location.origin&&event.source===frame.contentWindow&&event.data==='CMS_SAVE_COMPLETED')read().catch(error=>{status.textContent=error.message;});});
begin.addEventListener('click',()=>act('begin'));submit.addEventListener('click',()=>{if(confirm('请先完成并保存编辑器中的所有变更。确认将当前已保存分支提交为 PR？未保存的编辑不会包含在内。'))act('submit');});refresh.addEventListener('click',()=>read().catch(error=>{status.textContent=error.message;}));
await read().catch(error=>{status.textContent=error.message;});
