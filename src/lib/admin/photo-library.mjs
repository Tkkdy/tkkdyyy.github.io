import YAML from 'yaml';
import {createCloudDraftClient} from './cloud-drafts.mjs';

export function photoDocument(raw){
 const front=raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
 if(!front)throw Error('照片信息格式无效。');
 const doc=YAML.parseDocument(front[1]);if(doc.errors.length)throw Error('照片信息格式无效。');
 return doc.toJS({maxAliasCount:0});
}
export function photoPreviewUrl(value=''){
 if(/^data:image\/(?:webp|png|jpeg);base64,/.test(value))return value;
 if(value.startsWith('/')&&!value.startsWith('//'))return new URL(value,'https://tkkdy.me').href;
 try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{}
 return '';
}
export function photoLibraryRecords(resources,drafts){
 const photos=resources.filter(x=>x.type==='Image');
 const byPath=new Map(photos.map(x=>[x.sourcePath,x]));
 const active=drafts.filter(d=>d?.state?.type==='Image'&&!(d.state.publication?.publishedContent&&(d.state.publication.publishedContent===byPath.get(d.state.sourcePath)?.rawContent||d.merged&&byPath.has(d.state.sourcePath))));
 const records=[];
 for(const live of photos){
  const data=photoDocument(live.rawContent);
  if(data.status!=='published')continue;
  const edits=active.filter(d=>d.state.sourcePath===live.sourcePath);
  const draft=edits.find(d=>d.key===live.sourcePath)||edits[0];
  records.push({key:live.sourcePath,state:live,data,tab:'published',draft,live});
 }
 for(const draft of active)records.push({key:draft.key,state:draft.state,data:photoDocument(draft.state.rawContent),tab:'drafts',draft,live:byPath.get(draft.state.sourcePath)});
 for(const live of photos){if(photoDocument(live.rawContent).status!=='published'&&!active.some(d=>d.state.sourcePath===live.sourcePath))records.push({key:live.sourcePath,state:live,data:photoDocument(live.rawContent),tab:'drafts',live});}
 return records;
}
export function photoLibraryGroups(records,tab){
 const groups=new Map();
 for(const record of records.filter(r=>r.tab===tab)){
  const series=String(record.data.series||'').trim();const key=series?'series:'+series:'ungrouped';
  if(!groups.has(key))groups.set(key,{key,title:series||'未分组',photos:[]});
  groups.get(key).photos.push(record);
 }
 return [...groups.values()];
}
export async function readPhotoLibrary(session,request){
 const [catalog,index]=await Promise.all([request('/api/stories'),request('/api/drafts')]);
 const summaries=(index.drafts||[]).filter(d=>d.type==='Image'),drafts=[],failures=[];
 let cursor=0;
 await Promise.all(Array.from({length:Math.min(4,summaries.length)},async()=>{
  while(cursor<summaries.length){const item=summaries[cursor++];try{
   const client=createCloudDraftClient({key:item.key,session}),draft=await client.load();
   if(draft)drafts.push({...draft,client});
  }catch(error){failures.push({key:item.key,title:item.title,message:error.message});}}
 }));
 // A prior successful receipt stays historical after later metadata edits.
 const receipts=new Map();
 for(const draft of drafts){
  const publication=draft.state.publication,live=catalog.resources?.find(r=>r.sourcePath===draft.state.sourcePath);
  const match=publication?.url?.match(/^https:\/\/github\.com\/Tkkdy\/tkkdyyy\.github\.io\/pull\/(\d+)$/);
  if(live&&publication?.publishedContent&&publication.publishedContent!==live.rawContent&&match){
   if(!receipts.has(match[1]))receipts.set(match[1],request('/api/proposals/'+match[1]).catch(()=>null));
   draft.merged=(await receipts.get(match[1]))?.state==='MERGED_ON_MAIN';
  }
 }
 drafts.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
 return {catalog,drafts,failures,records:photoLibraryRecords(catalog.resources||[],drafts)};
}
