/** Local real broker/SQLite/Chromium. GitHub OAuth + GitHub API are SYNTHETIC; zero external writes. */
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm,mkdir,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve,join } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import sharp from 'sharp';
import YAML from 'yaml';
import { createBroker } from '../ops/admin-broker/core.mjs';
import { createAdminServer } from '../ops/admin-broker/server.mjs';
import { openDraftStore } from '../ops/admin-broker/private-drafts.mjs';
import { SETTINGS_PATH } from '../src/lib/site-settings.mjs';
const evidence=resolve('.flavor-builds/photo-album-evidence'),screens=join(evidence,'screenshots'),directory=await mkdtemp(join(tmpdir(),'flavor-editor-'));
await mkdir(screens,{recursive:true});
const store=await openDraftStore({directory}),origin='http://127.0.0.1:'+(process.env.EDITOR_TEST_PORT||'19545'),repo='Tkkdy/tkkdyyy.github.io',base='a'.repeat(40),next='b'.repeat(40);
const report={scope:'REAL local Chromium + broker + SQLite; SYNTHETIC OAuth and GitHub API; production editor not modified or authenticated',checks:[],upstreamWrites:[],pageErrors:[]};
const paths=[SETTINGS_PATH,'src/content/images/album-a.md','src/content/images/album-b.md','src/content/images/album-c.md'];
const doc=(slug,series,extra={})=>'---\n'+YAML.stringify({slug,series,alt:'共同说明',title:slug,image:'/images/photos/main-landscape.jpg',status:'published',publishedAt:'2026-11-01',window:{enabled:false,timeOfDay:[],seasons:[]},...extra})+'---\n';
const texts=[await readFile(SETTINGS_PATH,'utf8'),doc('album-a','金沙公园',{albumCover:true,capturedAt:'2026-10-01',caption:'A 原有单张说明'}),doc('album-b','金沙公园',{caption:'B 原有单张说明'}),doc('album-c','夜景',{albumCover:true})];
const files=paths.map((path,i)=>{const bytes=Buffer.from(texts[i]);return {path,sha:createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),size:bytes.length,type:'blob',text:texts[i]};});
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
 if(url.includes('/compare/'))return Response.json({status:'ahead',behind_by:0,total_commits:1,commits:[{sha:next}],files:submitted.fileChanges.additions.map(f=>({filename:f.path,status:files.some(x=>x.path===f.path)?'modified':'added'}))});
 if(url.endsWith('/pulls'))return Response.json({number:999,state:'open',merged:false,head:{ref:branch,sha:next,repo:{id:1355866312}},base:{ref:'main',sha:base,repo:{id:1355866312}},html_url:'https://github.com/'+repo+'/pull/999'});
 if(options.method&&options.method!=='GET')throw Error('Unexpected upstream write '+url);
 return Response.json({id:1355866312,full_name:repo,owner:{id:144055705}});
}});
const server=await createAdminServer({origin,broker,staticRoot:resolve('dist-admin')});await new Promise(r=>server.listen(Number(new URL(origin).port),'127.0.0.1',r));let browser;
async function session(width=1440){
 const c=await browser.newContext({viewport:{width,height:900}});const login=await c.request.get(origin+'/auth/login',{maxRedirects:0}),state=new URL(login.headers().location).searchParams.get('state');const callback=await c.request.get(origin+'/auth/callback?code=synthetic&state='+state,{maxRedirects:0});assert.equal(callback.status(),303);
 const page=await c.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));await page.goto(origin+'/admin/settings/');await page.locator('[data-settings-form]').waitFor({state:'visible'});return{c,page};
}
async function previewAndConfirm(page){await page.locator('[data-batch-publish]').click();await page.locator('[data-batch-review]').waitFor({state:'visible'});await page.locator('[data-batch-confirm]').click();}
try{
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
 const image=await sharp({create:{width:800,height:600,channels:3,background:'#b6c7b2'}}).webp().toBuffer();
 const sourceState=(i)=>({id:paths[i],type:'Image',title:'本地合成照片',status:'draft',sourcePath:paths[i],sourceBlobSha:files[i].sha,rawContent:texts[i]});
 const receipt='draft-photo-11111111-1111-4111-8111-111111111111';
 await store.save(receipt,{...sourceState(1),publication:{state:'proposed',url:'https://github.com/Tkkdy/tkkdyyy.github.io/pull/998',publishedContent:texts[1]}},0);
 const draftKey='draft-photo-22222222-2222-4222-8222-222222222222';
 await store.save(draftKey,{id:draftKey,type:'Image',title:'私有照片',status:'draft',sourcePath:'src/content/images/private-photo.md',sourceBlobSha:'',rawContent:doc('private-photo','旅行草稿',{status:'draft',image:'data:image/webp;base64,'+image.toString('base64')})},0);
 const a=await session(390);await a.page.route('https://tkkdy.me/**',route=>route.fulfill({contentType:'image/webp',body:image}));
 await a.page.goto(origin+'/admin/photos/');await a.page.locator('.photo-album-card').nth(1).waitFor();
 assert.equal(await a.page.locator('[data-photo-tab=published]').getAttribute('aria-pressed'),'true');
 assert.equal(await a.page.locator('[data-photo-tab=published]').innerText(),'已上线（3）');
 assert.equal(await a.page.locator('[data-photo-tab=drafts]').innerText(),'草稿（1）');
 await a.page.waitForFunction(()=>[...document.querySelectorAll('.photo-album-previews img')].every(i=>i.complete&&i.naturalWidth>0));
 await a.page.screenshot({path:join(screens,'albums-published-mobile.webp'),type:'webp',fullPage:true});
 await a.page.locator('[data-photo-tab=drafts]').click();await a.page.getByRole('heading',{name:'旅行草稿'}).waitFor();
 assert.equal(await a.page.locator('.photo-album-previews img').count(),1);assert.equal(report.upstreamWrites.length,0);
 await a.page.getByRole('link',{name:/旅行草稿/}).click();await a.page.locator('.photo-batch-card').waitFor();
 await a.page.locator('[data-group-field=series]').fill('旅行新名字');await a.page.locator('[data-group-field=location]').fill('海边');
 await a.page.locator('.photo-batch-status').filter({hasText:'已保存 · 私有草稿'}).waitFor();await a.page.reload();await a.page.locator('.photo-batch-card').waitFor();
 assert.equal(await a.page.locator('[data-group-field=series]').inputValue(),'旅行新名字');assert.equal(await a.page.locator('[data-group-field=location]').inputValue(),'海边');
 report.checks.push('Mobile library defaults to published, renders grouped thumbnails; private draft previews load via authenticated API; matching published receipt is hidden without deleting it; draft album rename survives reload.');
 await a.page.goto(origin+'/admin/photos/');await a.page.getByRole('link',{name:/金沙公园/}).click();await a.page.locator('.photo-batch-card').nth(1).waitFor();
 assert.equal(await a.page.locator('[data-group-field=capturedAt]').inputValue(),'');assert(await a.page.locator('[data-group-mixed]').isVisible());
 await a.page.locator('[data-group-field=location]').fill('公园南门');await a.page.locator('.photo-batch-status').first().filter({hasText:'已保存 · 私有草稿'}).waitFor();
 const dataOf=async key=>YAML.parse((await store.read(key)).state.rawContent.match(/^---\n([\s\S]*?)\n---/)[1]);
 assert.equal((await dataOf(paths[1])).capturedAt,'2026-10-01');assert.equal((await dataOf(paths[2])).capturedAt,undefined);
 await a.page.locator('[data-group-field=capturedAt]').fill('2026-11-02');await a.page.locator('[data-group-field=alt]').fill('新的整组说明');await a.page.locator('[data-group-field=series]').fill('公园散步');
 await a.page.locator('.photo-batch-status').nth(1).filter({hasText:'已保存 · 私有草稿'}).waitFor();
 for(const path of paths.slice(1,3)){const data=await dataOf(path);assert.equal(data.series,'公园散步');assert.equal(data.location,'公园南门');assert.equal(data.capturedAt,'2026-11-02');assert.equal(data.alt,'新的整组说明');}
 assert.equal((await dataOf(paths[1])).caption,'A 原有单张说明');assert.equal((await dataOf(paths[2])).caption,'B 原有单张说明');
 const sheet=a.page.locator('[data-photo-sheet]');await a.page.locator('[data-item-edit]').first().click();await sheet.waitFor({state:'visible'});
 assert.equal(await sheet.locator('textarea:visible,input:visible,select:visible').count(),1);
 await sheet.locator('[data-field=caption]').fill('手机单张补充');await a.page.locator('[data-photo-sheet-done]').click();await sheet.waitFor({state:'hidden'});
 await a.page.locator('[data-item-edit]').nth(1).click();await sheet.locator('.batch-move-photo summary').click();await sheet.locator('[data-field=series]').fill('夜景');await a.page.locator('[data-photo-sheet-done]').click();await sheet.waitFor({state:'hidden'});
 assert.equal((await dataOf(paths[2])).series,'夜景');assert.equal((await dataOf(paths[2])).albumCover,false);
 await a.page.locator('[data-group-field=location]').fill('金沙公园');await a.page.locator('.photo-batch-status').nth(1).filter({hasText:'已保存 · 私有草稿'}).waitFor();assert.equal((await dataOf(paths[2])).albumCover,false);
 await a.page.evaluate(()=>scrollTo(0,0));await a.page.screenshot({path:join(screens,'album-editor-mobile.webp'),type:'webp',fullPage:true});
 await a.page.setViewportSize({width:320,height:900});assert(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await a.page.setViewportSize({width:1440,height:900});await a.page.screenshot({path:join(screens,'album-editor-desktop.webp'),type:'webp',fullPage:true});
 report.checks.push('Shared location/date/description and album rename persist; changing one shared field preserves mixed untouched dates and individual captions; mobile sheet shows one optional note; move clears cover and preserves destination cover; 320px has no overflow.');
 // Source version changes must block before any proposal.
 await a.page.route('**/api/stories',async route=>{const response=await route.fetch();const data=await response.json();data.resources.find(r=>r.sourcePath===paths[1]).sourceBlobSha='f'.repeat(40);await route.fulfill({json:data});});
 await previewAndConfirm(a.page);await a.page.locator('[data-batch-message]').filter({hasText:'线上版本已变化'}).waitFor();assert.equal(report.upstreamWrites.length,0);await a.page.unroute('**/api/stories');
 await a.page.route('**/api/proposals/999',route=>route.fulfill({json:{pullRequestNumber:999,state:'PULL_REQUEST_OPEN',deploymentConfirmed:false,checks:{state:'PENDING'},publication:{state:'CI_PENDING'}}}));
 await previewAndConfirm(a.page);await a.page.locator('[data-batch-message]').filter({hasText:'2 张照片的发布提案已提交'}).waitFor();
 assert.equal(submitted.fileChanges.additions.length,2);assert.deepEqual(submitted.fileChanges.additions.map(f=>f.path).sort(),paths.slice(1,3).sort());
 const published=submitted.fileChanges.additions.map(f=>YAML.parse(Buffer.from(f.contents,'base64').toString().match(/^---\n([\s\S]*?)\n---/)[1]));assert.equal(published.find(p=>p.slug==='album-a').caption,'手机单张补充');assert.equal(published.find(p=>p.slug==='album-b').series,'夜景');assert(published.every(p=>p.status==='published'));
 assert(await store.read(receipt));assert.equal((await dataOf(paths[3]).catch(()=>null)),null);
 await a.page.reload();await a.page.locator('.photo-batch-card').nth(1).waitFor();assert(await a.page.locator('[data-batch-publish]').isDisabled());
 report.checks.push('Stale repository blob blocks before upstream write; successful synthetic update changes only selected existing metadata files, reuses photo assets and leaves unrelated album untouched; pending receipt prevents replay after reload.');
 assert.deepEqual(report.pageErrors,[]);report.state='PASS';
}catch(error){report.state='FAIL';report.failure=error.stack;throw error;}
finally{await browser?.close();await new Promise(r=>server.close(r));await store.close();await rm(directory,{recursive:true,force:true});await writeFile(join(evidence,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({state:report.state,checks:report.checks.length,upstream:'SYNTHETIC ONLY'}));}
