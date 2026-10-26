import test from 'node:test';import assert from 'node:assert/strict';
import {exportDrafts,importDrafts} from '../src/lib/admin/draft-transfer.mjs';
const state={title:'历史草稿',body:'正文',type:'Essay',status:'draft',slug:'sample',sourcePath:'src/content/essays/sample.md',cover:'data:image/png;base64,cGlj',bodyBlocks:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'正文'}]}]}};
function storage(initial={},quota=Infinity){const data=new Map(Object.entries(initial));return {get length(){return data.size},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem(k,v){if(!data.has(k)&&data.size>=quota)throw Error('quota');data.set(k,v)},removeItem:k=>data.delete(k),data};}
function crypto(){let i=0;return {randomUUID:()=>`00000000-0000-0000-0000-${String(++i).padStart(12,'0')}`};}
const bundle=s=>JSON.stringify(exportDrafts(s).bundle);
test('export includes historical draft text, local images and editor state, excludes credential keys and extra state fields',()=>{
 const s=storage({'tkkdy-editorial:essay-sample':JSON.stringify({...state,token:'PRIVATE-TEST-SECRET'}),'tkkdy-editorial:github-token':'PRIVATE-TEST-SECRET','tkkdy-editorial:preview':'private preview',unrelated:'private'});
 const raw=bundle(s);assert(!raw.includes('PRIVATE-TEST-SECRET'));assert(!raw.includes('private preview'));const out=JSON.parse(raw).drafts;assert.equal(out.length,1);assert.deepEqual(out[0].state.bodyBlocks,state.bodyBlocks);assert.equal(out[0].state.cover,state.cover);
});
test('import always makes a new draft and preserves existing draft and source association',()=>{
 const s=storage({'tkkdy-editorial:essay-sample':JSON.stringify(state)});const before=s.getItem('tkkdy-editorial:essay-sample');const out=importDrafts(bundle(s),s,crypto());assert.equal(s.length,2);assert.equal(s.getItem('tkkdy-editorial:essay-sample'),before);assert(out[0].id.startsWith('draft-'));assert.equal(out[0].sourcePath,state.sourcePath);
});
test('invalid version, excessive entries and non-content source paths are refused before storage writes',()=>{
 for(const obj of [{format:'bad',version:1,drafts:[]},{format:'tkkdy-editorial-drafts',version:2,drafts:[]},{format:'tkkdy-editorial-drafts',version:1,drafts:Array(101).fill({state})},{format:'tkkdy-editorial-drafts',version:1,drafts:[{state:{...state,sourcePath:'.github/workflows/deploy.yml'}}]}]){const s=storage();assert.throws(()=>importDrafts(JSON.stringify(obj),s,crypto()));assert.equal(s.length,0);}
});
test('quota failure rolls back only newly imported keys, preserving old drafts',()=>{
 const source=storage({'tkkdy-editorial:essay-one':JSON.stringify(state),'tkkdy-editorial:essay-two':JSON.stringify(state)});const target=storage({keep:'original'},2);assert.throws(()=>importDrafts(bundle(source),target,crypto()));assert.deepEqual([...target.data],[['keep','original']]);
});
test('identifier collision stops the whole import without overwriting a draft',()=>{
 const source=storage({'tkkdy-editorial:essay-one':JSON.stringify(state),'tkkdy-editorial:essay-two':JSON.stringify(state)});const target=storage();assert.throws(()=>importDrafts(bundle(source),target,{randomUUID:()=> 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'}));assert.equal(target.length,0);
});
test('damaged historical entries are explicitly reported instead of exported as empty drafts',()=>{
 const s=storage({'tkkdy-editorial:essay-broken':'{','tkkdy-editorial:essay-good':JSON.stringify(state)});const out=exportDrafts(s);assert.equal(out.bundle.drafts.length,1);assert.equal(out.skipped.length,1);
});
