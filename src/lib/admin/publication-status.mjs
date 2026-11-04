const TARGET_NAMES={pages:'GitHub Pages',vps:'正式站'};
const STEP_NAMES={save:'保存草稿',validate:'校验内容',git:'提交稿件',checks:'自动检查',merge:'合并内容',deploy:'核验两站上线'};
const RUN_URL=/^https:\/\/github\.com\/Tkkdy\/tkkdyyy\.github\.io\/actions\/runs\/[1-9][0-9]*$/;
export function checkStage(job,step){
 if(step?.includes('test:search'))return '中文搜索检查';
 if(step?.includes('npm run check'))return '内容与代码检查';
 if(step?.includes('npm run build'))return '页面构建';
 if(step?.includes('npm ci')||step?.includes('Install')||step?.includes('install'))return '准备构建环境';
 if(job==='isolated-acceptance')return '上线前隔离验收';
 if(job?.startsWith('profiles'))return '站点构建检查';
 return '自动检查';
}
const failureReason=reason=>({timed_out:'执行超时',cancelled:'执行已取消',action_required:'需要人工处理',startup_failure:'运行环境启动失败',stale:'检查已失效'})[reason]||'未通过';
function pendingTargets(detail){return ['pages','vps'].map(target=>({target,state:'waiting',text:`尚未开始部署；${detail}`}));}
export function proposalStatusView(proposal){
 const checks=proposal.checks,publication=proposal.publication?.state;
 const base={state:'running',summary:'稿件已提交，等待自动检查',detail:'稿件已保存为发布提案；两站尚未更新。',steps:{save:'success',validate:'success',git:'success',checks:'running',merge:'waiting',deploy:'waiting'},targets:pendingTargets('等待检查与合并'),done:false,runUrl:checks?.url,checkedAt:proposal.checkedAt};
 if(proposal.state==='PULL_REQUEST_CLOSED')return {...base,state:'failure',summary:'发布已停止：提案已关闭',detail:'稿件未合并，本次没有启动双站发布。',steps:{...base.steps,checks:'waiting',merge:'failure'},done:true};
 if(proposal.state==='PROPOSAL_CHANGED')return {...base,state:'failure',summary:'提案版本已变化，需要重新核对',detail:'当前提案与原发布记录不同，不能据此确认本次稿件已上线。请打开提案核对。',steps:{...base.steps,checks:'waiting',merge:'failure'},done:true};
 if(checks?.state==='FAILED'||publication==='CI_FAILED'){
  const stage=checkStage(checks?.job,checks?.step),reason=failureReason(checks?.reason);
  return {...base,state:'failure',summary:`发布受阻：${stage}${reason}`,detail:`稿件已保存，但${stage}${reason}，尚未合并；两站均未开始部署。可查看检查详情定位错误，修复后恢复此提案，无需重复创建。`,steps:{...base.steps,checks:'failure'},targets:pendingTargets(`${stage}${reason}`),done:true};
 }
 const stopped={NEEDS_UPDATE:['主线已有更新','请核对并更新此提案后重新检查。'],CONFLICT:['内容存在冲突','请先解决此提案的内容冲突。'],STOPPED:['发布结果尚未确认','请查看提案记录后恢复，避免重复提交。'],SESSION_EXPIRED:['登录会话已结束','请重新登录并恢复此提案。'],MANUAL:['等待人工合并','自动合并未启用，请在提案通过检查后合并。'],NOT_REQUESTED:['发布跟踪尚未恢复','请点击“发布”恢复此提案，不会重复创建稿件。']};
 if(stopped[publication]){const [reason,action]=stopped[publication];return {...base,state:'attention',summary:reason,detail:`稿件已提交，两站尚未开始部署。${action}`,steps:{...base.steps,checks:checks?.state==='PASSED'?'success':'waiting',merge:'waiting'},targets:pendingTargets(reason),done:true};}
 if(checks?.state==='PASSED')return {...base,summary:'检查已通过，等待合并',detail:'自动检查已通过，正在等待受保护的合并；两站尚未开始部署。',steps:{...base.steps,checks:'success',merge:'running'}};
 if(checks?.state==='PENDING')return {...base,summary:`稿件已提交，正在${checkStage(checks.job,checks.step)}`};
 if(checks?.state==='UNKNOWN')return {...base,detail:'稿件已提交，暂时无法确认检查进度；将继续查询，也可打开提案查看。'};
 return base;
}
const publicReasons={TARGET_NOT_CONFIGURED:'尚未配置此站的核验地址',VERSION_MARKER_UNAVAILABLE:'暂时读不到线上版本标识',INVALID_VERSION_MARKER:'线上版本标识无效',PUBLIC_CHECK_FAILED:'公网请求失败，尚未确认上线',PUBLIC_HEALTH_FAILED:'页面健康检查失败',REQUESTED_VERSION_NOT_LIVE:'线上仍是其他版本',TEST_BRANCH_NOT_PRODUCTION:'此分支不会发布到生产站',CONTENT_HEALTH_FAILED:'本篇内容页面访问失败'};
function targetView(target){
 const pipeline=target.pipeline||{},publicMatch=target.status==='CURRENT_VERSION_VERIFIED';
 const version=target.actualSha?`线上版本 ${target.actualSha.slice(0,8)}`:'线上版本尚未确认';
 const base={target:target.target,state:'waiting',text:'尚未确认上线',detail:version,runUrl:pipeline.url,live:false};
 if(pipeline.state==='FAILED')return {...base,state:'failure',text:`部署${failureReason(pipeline.reason)}`,detail:`${pipeline.job?.endsWith('-build')?'站点构建':'站点部署或验收'}${failureReason(pipeline.reason)}${pipeline.step?`（${pipeline.step}）`:''}；${version}。`};
 if(publicMatch&&pipeline.state==='SUCCEEDED')return {...base,state:'success',text:'已上线，本次版本核验通过',live:true,url:target.contentUrl||target.url};
 if(publicMatch)return {...base,state:'running',text:'页面已更新，部署验收尚未结束',detail:`${version}；发布流程仍需确认。`};
 if(pipeline.state==='SKIPPED'||pipeline.state==='NOT_REQUESTED')return {...base,state:'attention',text:'本次未执行部署',detail:publicReasons[target.reason]||'部署任务已跳过，请查看发布详情。'};
 if(target.status==='FAILED')return {...base,state:'failure',text:'页面健康检查未通过',detail:publicReasons[target.reason]||'公网访问检查失败。'};
 if(pipeline.state==='PENDING')return {...base,state:'running',text:pipeline.job?.endsWith('-build')?'正在构建':pipeline.job?.endsWith('-deploy')?'正在部署与验收':'等待部署任务',detail:`${version}${pipeline.step?`；当前步骤：${pipeline.step}`:''}`};
 return {...base,state:'attention',text:pipeline.state==='SUCCEEDED'?'部署流程已结束，线上版本仍待确认':'尚未确认上线',detail:`${publicReasons[target.reason]||'暂时无法核对公开版本'}；${version}。`};
}
export function deploymentStatusView(report){
 const targets=['pages','vps'].map(target=>targetView(report.targets?.find(row=>row.target===target)||{target}));
 const success=targets.every(t=>t.live),failure=targets.some(t=>t.state==='failure');
 const pipelines=report.targets||[];
 const terminal=['pages','vps'].every(name=>pipelines.some(t=>t.target===name&&['SUCCEEDED','SKIPPED','FAILED','NOT_REQUESTED'].includes(t.pipeline?.state)));
 return {state:success?'success':failure?'failure':'running',summary:success?'发布完成：两站均已上线':failure?'发布尚未完成：请查看站点失败原因':targets.some(t=>t.live)?'一站已上线，另一站尚未确认':'已合并，正在核验两站上线',detail:success?'两站的公开版本均与本次合并版本一致，页面健康检查及部署流程已通过。':'两站独立核验；只有公开版本与本次合并版本一致、页面可访问且部署流程成功，才显示已上线。',steps:{save:'success',validate:'success',git:'success',checks:'success',merge:'success',deploy:success?'success':failure?'failure':'running'},targets,done:success||(terminal&&pipelines.some(t=>['FAILED','SKIPPED','NOT_REQUESTED'].includes(t.pipeline?.state))),checkedAt:report.checkedAt};
}
export function renderPublicationStatus(root,view){
 const set=(selector,text)=>{const el=root.querySelector(selector);if(el)el.textContent=text||'';};
 const panel=root.querySelector('[data-publish-progress]');if(panel){panel.hidden=false;panel.dataset.state=view.state;}
 set('[data-publish-summary]',view.summary);set('[data-publish-detail]',view.detail);
 for(const [step,state]of Object.entries(view.steps||{})){const item=root.querySelector(`[data-publish-step="${step}"]`);if(item){item.dataset.status=state;item.dataset.marker=({success:'✓',running:'…',failure:'×',attention:'!',waiting:'○',skipped:'—'})[state]||'';item.textContent=`${STEP_NAMES[step]} · ${({success:'完成',running:'进行中',failure:'失败',attention:'待处理',waiting:'等待',skipped:'不适用'})[state]||'等待'}`;}}
 const assignLink=(el,url)=>{if(!el)return;el.hidden=!url;if(url)el.href=url;else el.removeAttribute('href');};
 assignLink(root.querySelector('[data-check-details]'),RUN_URL.test(view.runUrl||'')?view.runUrl:null);
 for(const target of view.targets||[]){set(`[data-target-status="${target.target}"]`,`${TARGET_NAMES[target.target]}：${target.text}`);set(`[data-target-detail="${target.target}"]`,target.detail);const row=root.querySelector(`[data-target-card="${target.target}"]`);if(row)row.dataset.state=target.state;
  assignLink(root.querySelector(`[data-target-log="${target.target}"]`),RUN_URL.test(target.runUrl||'')?target.runUrl:null);
  const base=target.target==='pages'?'https://tkkdy.github.io/tkkdyyy.github.io/':'https://tkkdy.me/';let safeUrl=base;try{const url=new URL(target.url);if(url.href.startsWith(base)&&!url.username&&!url.password)safeUrl=url.href;}catch{}assignLink(root.querySelector(`[data-target-link="${target.target}"]`),target.live?safeUrl:null);
 }
 const checked=view.checkedAt&&new Date(view.checkedAt);set('[data-publish-checked]',checked&&!Number.isNaN(checked.valueOf())?`最近核验：${checked.toLocaleTimeString('zh-CN',{hour12:false})}`:'');
}
