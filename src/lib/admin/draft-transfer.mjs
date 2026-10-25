/** Portable local drafts only. No browser token, preview session or unrelated storage. */
import { createDraftId, draftStorageKey } from './draft-storage.mjs';
const PREFIX='tkkdy-editorial:';
const IDS=/^(?:draft-[a-zA-Z0-9-]{8,}|(?:article|essay|fragment)-[a-zA-Z0-9-]+|new-story)$/;
const STRINGS=['title','deck','body','type','status','slug','publishedAt','updatedAt','cover','coverAlt','sourcePath','sourceBlobSha'];
const LIMIT=20_000_000;
function draft(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('草稿内容格式错误。');
 const out={};for(const key of STRINGS)if(typeof value[key]==='string')out[key]=value[key];
 if(!['Article','Essay','Fragment'].includes(out.type)||typeof out.body!=='string')throw Error('草稿缺少正文或内容类型。');
 for(const key of ['categories','tags'])out[key]=Array.isArray(value[key])?value[key].filter(x=>typeof x==='string'):[];
 for(const key of ['showOnHomepage','featured'])out[key]=value[key]===true;
 for(const key of ['publishNumber','editorVersion'])if(Number.isSafeInteger(value[key])&&value[key]>0)out[key]=value[key];
 // Preserve the editor document as inert JSON. Rendering must independently sanitize imported content.
 if(value.bodyBlocks?.type==='doc'&&Array.isArray(value.bodyBlocks.content))out.bodyBlocks=value.bodyBlocks;
 if(out.sourcePath&&!/^src\/content\/(articles|essays|fragments)\/[a-zA-Z0-9_-]+\.md$/.test(out.sourcePath))throw Error('草稿来源路径错误。');
 return out;
}
export function exportDrafts(storage,now=new Date()){
 const drafts=[],skipped=[];
 for(let i=0;i<storage.length;i++){
  const key=storage.key(i);if(!key?.startsWith(PREFIX)||!IDS.test(key.slice(PREFIX.length)))continue;
  try{drafts.push({originalId:key.slice(PREFIX.length),state:draft(JSON.parse(storage.getItem(key)))});}catch(error){skipped.push({key,error:String(error)});}
 }
 if(drafts.length>100)throw Error('草稿超过100项，请先整理后分批迁移。');
 const result={format:'tkkdy-editorial-drafts',version:1,exportedAt:now.toISOString(),drafts};
 if(new TextEncoder().encode(JSON.stringify(result)).length>LIMIT)throw Error('草稿包超过20MB，请先缩小本地图片。');
 return {bundle:result,skipped};
}
export function importDrafts(raw,storage,cryptoSource=globalThis.crypto){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>LIMIT)throw Error('草稿包格式错误或超过20MB。');
 const bundle=JSON.parse(raw);
 if(bundle?.format!=='tkkdy-editorial-drafts'||bundle.version!==1||!Array.isArray(bundle.drafts)||bundle.drafts.length>100)throw Error('不支持的草稿包。');
 const staged=bundle.drafts.map(item=>({state:draft(item.state)})),used=new Set();
 for(const item of staged){
  const id=createDraftId(cryptoSource),key=draftStorageKey(id);
  if(storage.getItem(key)!==null||used.has(key))throw Error('新草稿标识冲突，未导入或覆盖任何现有草稿。');
  used.add(key);Object.assign(item,{id,key,value:JSON.stringify({...item.state,id})});
 }
 const written=[];
 try{for(const item of staged){storage.setItem(item.key,item.value);written.push(item);}}
 catch(error){for(const item of written)if(storage.getItem(item.key)===item.value)storage.removeItem(item.key);throw Error('浏览器存储空间不足或不可用，导入已撤回，原草稿保留。');}
 return staged.map(({id,state})=>({id,title:state.title||'无标题草稿',sourcePath:state.sourcePath}));
}
