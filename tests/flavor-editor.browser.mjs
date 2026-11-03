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
const evidence=resolve(process.env.EDITOR_EVIDENCE_DIR||'docs/flavor-review'),screens=join(evidence,'screenshots'),directory=await mkdtemp(join(tmpdir(),'flavor-editor-'));
const store=await openDraftStore({directory}),origin='http://127.0.0.1:19544',repo='Tkkdy/tkkdyyy.github.io',base='a'.repeat(40),next='b'.repeat(40);
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
 if(url.endsWith('/git/refs')){branch=body.ref.slice(11);return Response.json({ref:body.ref,object:{sha:base}});}
 if(url.includes('/git/ref/heads/'))return Response.json({object:{sha:url.endsWith('/main')?base:head,type:'commit'}});
 if(url.includes('/git/trees/'))return Response.json({tree:files.map(({text,...f})=>f),truncated:false});
 if(url.endsWith('/graphql')){
  if(body.query.startsWith('mutation')){submitted=body.variables.input;head=next;return Response.json({data:{createCommitOnBranch:{commit:{oid:next}}}});}
  const result={};for(const match of body.query.matchAll(/f([0-9]+):object\(oid:"([a-f0-9]+)"\)/g))result['f'+match[1]]={text:files.find(f=>f.sha===match[2]).text};return Response.json({data:{repository:result}});
 }
 if(url.includes('/compare/'))return Response.json({status:'ahead',behind_by:0,total_commits:1,commits:[{sha:next}],files:[{filename:SETTINGS_PATH,status:'modified'}]});
 if(url.endsWith('/pulls'))return Response.json({number:999,state:'open',merged:false,head:{ref:branch,sha:next,repo:{id:1355866312}},base:{ref:'main',sha:base,repo:{id:1355866312}},html_url:'https://github.com/'+repo+'/pull/999'});
 if(options.method&&options.method!=='GET')throw Error('Unexpected upstream write '+url);
 return Response.json({id:1355866312,full_name:repo,owner:{id:144055705}});
}});
const server=await createAdminServer({origin,broker,staticRoot:resolve('dist-admin')});await new Promise(r=>server.listen(19544,'127.0.0.1',r));let browser;
async function session(width=1440){
 const c=await browser.newContext({viewport:{width,height:900}});const login=await c.request.get(origin+'/auth/login',{maxRedirects:0}),state=new URL(login.headers().location).searchParams.get('state');const callback=await c.request.get(origin+'/auth/callback?code=synthetic&state='+state,{maxRedirects:0});assert.equal(callback.status(),303);
 const page=await c.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));await page.goto(origin+'/admin/settings/');await page.locator('[data-settings-form]').waitFor({state:'visible'});return{c,page};
}
try{
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
 const anonymous=await browser.newContext();assert.equal((await anonymous.request.get(origin+'/api/content?path='+encodeURIComponent(SETTINGS_PATH))).status(),401);await anonymous.close();
 const a=await session();assert.equal(await a.page.locator('[name="doing"]').inputValue(),'');
 await a.page.locator('[name="doing"]').fill('本地链路测试（非真实近况）');await a.page.getByText('已保存到云端 · 私有草稿',{exact:true}).waitFor();
 assert((await store.read('draft-site-settings')).state.rawContent.includes('本地链路测试'));assert.equal(report.upstreamWrites.length,0);
 const b=await session(390);assert.equal(await b.page.locator('[name="doing"]').inputValue(),'本地链路测试（非真实近况）');await b.page.getByRole('button',{name:'预览',exact:true}).click();assert((await b.page.locator('[data-settings-preview-body]').innerText()).includes('本地链路测试'));await b.page.screenshot({path:join(screens,'editor-settings-390.webp'),type:'webp'});assert(await b.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await a.page.screenshot({path:join(screens,'editor-settings-1440.webp'),type:'webp'});
 report.checks.push('Anonymous denied; exact settings read from pinned Git blob; actual SQLite autosave and independent-cookie-session restore; text-only preview; desktop/390px no overflow; no upstream write while drafting.');
 await b.page.locator('[name="thinking"]').fill('<img src=x onerror="window.TEST_EXECUTED=true">');await b.page.getByText('已保存到云端 · 私有草稿',{exact:true}).waitFor();await b.page.getByRole('button',{name:'预览',exact:true}).click();assert.equal(await b.page.locator('[data-settings-preview-body] img').count(),0);assert.equal(await b.page.evaluate(()=>window.TEST_EXECUTED),undefined);
 await a.page.locator('[name="doing"]').fill('过期会话不得覆盖');await a.page.getByText(/另一台设备已保存/).waitFor();assert(!(await store.read('draft-site-settings')).state.rawContent.includes('过期会话不得覆盖'));
 report.checks.push('Preview does not execute HTML; stale session receives real SQLite revision conflict and cannot overwrite another device.');
 // Retain a raw snapshot even when the source URL is invalid.
 await b.page.locator('[name="source"]').fill('javascript:alert(1)');await b.page.getByRole('button',{name:'保存私有草稿',exact:true}).click();await b.page.getByText(/音乐来源须为/).waitFor();assert(!((await store.read('draft-site-settings')).state.rawContent.includes('javascript:')));
 const downloadPromise=b.page.waitForEvent('download');await b.page.getByRole('button',{name:'下载备份',exact:true}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'site-settings-backup.json');
 await b.page.locator('[name="source"]').fill('');await b.page.locator('[name="thinking"]').fill('');await b.page.getByRole('button',{name:'保存私有草稿',exact:true}).click();await b.page.getByText('已保存到云端 · 私有草稿',{exact:true}).waitFor();
 await b.page.getByRole('button',{name:'发起发布提案',exact:true}).click();await b.page.getByRole('link',{name:'查看发布提案',exact:true}).waitFor();
 assert.equal(submitted.branch.branchName,branch);assert.notEqual(branch,'main');assert.equal(submitted.expectedHeadOid,base);assert.deepEqual(submitted.fileChanges.additions.map(f=>f.path),[SETTINGS_PATH]);assert.equal(submitted.fileChanges.deletions.length,0);assert(!report.upstreamWrites.some(x=>x.path.endsWith('/merge')));assert(await b.page.getByRole('button',{name:'发起发布提案',exact:true}).isDisabled());await b.page.screenshot({path:join(screens,'editor-settings-synthetic-proposal.webp'),type:'webp'});
 report.checks.push('Invalid source rejected before save; downloadable input recovery; user-clicked proposal passes real broker validators, writes ONLY settings JSON on server-generated feature branch, uses exact base SHA, stops without merge or deployment. GitHub API is synthetic.');
 // Existing image metadata editor exposes and persists the opt-in nested window object.
 const image=await session(320);await image.page.goto(origin+'/admin/content/?source='+encodeURIComponent(paths[1]));await image.page.locator('[data-resource-form]').waitFor({state:'visible'});await image.page.locator('[name="window.enabled"]').check();await image.page.locator('[name="window.timeOfDay"]').fill('dusk');await image.page.locator('[name="window.note"]').fill('仅本地测试元数据');await image.page.getByText('已保存到云端 · 私有草稿',{exact:true}).waitFor();const draft=await store.read(paths[1]);assert(draft.state.rawContent.includes('enabled: true'));assert(draft.state.rawContent.includes('仅本地测试元数据'));await image.page.screenshot({path:join(screens,'editor-photo-window-320.webp'),type:'webp'});assert(await image.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const privatePhoto=await sharp({create:{width:800,height:600,channels:3,background:'#ccc'}}).jpeg().withExif({IFD0:{Artist:'PRIVATE TEST DEVICE'},IFD3:{GPSLatitudeRef:'N',GPSLatitude:'37/1 0/1 0/1'}}).toBuffer();
 await image.page.locator('[data-resource-form] input[type=file]').setInputFiles({name:'private-metadata-test.jpg',mimeType:'image/jpeg',buffer:privatePhoto});
 let photoDraft;for(let i=0;i<40;i++){photoDraft=await store.read(paths[1]);if(photoDraft.state.rawContent.includes('data:image/webp;'))break;await image.page.waitForTimeout(100);}
 const photoData=YAML.parse(photoDraft.state.rawContent.match(/^---\n([\s\S]*?)\n---/)[1]);assert(photoData.image.startsWith('data:image/webp;base64,'));const publicBytes=Buffer.from(photoData.image.split(',')[1],'base64');assert.equal((await sharp(publicBytes).metadata()).exif,undefined);
 report.checks.push('Existing image editor, 320px: nested window opt-in/time/note persist privately; real JPEG with synthetic GPS/device tags uploads through browser canvas as WebP with no EXIF.');
 // Close contexts without beforeunload prompts on the intentionally conflicted page.
 await a.page.evaluate(()=>window.onbeforeunload=null);for(const context of browser.contexts())await context.close();
 assert.deepEqual(report.pageErrors,[]);report.state='PASS';
}catch(error){report.state='FAIL';report.failure=error.stack;throw error;}
finally{await browser?.close();await new Promise(r=>server.close(r));await store.close();await rm(directory,{recursive:true,force:true});await writeFile(join(evidence,'editor-browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({state:report.state,checks:report.checks.length,upstream:'SYNTHETIC ONLY'}));}
