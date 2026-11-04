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
const evidence=resolve('.flavor-builds/editor-photos-evidence'),screens=join(evidence,'screenshots'),directory=await mkdtemp(join(tmpdir(),'flavor-editor-'));
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
try{
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
 const anon=await browser.newContext();assert.equal((await anon.request.get(origin+'/admin/photos/')).status(),401);assert.equal((await anon.request.get(origin+'/api/drafts')).status(),401);await anon.close();
 const a=await session();await a.page.goto(origin+'/admin/photos/edit/');await a.page.locator('[data-photo-form]').waitFor({state:'visible'});
 const key=new URL(a.page.url()).searchParams.get('draft');assert.match(key,/^draft-photo-/);
 assert.equal(await a.page.locator('[name="capturedAt"]').inputValue(),'');assert.equal(await a.page.locator('[name="location"]').inputValue(),'');assert.equal(await a.page.locator('[name="window.enabled"]').isChecked(),false);
 const image=await sharp({create:{width:800,height:600,channels:3,background:'#b6c7b2'}}).jpeg().withExif({IFD0:{Artist:'SYNTHETIC PRIVATE DEVICE'},IFD3:{GPSLatitudeRef:'N',GPSLatitude:'37/1 0/1 0/1'}}).toBuffer();assert((await sharp(image).metadata()).exif);
 await a.page.locator('[name="photo"]').setInputFiles({name:'synthetic-not-owner.jpg',mimeType:'image/jpeg',buffer:image});await a.page.locator('[data-photo-figure]').waitFor({state:'visible'});
 await a.page.locator('[name="title"]').fill('本地测试照片（非本人摄影）');await a.page.locator('[name="alt"]').fill('仅用于本地验收的纯色测试图');await a.page.locator('[name="window.enabled"]').check();await a.page.locator('[name="window.timeOfDay"][value="dusk"]').check();
 await a.page.getByText('已保存到云端 · 私有照片草稿',{exact:true}).waitFor();const saved=await store.read(key);const data=YAML.parse(saved.state.rawContent.match(/^---\n([\s\S]*?)\n---/)[1]);assert(data.image.startsWith('data:image/webp;base64,'));assert.equal((await sharp(Buffer.from(data.image.split(',')[1],'base64')).metadata()).exif,undefined);assert.equal(data.capturedAt,undefined);assert.equal(data.location,undefined);assert.equal(report.upstreamWrites.length,0);
 await a.page.evaluate(()=>scrollTo(0,0));await a.page.screenshot({path:join(screens,'photo-editor-desktop.webp'),type:'webp',fullPage:true});
 const b=await session(390);await b.page.goto(a.page.url());await b.page.locator('[data-photo-form]').waitFor({state:'visible'});assert.equal(await b.page.locator('[name="title"]').inputValue(),'本地测试照片（非本人摄影）');await b.page.locator('[name="caption"]').fill('跨设备恢复测试');await b.page.getByText('已保存到云端 · 私有照片草稿',{exact:true}).waitFor();await b.page.evaluate(()=>scrollTo(0,0));await b.page.screenshot({path:join(screens,'photo-editor-mobile.webp'),type:'webp',fullPage:true});await b.page.setViewportSize({width:320,height:900});assert(await b.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await b.page.setViewportSize({width:390,height:900});assert(await b.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await a.page.locator('[name="caption"]').fill('过期设备不可覆盖');await a.page.getByText(/另一台设备已保存/).waitFor();assert(!(await store.read(key)).state.rawContent.includes('过期设备不可覆盖'));
 report.checks.push('Real private SQLite photo draft; no GitHub write while editing; actual JPEG GPS/device tags stripped by browser canvas; no invented capture date/location; independent-session restore, revision conflict, mobile layout.');
 await b.page.getByRole('button',{name:'发布照片',exact:true}).click();await b.page.getByRole('link',{name:'查看发布进度'}).waitFor();assert.equal(submitted.fileChanges.additions.length,2);const photoFile=submitted.fileChanges.additions.find(f=>f.path.startsWith('src/content/images/'));const upload=submitted.fileChanges.additions.find(f=>f.path.startsWith('public/uploads/'));assert(upload.path.endsWith('.webp'));assert.equal((await sharp(Buffer.from(upload.contents,'base64')).metadata()).exif,undefined);const published=YAML.parse(Buffer.from(photoFile.contents,'base64').toString().match(/^---\n([\s\S]*?)\n---/)[1]);assert.equal(published.status,'published');assert(published.image.startsWith('/uploads/'));assert.equal(published.window.enabled,true);assert.equal(submitted.expectedHeadOid,base);assert.notEqual(submitted.branch.branchName,'main');assert(!report.upstreamWrites.some(x=>x.path.endsWith('/merge')));
 await b.page.reload();await b.page.locator('[data-photo-form]').waitFor({state:'visible'});assert(await b.page.getByRole('button',{name:'发布照片',exact:true}).isDisabled());
 report.checks.push('Explicit publication passes real broker policy: one WebP plus one Image Markdown on generated proposal branch, exact base, no merge; persistent receipt blocks replay after reload. GitHub writes are SYNTHETIC.');
 await b.page.goto(origin+'/admin/photos/');await b.page.getByText('本地测试照片（非本人摄影）',{exact:true}).waitFor();await b.page.screenshot({path:join(screens,'photo-library-mobile.webp'),type:'webp'});
 // Existing published photo preserves fields outside this form and uses existing blob conflict checks.
 const existing=await session();await existing.page.goto(origin+'/admin/photos/edit/?source='+encodeURIComponent(paths[1]));await existing.page.locator('[data-photo-form]').waitFor({state:'visible'});await existing.page.locator('[name="window.note"]').fill('本地已有照片编辑测试');await existing.page.getByText('已保存到云端 · 私有照片草稿',{exact:true}).waitFor();const existingDraft=await store.read(paths[1]);assert.equal(existingDraft.state.sourceBlobSha,files[1].sha);
 // Dedicated recent form must preserve all music settings, including the 35% player's source.
 const recent=await session(390);await recent.page.goto(origin+'/admin/recent/');await recent.page.locator('[data-settings-form]').waitFor({state:'visible'});assert.equal(await recent.page.locator('[name="source"]').count(),0);await recent.page.locator('[name="doing"]').fill('本地近况测试（不是 Owner 近况）');await recent.page.getByText('已保存到云端 · 私有草稿',{exact:true}).waitFor();const recentDraft=await store.read('draft-site-settings');assert.deepEqual(JSON.parse(recentDraft.state.rawContent).music,JSON.parse(files[0].text).music);await recent.page.getByRole('button',{name:'预览首页近况',exact:true}).click();assert((await recent.page.locator('[data-settings-preview-body]').innerText()).includes('本地近况测试'));await recent.page.screenshot({path:join(screens,'recent-mobile.webp'),type:'webp',fullPage:true});assert(await recent.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await recent.page.getByRole('button',{name:'发布近况',exact:true}).click();await recent.page.getByRole('link',{name:'查看发布提案'}).waitFor();assert.deepEqual(submitted.fileChanges.additions.map(f=>f.path),[SETTINGS_PATH]);assert.deepEqual(JSON.parse(Buffer.from(submitted.fileChanges.additions[0].contents,'base64')).music,JSON.parse(files[0].text).music);await recent.page.reload();await recent.page.locator('[data-settings-form]').waitFor({state:'visible'});assert(await recent.page.getByRole('button',{name:'发布近况',exact:true}).isDisabled());
 report.checks.push('Dedicated recent-only mobile form preserves music byte-for-value, preview and private autosave; explicit proposal writes only settings JSON; reload prevents duplicate submission.');
 // Draft recovery routes and content list remain usable with the SiteSettings resource present.
 await recent.page.goto(origin+'/admin/drafts/');await recent.page.getByText('继续编辑',{exact:true}).first().waitFor();const links=await recent.page.locator('[data-private-draft-list] a').evaluateAll(xs=>xs.map(x=>x.getAttribute('href')));assert(links.some(x=>x.includes('/admin/photos/edit/?draft=')));assert(links.includes('/admin/recent/'));
 await recent.page.goto(origin+'/admin/stories/');await recent.page.getByText('已从仓库同步。',{exact:false}).waitFor();
 // A transport failure after intent is saved must never replay on refresh.
 const unknown=await session();await unknown.page.goto(origin+'/admin/photos/edit/');await unknown.page.locator('[data-photo-form]').waitFor({state:'visible'});await unknown.page.locator('[name=photo]').setInputFiles({name:'synthetic.jpg',mimeType:'image/jpeg',buffer:image});await unknown.page.locator('[data-photo-figure]').waitFor({state:'visible'});await unknown.page.locator('[name=alt]').fill('本地网络异常验收');await unknown.page.route('**/api/proposals',route=>route.abort('failed'));const writeCount=report.upstreamWrites.length;await unknown.page.getByRole('button',{name:'发布照片',exact:true}).click();await unknown.page.getByText(/请先核对发布提案，不要重复提交/).waitFor();await unknown.page.reload();await unknown.page.locator('[data-photo-form]').waitFor({state:'visible'});assert(await unknown.page.getByRole('button',{name:'发布照片',exact:true}).isDisabled());assert.equal(report.upstreamWrites.length,writeCount);report.checks.push('Aborted proposal transport persists pending intent; reload cannot replay unknown write.');
 assert.deepEqual(report.pageErrors,[]);report.checks.push('Private-draft recovery routes and general content list remain functional with photo and settings resources.');report.state='PASS';
}catch(error){report.state='FAIL';report.failure=error.stack;throw error;}
finally{await browser?.close();await new Promise(r=>server.close(r));await store.close();await rm(directory,{recursive:true,force:true});await writeFile(join(evidence,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({state:report.state,checks:report.checks.length,upstream:'SYNTHETIC ONLY'}));}
