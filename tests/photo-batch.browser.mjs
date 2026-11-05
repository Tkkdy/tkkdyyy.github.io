/** Local real broker/SQLite/Chromium. GitHub OAuth + GitHub API are SYNTHETIC; zero external writes. */
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm,mkdir,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve,join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import sharp from 'sharp';
import YAML from 'yaml';
import { createBroker } from '../ops/admin-broker/core.mjs';
import { createAdminServer } from '../ops/admin-broker/server.mjs';
import { openDraftStore } from '../ops/admin-broker/private-drafts.mjs';
import { SETTINGS_PATH } from '../src/lib/site-settings.mjs';
const evidence=resolve('.flavor-builds/photo-batch-simplified-evidence'),screens=join(evidence,'screenshots'),directory=await mkdtemp(join(tmpdir(),'flavor-editor-'));
await mkdir(screens,{recursive:true});
const store=await openDraftStore({directory}),origin='http://127.0.0.1:'+(process.env.EDITOR_TEST_PORT||'19544'),repo='Tkkdy/tkkdyyy.github.io',base='a'.repeat(40),next='b'.repeat(40);
const report={scope:'REAL local Chromium + broker + SQLite; SYNTHETIC OAuth and GitHub API; production editor not modified or authenticated',checks:[],upstreamWrites:[],pageErrors:[]};
const paths=[SETTINGS_PATH,'src/content/images/photo-main-landscape.md'];
const files=await Promise.all(paths.map(async path=>{const bytes=await readFile(path);return{path,sha:createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),size:bytes.length,type:'blob',text:bytes.toString('utf8')};}));
let branch='',head=base,submitted;
const config={origin,clientId:'SYNTHETIC_CLIENT',clientSecret:'SYNTHETIC_SECRET',repository:repo,repositoryId:1355866312,ownerId:144055705,branch:'main',publicationMode:'pull-request'};
const broker=createBroker(config,{draftStore:store,fetchImpl:async(url,options={})=>{
 const body=options.body?JSON.parse(options.body):null;
 if(url.endsWith('/access_token'))return Response.json({access_token:'SYNTHETIC_GITHUB_TOKEN',token_type:'bearer',expires_in:3600});
 if(url.endsWith('/user'))return Response.json({id:144055705,login:'Tkkdy'});
 if(options.method&&options.method!=='GET'&&!(url.endsWith('/graphql')&&!body?.query?.startsWith('mutation')))report.upstreamWrites.push({path:new URL(url).pathname,method:options.method});
 if(url.endsWith('/git/refs')){branch=body.ref.slice(11);head=base;return Response.json({ref:body.ref,object:{sha:base}});}
 if(url.includes('/git/ref/heads/'))return Response.json({object:{sha:url.endsWith('/main')?base:head,type:'commit'}});
 if(url.includes('/git/trees/'))return Response.json({tree:files.map(({text,...f})=>f),truncated:false});
 if(url.endsWith('/graphql')){
  if(body.query.startsWith('mutation')){submitted=body.variables.input;head=next;return Response.json({data:{createCommitOnBranch:{commit:{oid:next}}}});}
  const result={};for(const match of body.query.matchAll(/f([0-9]+):object\(oid:"([a-f0-9]+)"\)/g))result['f'+match[1]]={text:files.find(f=>f.sha===match[2]).text};return Response.json({data:{repository:result}});
 }
 if(url.includes('/compare/'))return Response.json({status:'ahead',behind_by:0,total_commits:1,commits:[{sha:next}],files:submitted.fileChanges.additions.map(f=>({filename:f.path,status:'added'}))});
 if(url.endsWith('/pulls'))return Response.json({number:999,state:'open',merged:false,head:{ref:branch,sha:next,repo:{id:1355866312}},base:{ref:'main',sha:base,repo:{id:1355866312}},html_url:'https://github.com/'+repo+'/pull/999'});
 if(options.method&&options.method!=='GET')throw Error('Unexpected upstream write '+url);
 return Response.json({id:1355866312,full_name:repo,owner:{id:144055705}});
}});
const server=await createAdminServer({origin,broker,staticRoot:resolve('dist-admin')});await new Promise(r=>server.listen(Number(new URL(origin).port),'127.0.0.1',r));let browser;
async function session(width=1440){
 const c=await browser.newContext({viewport:{width,height:900}});const login=await c.request.get(origin+'/auth/login',{maxRedirects:0}),state=new URL(login.headers().location).searchParams.get('state');const callback=await c.request.get(origin+'/auth/callback?code=synthetic&state='+state,{maxRedirects:0});assert.equal(callback.status(),303);
 const page=await c.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));await page.goto(origin+'/admin/settings/');await page.locator('[data-settings-form]').waitFor({state:'visible'});return{c,page};
}
async function editCard(page,index,more=false){const card=page.locator('.photo-batch-card').nth(index);if(!await card.locator('[data-field=alt]').isVisible())await card.locator('[data-item-edit]').click();if(more&&!await card.locator('[data-field=caption]').isVisible())await card.getByText('单张更多设置',{exact:true}).click();return card;}
async function previewAndConfirm(page){await page.locator('[data-batch-publish]').click();await page.locator('[data-batch-review]').waitFor({state:'visible'});await page.locator('[data-batch-confirm]').click();}
try{
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
 const anon=await browser.newContext();assert.equal((await anon.request.get(origin+'/admin/photos/upload/')).status(),401);await anon.close();
 const a=await session();await a.page.goto(origin+'/admin/photos/upload/');await a.page.locator('[data-batch-files]:enabled').waitFor();assert(await a.page.locator('[data-batch-files]').evaluate(el=>el.multiple));
 const batchURL=a.page.url();const image=await sharp({create:{width:800,height:600,channels:3,background:'#b6c7b2'}}).jpeg().withExif({IFD0:{Artist:'SYNTHETIC PRIVATE DEVICE'},IFD3:{GPSLatitudeRef:'N',GPSLatitude:'37/1 0/1 0/1'}}).toBuffer();
 const image2=await sharp(randomBytes(2400*2400*3),{raw:{width:2400,height:2400,channels:3}}).jpeg({quality:95}).toBuffer();
 assert(image2.length>950_000);
 const inputs=[{name:'synthetic-A.jpg',mimeType:'image/jpeg',buffer:Buffer.concat([image,Buffer.alloc(50_000_000-image.length)])},{name:'synthetic-B.jpg',mimeType:'image/jpeg',buffer:image2},{name:'synthetic-C.jpg',mimeType:'image/jpeg',buffer:image},{name:'too-large-test.jpg',mimeType:'image/jpeg',buffer:Buffer.alloc(50_000_001)}];
 const inputPaths=[];for(const input of inputs){const path=join(directory,input.name);await writeFile(path,input.buffer);inputPaths.push(path);}
 await a.page.locator('[data-batch-files]').setInputFiles(inputPaths);await a.page.locator('[data-batch-message]').filter({hasText:'本次已保存 3 张'}).waitFor();assert((await a.page.locator('[data-batch-message]').innerText()).includes('超过 50 MB'));assert.equal(await a.page.locator('.photo-batch-card').count(),3);assert(await a.page.locator('[data-batch-publish]').isEnabled());assert.equal(await a.page.locator('[data-item-selected]:checked').count(),3);assert.equal(report.upstreamWrites.length,0);
 let cards=a.page.locator('.photo-batch-card');const keys=await cards.evaluateAll(xs=>xs.map(x=>x.dataset.photoKey));
 for(const key of keys){const state=(await store.read(key)).state;const data=YAML.parse(state.rawContent.match(/^---\n([\s\S]*?)\n---/)[1]);const compressed=Buffer.from(data.image.split(',')[1],'base64');assert(compressed.length<=950_000);assert.equal((await sharp(compressed).metadata()).exif,undefined);assert.equal(data.capturedAt,undefined);assert.equal(data.location,undefined);assert.equal(data.window.enabled,false);assert(!data.title);assert.equal(data.alt??'','');}
 report.checks.push('A valid 50MB padded JPEG and a high-detail JPEG import and compress below 950KB; a 50MB+1-byte source is rejected; multiple files import sequentially into 3 independent real private drafts; oversize file reported without discarding valid files; EXIF/GPS stripped, no invented date/location/copy; no upstream writes and new photos selected by default; no upstream dispatch until explicit confirmation.');
 await a.page.locator('[data-batch-publish]').click();await a.page.getByText('给整组填写一句照片说明即可；也可以点开照片单独填写。',{exact:true}).waitFor();assert.equal(report.upstreamWrites.length,0);
 assert(!await cards.nth(0).locator('[data-field=alt]').isVisible());
 await a.page.locator('[data-group-field=series]').fill('本地合成验收相簿');await a.page.locator('[data-group-field=alt]').fill('整组共同说明（合成测试）');
 await a.page.locator('.batch-group-more summary').click();await a.page.locator('[data-group-field=capturedAt]').fill('2026-11-01');await a.page.locator('[data-group-field=frameDisplay]').selectOption('date');
 await cards.nth(0).getByText('已保存 · 私有草稿',{exact:true}).waitFor();
 for(const key of keys){const data=YAML.parse((await store.read(key)).state.rawContent.match(/^---\n([\s\S]*?)\n---/)[1]);assert.equal(data.alt,'整组共同说明（合成测试）');assert.equal(data.series,'本地合成验收相簿');assert.equal(data.capturedAt,'2026-11-01');assert.equal(data.frameDisplay,'date');}
 await a.page.locator('[data-group-field=frameDisplay]').selectOption('information');await a.page.locator('.batch-group-more summary').click();
 await cards.nth(1).locator('[data-item-selected]').uncheck();await cards.nth(2).locator('[data-item-cover]').check();assert(!await cards.nth(0).locator('[data-item-cover]').isChecked());
 await editCard(a.page,0,true);
 await cards.nth(0).locator('[data-field=alt]').fill('本地验收 A，不是本人摄影');await cards.nth(0).locator('[data-field=caption]').fill('逐张保存的测试文字');await cards.nth(0).locator('[data-item-selected]').check();await a.page.locator('[data-group-field=alt]').fill('更新后的整组说明（合成测试）');assert.equal(await cards.nth(0).locator('[data-field=alt]').inputValue(),'本地验收 A，不是本人摄影');assert.equal(await cards.nth(2).locator('[data-field=alt]').inputValue(),'更新后的整组说明（合成测试）');
 // Enter advanced editor immediately, before the debounce, then return. Both directions must flush edits.
 await cards.nth(0).getByRole('link',{name:'更多信息'}).click();await a.page.locator('[data-photo-form]').waitFor({state:'visible'});assert.equal(await a.page.locator('[name=alt]').inputValue(),'本地验收 A，不是本人摄影');await a.page.locator('[name="window.note"]').fill('单张高级信息需保留');await a.page.locator('[data-photo-back]').click();await a.page.locator('.photo-batch-card').first().waitFor();assert.equal(a.page.url(),batchURL);assert(await a.page.locator('[data-item-selected]').first().isChecked());
 cards=a.page.locator('.photo-batch-card');await editCard(a.page,0,true);assert.equal(await cards.nth(0).locator('[data-field=caption]').inputValue(),'逐张保存的测试文字');await cards.nth(2).locator('[data-item-selected]').check();
 await a.page.locator('[data-batch-publish]').click();await a.page.locator('[data-batch-review]').waitFor({state:'visible'});assert.equal(await a.page.locator('[data-batch-review] .album-paper').count(),2);assert.equal(report.upstreamWrites.length,0);await a.page.locator('[data-batch-review-close]').click();assert(!await a.page.locator('[data-batch-review]').isVisible());
 // Another device changes the unselected photo. Its stale local editor must not overwrite it.
 const other=await session();await other.page.goto(origin+'/admin/photos/edit/?draft='+keys[1]);await other.page.locator('[data-photo-form]').waitFor({state:'visible'});await other.page.locator('[name=caption]').fill('另一台设备保留的文字');await other.page.getByText('已保存到云端 · 私有照片草稿',{exact:true}).waitFor();await editCard(a.page,1,true);await cards.nth(1).locator('[data-field=caption]').fill('过期设备的文字');await cards.nth(1).getByRole('button',{name:'保存这张',exact:true}).click();await cards.nth(1).getByText(/另一台设备已保存/).waitFor();assert((await store.read(keys[1])).state.rawContent.includes('另一台设备保留的文字'));
 await editCard(a.page,2,true);await cards.nth(2).locator('[data-field=alt]').fill('本地验收 C，不是本人摄影');await cards.nth(2).getByRole('button',{name:'保存这张',exact:true}).click();await cards.nth(2).getByText('已保存 · 私有草稿',{exact:true}).waitFor();
 while(await a.page.locator('[data-item-edit][aria-expanded=true]').count())await a.page.locator('[data-item-edit][aria-expanded=true]').first().click();await a.page.evaluate(()=>scrollTo(0,0));await a.page.screenshot({path:join(screens,'batch-desktop.webp'),type:'webp',fullPage:true});
 await a.page.reload();await a.page.locator('.photo-batch-card').nth(2).waitFor();cards=a.page.locator('.photo-batch-card');assert(await cards.nth(0).locator('[data-item-selected]').isChecked());assert(await cards.nth(2).locator('[data-item-selected]').isChecked());assert.equal(await cards.nth(1).locator('[data-field=caption]').inputValue(),'另一台设备保留的文字');assert.equal(await a.page.locator('[data-group-field=alt]').inputValue(),'更新后的整组说明（合成测试）');await a.page.locator('[data-group-field=alt]').fill('刷新后整组说明（合成测试）');assert.equal(await cards.nth(0).locator('[data-field=alt]').inputValue(),'本地验收 A，不是本人摄影');assert.equal(await cards.nth(2).locator('[data-field=alt]').inputValue(),'本地验收 C，不是本人摄影');
 report.checks.push('Advanced single-photo editor round trip flushes changes; group reload restores independent metadata and explicit selection; one shared description/date/style inherits without overwriting per-photo overrides; selected-only preview cancels without writes; missing group descriptions prevent dispatch; 409 stale-device edit does not overwrite a newer draft.');
 await a.page.setViewportSize({width:390,height:900});await a.page.waitForFunction(()=>document.querySelector('.admin-sidebar').getBoundingClientRect().right<=1);await a.page.screenshot({path:join(screens,'batch-mobile.webp'),type:'webp',fullPage:true});assert(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await a.page.setViewportSize({width:320,height:900});assert(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await a.page.setViewportSize({width:1440,height:900});
 await previewAndConfirm(a.page);await a.page.locator('[data-batch-message]').filter({hasText:'2 张照片的发布提案已提交'}).waitFor();assert.equal(submitted.fileChanges.additions.length,4);assert.equal(submitted.expectedHeadOid,base);assert.notEqual(submitted.branch.branchName,'main');const published=submitted.fileChanges.additions.filter(x=>x.path.startsWith('src/content/images/')).map(x=>YAML.parse(Buffer.from(x.contents,'base64').toString().match(/^---\n([\s\S]*?)\n---/)[1]));assert.deepEqual(published.map(x=>x.alt).sort(),['本地验收 A，不是本人摄影','本地验收 C，不是本人摄影']);assert.equal(published.find(x=>x.alt.includes(' A')).window.note,'单张高级信息需保留');assert(published.every(x=>x.status==='published'&&!x.image.startsWith('data:')));assert(!(await store.read(keys[1])).state.publication);assert(!submitted.fileChanges.additions.some(x=>x.path===SETTINGS_PATH));await a.page.reload();await a.page.locator('.photo-batch-card').nth(2).waitFor();assert(await a.page.locator('[data-batch-publish]').isDisabled());assert(await a.page.locator('[data-item-selected]').first().isDisabled());
 report.checks.push('Selected photos alone produce one exact-base proposal containing only two Image Markdown + two WebP files; unselected draft and recent/music untouched. Receipt locks survive refresh. GitHub writes are SYNTHETIC only.');
 // Partial pending-marker persistence failure occurs before dispatch, so successful markers are cleared safely.
 await a.page.goto(origin+'/admin/photos/upload/');await a.page.locator('[data-batch-files]:enabled').waitFor();await a.page.locator('[data-batch-files]').setInputFiles(inputPaths.slice(0,2));await a.page.locator('[data-batch-message]').filter({hasText:'本次已保存 2 张'}).waitFor();cards=a.page.locator('.photo-batch-card');const retryKeys=await cards.evaluateAll(xs=>xs.map(x=>x.dataset.photoKey));for(let i=0;i<2;i++){await editCard(a.page,i,true);await cards.nth(i).locator('[data-field=alt]').fill('仅本地重试测试 '+i);await cards.nth(i).locator('[data-item-selected]').check();}
 // Local visual review checks selection without dispatch or pending publication markers.
 await a.page.evaluate(()=>{const meta=document.createElement('meta');meta.name='editor-local-preview';meta.content='true';document.head.append(meta);});const previewWrites=report.upstreamWrites.length;await previewAndConfirm(a.page);await a.page.locator('[data-batch-message]').filter({hasText:'本地预览：2 张照片已通过发布检查'}).waitFor();assert.equal(report.upstreamWrites.length,previewWrites);for(const key of retryKeys)assert(!(await store.read(key)).state.publication);await a.page.evaluate(()=>document.querySelector('meta[name=editor-local-preview]').remove());report.checks.push('Local review mode validates selected photos and saves privately without a proposal, without locking items, and without publication receipts.');
 let failed=false;await a.page.route('**/api/drafts',async route=>{const data=route.request().postDataJSON();if(!failed&&data.key===retryKeys[1]&&data.state?.publication?.state==='pending'){failed=true;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'本地模拟保存失败'})});}return route.continue();});
 const writesBefore=report.upstreamWrites.length;await previewAndConfirm(a.page);await a.page.locator('[data-batch-message]').filter({hasText:'尚未发送发布请求'}).waitFor();assert(failed);assert.equal(report.upstreamWrites.length,writesBefore);for(const key of retryKeys)assert(!(await store.read(key)).state.publication);assert(await a.page.locator('[data-batch-publish]').isEnabled());await a.page.unroute('**/api/drafts');
 report.checks.push('A partial private-intent save failure dispatches no proposal and clears only known unsubmitted markers, allowing safe retry.');
 // An actual unknown transport result must remain locked after refresh.
 await a.page.route('**/api/proposals',route=>route.abort('failed'));await previewAndConfirm(a.page);await a.page.locator('[data-batch-message]').filter({hasText:'不要重复发布'}).waitFor();for(const key of retryKeys)assert.equal((await store.read(key)).state.publication.state,'pending');await a.page.reload();await a.page.locator('.photo-batch-card').nth(1).waitFor();assert(await a.page.locator('[data-batch-publish]').isDisabled());assert(await a.page.locator('[data-item-selected]').first().isDisabled());assert.equal(report.upstreamWrites.length,writesBefore);
 report.checks.push('Unknown publication transport preserves pending intent for each selected photo and prevents replay on refresh. Desktop 1440 and 390/320px no horizontal overflow. Native iOS picker NOT TESTED.');
 assert.deepEqual(report.pageErrors,[]);report.state='PASS';
}catch(error){report.state='FAIL';report.failure=error.stack;throw error;}
finally{await browser?.close();await new Promise(r=>server.close(r));await store.close();await rm(directory,{recursive:true,force:true});await writeFile(join(evidence,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({state:report.state,checks:report.checks.length,upstream:'SYNTHETIC ONLY'}));}
