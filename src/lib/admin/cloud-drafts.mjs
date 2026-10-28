/** Optimistic revisions: one writer wins; conflicts never silently replace another device. */
export function createCloudDraftClient({key,fetchImpl=fetch,session}){
 let revision=0,tail=Promise.resolve(),conflict=false;
 async function request(options={}){
  const r=await fetchImpl('/api/drafts'+(options.method?'':'?key='+encodeURIComponent(key)),{credentials:'same-origin',cache:'no-store',...options});
  const body=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(body.error||(r.status===401?'登录已过期；当前内容仍在此页，请重新登录后重试。':'草稿同步失败；当前内容仍在此页。')),{status:r.status});return body;
 }
 return {
  async load(){const {draft}=await request();revision=draft?.revision??0;return draft;},
  save(state){const captured=structuredClone(state);const result=tail.then(async()=>{if(conflict)throw Object.assign(Error('另一台设备已保存，请先处理冲突。'),{status:409});const auth=await session();const {draft}=await request({method:'POST',headers:{'Content-Type':'application/json','X-Admin-CSRF':auth.csrf},body:JSON.stringify({key,state:captured,expectedRevision:revision})});revision=draft.revision;return draft;}).catch(e=>{if(e.status===409)conflict=true;throw e;});tail=result.catch(()=>{});return result;},
  get revision(){return revision;}
 };
}
