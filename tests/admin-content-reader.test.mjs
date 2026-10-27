import test from 'node:test';import assert from 'node:assert/strict';import {createContentReader,editorialStory} from '../ops/admin-broker/content-reader.mjs';
const head='a'.repeat(40),blob='b'.repeat(40),next='c'.repeat(40),path='src/content/essays/new-live.md',text='---\ntitle: Live new story\nslug: new-live\npublishedAt: 2026-10-25\nstatus: draft\n---\nNever rebuild Admin merely to load this content.';
test('live reader picks newly published content from one exact head and caches only that head',async()=>{
 let current=head,graphReads=0;const reader=createContentReader({repository:'Tkkdy/tkkdyyy.github.io',branch:'codex/probe',github:async(url,options)=>{
  if(url.includes('/git/ref/'))return{object:{sha:current}};
  if(url.includes('/git/trees/')){assert(url.includes(current));return{truncated:false,tree:[{path,type:'blob',sha:blob,size:100},{path:'private.env',type:'blob',sha:blob,size:100}]};}
  graphReads++;assert(JSON.parse(options.body).query.includes(blob));return{data:{repository:{f0:{text}}}};
 }});
 const first=await reader();assert.equal(first.head,head);assert.equal(first.stories[0].sourcePath,path);assert.equal(first.stories[0].sourceBlobSha,blob);assert.equal(first.stories.length,1);await reader();assert.equal(graphReads,1);current=next;assert.equal((await reader()).head,next);assert.equal(graphReads,2);
});
test('editorial mapping preserves draft metadata, Unicode and body without executing HTML or allowing arbitrary files',()=>{
 const story=editorialStory(path,text.replace('Live new story','中文 <script>inert</script>'),blob);assert.equal(story.status,'draft');assert(story.title.includes('<script>'));assert(story.body.includes('Never rebuild'));assert.throws(()=>editorialStory('.github/workflows/deploy.yml',text,blob));
});
test('incomplete Git trees fail visibly rather than silently omitting stories',async()=>{
 const reader=createContentReader({repository:'Tkkdy/tkkdyyy.github.io',branch:'codex/probe',github:async url=>url.includes('/git/ref/')?{object:{sha:head}}:{truncated:true,tree:[]}});await assert.rejects(reader(),/不完整/);
});
