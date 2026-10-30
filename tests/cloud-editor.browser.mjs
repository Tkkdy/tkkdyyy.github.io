/** Local real browser + real broker/SQLite; GitHub OAuth/upstream are synthetic. Never production acceptance. */
import assert from 'node:assert/strict';import {mkdtemp,readFile,rm,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createBroker} from '../ops/admin-broker/core.mjs';import {createAdminServer} from '../ops/admin-broker/server.mjs';import {openDraftStore} from '../ops/admin-broker/private-drafts.mjs';
const evidence=resolve(process.argv[2]||'../cloud-editor-evidence-20261028');await mkdir(evidence,{recursive:true});
const directory=await mkdtemp(join(tmpdir(),'cloud-editor-browser-')),store=await openDraftStore({directory}),origin='http://127.0.0.1:19544';
const paths=['src/content/essays/story-2026-09-12.md','src/content/articles/context-is-the-new-interface.md','src/content/fragments/2026-08-05-context-compounds.md','src/content/projects/morning-radar.md','src/content/images/photo-main-landscape.md'];
const files=await Promise.all(paths.map(async path=>{const bytes=await readFile(path),sha=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');return{path,sha,text:bytes.toString('utf8'),size:bytes.length,type:'blob'};}));let upstreamWrites=0;
const config={origin,clientId:'SYNTHETIC_CLIENT',clientSecret:'SYNTHETIC_SECRET',repository:'Tkkdy/tkkdyyy.github.io',repositoryId:1355866312,ownerId:144055705,branch:'main',publicationMode:'pull-request'};
const broker=createBroker(config,{draftStore:store,fetchImpl:async(url,options={})=>{
 if(url.endsWith('/access_token'))return Response.json({access_token:'SYNTHETIC_GITHUB_TOKEN',token_type:'bearer',expires_in:3600});
 if(url.endsWith('/user'))return Response.json({id:144055705,login:'Tkkdy'});
 if(url.includes('/git/ref/heads/'))return Response.json({object:{sha:'a'.repeat(40),type:'commit'}});
 if(url.includes('/git/trees/'))return Response.json({tree:files.map(({text,...f})=>f),truncated:false});
 if(url.endsWith('/graphql')){const query=JSON.parse(options.body).query;if(query.startsWith('mutation')){upstreamWrites++;throw Error('Unexpected GitHub mutation');}const result={};for(const match of query.matchAll(/f([0-9]+):object\(oid:"([a-f0-9]+)"\)/g))result['f'+match[1]]={text:files.find(f=>f.sha===match[2]).text};return Response.json({data:{repository:result}});}
 if(options.method&&options.method!=='GET'){upstreamWrites++;throw Error('Unexpected GitHub write');}
 return Response.json({id:1355866312,full_name:config.repository,owner:{id:144055705}});
}});
const server=await createAdminServer({origin,broker,staticRoot:resolve('dist-admin')});await new Promise((res,rej)=>{server.once('error',rej);server.listen(19544,'127.0.0.1',res);});
let browser;const errors=[],results=[];
async function context(options={}){const c=await browser.newContext(options);const login=await c.request.get(origin+'/auth/login',{maxRedirects:0});const state=new URL(login.headers().location).searchParams.get('state');const callback=await c.request.get(origin+'/auth/callback?code=synthetic&state='+state,{maxRedirects:0});assert.equal(callback.status(),303);const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));return{c,page};}
try{
 browser=await chromium.launch({headless:true,channel:'msedge'});
 const a=await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 await a.page.goto(origin+'/admin/stories/new/');await a.page.waitForFunction(()=>document.querySelector('.editor-workspace')?.inert===false);
 await a.page.locator('.story-title-input').fill('跨设备私有测试');await a.page.locator('.story-prose').fill('中文输入与长文滚动测试。'.repeat(120));
 await a.page.locator('.cloud-draft-feedback').getByText('已保存到云端 · 私有草稿',{exact:true}).waitFor();
 const address=a.page.url();const key=new URL(address).searchParams.get('draft');assert(key);
 assert.equal((await store.read(key)).state.title,'跨设备私有测试');
 await a.page.screenshot({path:join(evidence,'android-sized-editor.png'),fullPage:false});
 const b=await context({viewport:{width:820,height:1180},isMobile:true,hasTouch:true});await b.page.goto(address);await b.page.waitForFunction(()=>document.querySelector('.editor-workspace')?.inert===false);assert.equal(await b.page.locator('.story-title-input').inputValue(),'跨设备私有测试');assert((await b.page.locator('.story-prose').innerText()).includes('中文输入'));
 results.push('Independent cookie jars recover the same persisted private draft, including long Chinese text.');
 // Upload a real tiny PNG into the existing image dialog and recover its bytes in another session.
 await b.page.getByRole('button',{name:'插入区块',exact:true}).click();await b.page.locator('[data-insert-block="image"]').click();
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9kAAAAASUVORK5CYII=','base64');
 await b.page.locator('[data-image-file]').setInputFiles({name:'private.png',mimeType:'image/png',buffer:png});await b.page.locator('[data-image-alt]').fill('私有图片');await b.page.locator('[data-image-save]').click();
 await b.page.locator('.cloud-draft-feedback').getByText('已保存到云端 · 私有草稿',{exact:true}).waitFor();assert(JSON.stringify((await store.read(key)).state).includes(png.toString('base64')));
 await b.page.screenshot({path:join(evidence,'ipad-sized-editor.png'),fullPage:false});
 const desktop=await context({viewport:{width:1440,height:960}});await desktop.page.goto(address);await desktop.page.waitForFunction(()=>document.querySelector('.editor-workspace')?.inert===false);await desktop.page.locator('.story-prose img[alt="私有图片"]').waitFor();assert((await desktop.page.locator('.story-prose img').getAttribute('src')).includes(png.toString('base64')));
 const [preview]=await Promise.all([desktop.page.waitForEvent('popup'),desktop.page.getByRole('button',{name:'预览',exact:true}).click()]);await preview.frameLocator('[data-preview-frame]').locator('img[alt="私有图片"]').waitFor();await preview.close();await desktop.c.close();results.push('Desktop session recovers uploaded image bytes and opens the existing sanitized preview.');

 await a.page.locator('.story-title-input').fill('设备A旧版本不能覆盖');await a.page.getByRole('button',{name:'将此页另存为草稿',exact:true}).waitFor();assert.equal((await store.read(key)).state.title,'跨设备私有测试');
 await a.page.getByRole('button',{name:'将此页另存为草稿',exact:true}).click();await a.page.waitForURL(u=>u.searchParams.get('draft')!==key);await a.page.waitForFunction(()=>document.querySelector('.editor-workspace')?.inert===false);assert.equal(await a.page.locator('.story-title-input').inputValue(),'设备A旧版本不能覆盖');
 results.push('Real image upload remains private in SQLite; stale device receives conflict and saves a separate copy.');
 await b.page.goto(origin+'/admin/');await b.page.locator('.story-row').filter({hasText:'Morning Radar'}).first().waitFor();assert(await b.page.locator('.story-row').filter({hasText:'私有草稿'}).count()>0);
 const project=files.find(f=>f.path.includes('/projects/'));await b.page.goto(origin+'/admin/content/?source='+encodeURIComponent(project.path));await b.page.locator('[data-resource-form]').waitFor({state:'visible'});await b.page.locator('[name="tagline"]').fill('私有项目修改');await b.page.getByText('已保存到云端 · 私有草稿',{exact:true}).waitFor();assert((await store.read(project.path)).state.rawContent.includes('私有项目修改'));
 await b.page.goto(origin+'/admin/drafts/');await b.page.getByRole('button',{name:'恢复历史版本',exact:true}).first().waitFor();
 results.push('Home includes live projects/images and private drafts; existing project fields autosave privately; recovery page loads.');
 for(const c of [a,b]){assert(await c.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await c.c.close();}
 assert.equal(upstreamWrites,0);assert.deepEqual(errors,[]);results.push('No GitHub writes, no page errors; final narrow/tablet views have no horizontal overflow.');
 await writeFile(join(evidence,'browser-results.json'),JSON.stringify({state:'PASS',scope:'Real local Chromium + broker + SQLite; synthetic GitHub OAuth/upstream; Android/iPad-sized Chromium emulation only',results,upstreamWrites,errors},null,2));console.log(JSON.stringify({state:'PASS',results,evidence}));
}catch(error){for(const [i,c]of (browser?.contexts()||[]).entries())for(const page of c.pages()){console.error((await page.locator('body').innerText()).slice(-350));await page.screenshot({path:join(evidence,'failure-'+i+'.png'),fullPage:false}).catch(()=>{});}throw error;}finally{await browser?.close();await new Promise(r=>server.close(r));await store.close();await rm(directory,{recursive:true,force:true});}
