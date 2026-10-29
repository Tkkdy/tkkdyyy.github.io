import {proposalRecords,rememberProposal} from './proposal-history.mjs';
import {readAdminSession} from './github-content.mjs';
const root=document.querySelector('[data-proposal-history]');
if(root){
 const list=root.querySelector('[data-history-select]'),refresh=root.querySelector('[data-history-refresh]'),exportButton=root.querySelector('[data-history-export]'),importButton=root.querySelector('[data-history-import]'),file=root.querySelector('[data-history-file]'),note=root.querySelector('[data-history-note]'),link=root.querySelector('[data-history-pr]'),targets=root.querySelector('[data-history-targets]');
 const resume=root.querySelector('[data-history-resume]');
 let verified=null;
 resume.addEventListener('click',async()=>{if(!verified)return;resume.disabled=true;try{const session=await readAdminSession();const r=await fetch('/api/proposals/'+verified.pullRequestNumber+'/publish',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Admin-CSRF':session.csrf},body:JSON.stringify({expectedSha:verified.commitSha})});const p=await r.json();if(!r.ok)throw Error(p.error||'恢复失败');note.textContent='发布任务：'+p.state+'；请核验后续状态。';}catch(e){note.textContent=e.message;}});
 let records=[],generation=0,busy=false;
 function rows(message){targets.replaceChildren(...['pages','vps'].map(t=>{const p=document.createElement('p');p.dataset.historyTarget=t;p.textContent=(t==='pages'?'GitHub Pages':'VPS')+'：'+message;return p;}));}
 function controls(){refresh.disabled=busy||!list.value;exportButton.disabled=!list.value;importButton.disabled=busy;}
 function options(){list.replaceChildren(new Option('请选择',''),...records.map((r,i)=>new Option(r.number?'PR #'+r.number:'导入记录（待核验）',String(i))));list.value='';controls();}
 function changed(){verified=null;resume.disabled=true;generation++;link.hidden=true;rows('尚未核验');controls();}
 try{records=proposalRecords(localStorage);note.textContent='本地仅保存签名元数据；请选择后显式核验。';}catch(e){note.textContent=e.message;}options();rows('尚未核验');list.addEventListener('change',changed);
 refresh.addEventListener('click',async()=>{
  if(busy||!list.value)return;const record=records[Number(list.value)],g=++generation;busy=true;controls();link.hidden=true;rows('正在核验，尚未确认部署');
  try{
   const session=await readAdminSession();if(!session.authenticated||session.publicationMode!=='pull-request')throw Error('当前会话不是内容PR模式。');
   const response=await fetch('/api/proposals/restore',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Admin-CSRF':session.csrf},body:JSON.stringify({receipt:record.receipt})});
   verified=null;resume.disabled=true;const p=await response.json();if(!response.ok)throw Error(p.error||'提案恢复未确认。');if(g!==generation)return;
   if(!Number.isSafeInteger(p.pullRequestNumber)||p.pullRequestNumber<1||(record.number&&record.number!==p.pullRequestNumber)||p.url!=='https://github.com/Tkkdy/tkkdyyy.github.io/pull/'+p.pullRequestNumber||!/^codex\/editorial-proposal-[a-f0-9-]{36}$/.test(p.branch||'')||!/^[a-f0-9]{40}$/.test(p.commitSha||'')||p.deploymentConfirmed!==false)throw Error('提案响应身份无效。');
   try{rememberProposal({...p,recoveryReceipt:record.receipt},localStorage);record.number=p.pullRequestNumber;}catch{note.textContent='已核验，但未覆盖本地记录；请导出当前记录。';}
   link.href=p.url;link.hidden=false;
   if(p.state==='PULL_REQUEST_OPEN'){verified=p;resume.disabled=!session.contentAutoMergeEnabled;}
   if(p.state!=='MERGED_ON_MAIN'){const text={PULL_REQUEST_OPEN:'提案待合并，尚未部署',PULL_REQUEST_CLOSED:'提案已关闭且未合并'}[p.state];if(!text||p.merged!==false)throw Error('提案状态尚未核实。');rows(p.publication?.state==='WAITING'?'等待CI与保护规则，自动发布任务运行中':p.publication?.state&&p.publication.state!=='MANUAL'&&p.publication.state!=='NOT_REQUESTED'?text+'；发布任务 '+p.publication.state:text);return;}
   if(p.merged!==true||!/^[a-f0-9]{40}$/.test(p.mergedSha||''))throw Error('最终合并版本无效。');
   const d=await fetch('/api/deployments?sha='+encodeURIComponent(p.mergedSha),{credentials:'same-origin',cache:'no-store'});if(!d.ok)throw Error('两站状态查询失败。');const report=await d.json();if(g!==generation)return;
   if(!Array.isArray(report.targets)||report.targets.length!==2||new Set(report.targets.map(t=>t.target)).size!==2||!report.targets.every(t=>['pages','vps'].includes(t.target)&&t.expectedSha===p.mergedSha&&['CURRENT_VERSION_VERIFIED','VERSION_DIFFERS','UNKNOWN','FAILED','NOT_DEPLOYED'].includes(t.status)&&(t.actualSha===null||/^[a-f0-9]{40}$/.test(t.actualSha||''))&&(t.status!=='CURRENT_VERSION_VERIFIED'||t.actualSha===p.mergedSha&&t.httpStatus===200)))throw Error('两站版本响应尚未核实。');
   const labels={CURRENT_VERSION_VERIFIED:'公开版本与HTTP健康匹配',VERSION_DIFFERS:'仍为其他版本',UNKNOWN:'状态未知',FAILED:'健康检查失败',NOT_DEPLOYED:'尚未部署'};
   targets.replaceChildren(...['pages','vps'].map(t=>{const data=report.targets.find(x=>x.target===t),p=document.createElement('p');p.dataset.historyTarget=t;p.textContent=(t==='pages'?'GitHub Pages':'VPS')+'：'+labels[data.status]+'；实际 '+(data.actualSha?.slice(0,12)??'未知')+'；流水线 '+(data.pipeline?.state??'UNKNOWN');return p;}));
  }catch(e){if(g===generation){link.hidden=true;rows('核验失败：'+e.message);}}finally{busy=false;controls();}
 });
 exportButton.addEventListener('click',()=>{if(!list.value)return;const receipt=records[Number(list.value)].receipt,url=URL.createObjectURL(new Blob([JSON.stringify({schema:1,receipt})],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='editorial-studio-proposal.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 importButton.addEventListener('click',()=>file.click());file.addEventListener('change',async()=>{try{const f=file.files?.[0];if(!f||f.size>33000||records.length>=50)throw Error();const r=JSON.parse(await f.text());if(r.schema!==1||Object.keys(r).length!==2||typeof r.receipt!=='string'||r.receipt.length>32000)throw Error();records.push({receipt:r.receipt});options();list.value=String(records.length-1);changed();note.textContent='已导入，尚未信任；请显式核验。';}catch{note.textContent='导入记录无效或过大；未覆盖已有记录。';}finally{file.value='';}});
}
