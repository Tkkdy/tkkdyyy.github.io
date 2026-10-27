import {resolve} from 'node:path';
import YAML from 'yaml';
import {inspectCmsBrowser,UPLOAD_PNG_BASE64} from './cms_browser.mjs';
/** Actual GitHub test-branch writes. Authentication upstream is explicitly synthetic. */
import assert from 'node:assert/strict';import {mkdtemp,rm,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createBroker} from './core.mjs';import {createAdminServer} from './server.mjs';import {createGitHubClient,textToBase64,readAdminSession} from '../../src/lib/admin/github-content.mjs';import {publishStory} from '../../src/lib/admin/publish-story.mjs';
const REPOSITORY='Tkkdy/tkkdyyy.github.io',nativeFetch=globalThis.fetch;
let server,root,stage='GUARD';
try{
 assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,REPOSITORY);assert.equal(process.env.GITHUB_REF,'refs/heads/codex/admin-secure-migration');assert.equal(process.env.GITHUB_EVENT_NAME,'push');
 const token=process.env.GH_TEST_TOKEN;assert(token);const source=process.env.GITHUB_SHA;assert(/^[a-f0-9]{40}$/.test(source));assert(/^\d+$/.test(process.env.GITHUB_RUN_ID));assert(/^\d+$/.test(process.env.GITHUB_RUN_ATTEMPT));
 const branch=`codex/admin-write-probe-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`,slug=`admin-write-probe-${process.env.GITHUB_RUN_ID}`;
 async function api(path,options={}){const r=await nativeFetch('https://api.github.com'+path,{redirect:'error',signal:AbortSignal.timeout(20000),...options,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'}});assert(r.ok,'GitHub API rejected isolated request');return r.status===204?null:r.json();}
 stage='CREATE_TEST_BRANCH';const mainBefore=(await api('/repos/'+REPOSITORY+'/git/ref/heads/main')).object.sha;
 await api('/repos/'+REPOSITORY+'/git/refs',{method:'POST',body:JSON.stringify({ref:'refs/heads/'+branch,sha:source})});
 root=await mkdtemp(join(tmpdir(),'admin-real-github-'));
 // Reserve an ephemeral loopback port first; all HTTP and policy behavior is the real implementation.
 const http=await import('node:http');const reserve=http.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));const origin='http://127.0.0.1:'+port;
 const broker=createBroker({origin,repository:REPOSITORY,repositoryId:1355866312,ownerId:144055705,branch,allowMain:false,clientId:'ISOLATED_SYNTHETIC_CLIENT',clientSecret:'ISOLATED_SYNTHETIC_SECRET'},{fetchImpl:async(url,options)=>{
  // No OAuth account is created or used. The runner's short-lived token stays server-side.
  if(url==='https://github.com/login/oauth/access_token')return Response.json({access_token:token,expires_in:1800,token_type:'bearer'});
  if(url==='https://api.github.com/user')return Response.json({id:144055705,login:'Tkkdy'});
  return nativeFetch(url,options);
 }});
 server=await createAdminServer({origin,staticRoot:resolve('dist-admin'),broker});await new Promise(r=>server.listen(port,'127.0.0.1',r));
 stage='SYNTHETIC_AUTH_REAL_HTTP';const initial=await nativeFetch(origin+'/auth/login',{redirect:'manual'});const state=new URL(initial.headers.get('location')).searchParams.get('state');const flowCookie=initial.headers.getSetCookie()[0].split(';')[0];
 const callback=await nativeFetch(origin+'/auth/callback?code=synthetic&state='+state,{headers:{cookie:flowCookie},redirect:'manual'});assert.equal(callback.status,303);const cookie=callback.headers.getSetCookie().find(x=>x.startsWith('editorial-local-session=')).split(';')[0];
 // Browser transport shim only supplies cookie/Origin and resolves relative URLs; content client is unchanged.
 globalThis.fetch=(url,options={})=>{assert(String(url).startsWith('/api/'));return nativeFetch(new URL(url,origin),{...options,headers:{...options.headers,cookie,origin}});};
 const session=await readAdminSession();assert.equal(session.branch,branch);assert(!JSON.stringify(session).includes(token));
 const client=createGitHubClient({owner:'Tkkdy',repo:'tkkdyyy.github.io',branch,csrf:session.csrf});
 stage='DRAFT_WRITE';const path=`src/content/essays/${slug}.md`;const draft=`---\ntitle: Isolated Admin write probe\nslug: ${slug}\npublishedAt: 2026-10-25\nstatus: draft\n---\n\nSynthetic isolated test content. Never deployed to production.\n`;
 const draftCommit=await client.commitFiles({expectedHeadOid:await client.getHead(),message:'Test draft: isolated Admin write probe',files:[{path,contentBase64:textToBase64(draft)}]});assert.equal((await client.readFile(path,draftCommit.sha)).content,draft);
 stage='STUDIO_PUBLISH_TEST_BRANCH';const result=await publishStory({session,state:{type:'Essay',status:'published',title:'Isolated Admin write probe',slug,publishedAt:'2026-10-25',body:'Synthetic isolated test content. Never deployed to production.',bodyBlocks:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Synthetic isolated test content. Never deployed to production.'}]}]},sourcePath:path,deck:'Isolated test only',tags:[],categories:[],showOnHomepage:false}});
 assert.equal(result.branch,branch);assert.notEqual(result.commitSha,draftCommit.sha);const stored=await client.readFile(path,result.commitSha);assert.match(stored.content,/status: published/);assert.match(stored.content,/Synthetic isolated test content/);
 stage='STALE_HEAD_AND_FORBIDDEN_WRITES';await assert.rejects(client.commitFiles({expectedHeadOid:draftCommit.sha,message:'Stale head probe',files:[{path,contentBase64:textToBase64(draft)}]}));assert.equal(await client.getHead(),result.commitSha);
 for(const badPath of ['.github/workflows/deploy.yml','src/pages/index.astro'])await assert.rejects(client.commitFiles({expectedHeadOid:result.commitSha,message:'Forbidden write probe',files:[{path:badPath,contentBase64:textToBase64('refused before GitHub')}]}));
 const versions=await client.deploymentStatus(result.commitSha);assert(versions.targets.every(x=>x.status==='UNKNOWN'));
 stage='REAL_CMS_BROWSER';await inspectCmsBrowser({origin,cookie,githubToken:token});
 const browserSha=await client.getHead();assert.notEqual(browserSha,result.commitSha);
 stage='REAL_UPLOAD_READBACK';const browserContent=(await client.readFile(path,browserSha)).content;const metadata=YAML.parse(browserContent.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);assert.match(metadata.cover,/^\/uploads\/admin-write-probe-\d+-cover-[a-f0-9]{12}\.png$/);assert.equal(metadata.coverAlt,'Synthetic isolated upload, test branch only');
 const uploaded=await api('/repos/'+REPOSITORY+'/contents/public'+metadata.cover+'?ref='+browserSha);assert.equal(uploaded.encoding,'base64');assert.deepEqual(Buffer.from(uploaded.content,'base64'),Buffer.from(UPLOAD_PNG_BASE64,'base64'));
 stage='REAL_CONTENT_BLOB_CONFLICT';const storyResponse=await globalThis.fetch('/api/story?path='+encodeURIComponent(path));assert.equal(storyResponse.status,200);const loadedStory=await storyResponse.json();const oldStory=loadedStory.story;assert(oldStory.sourceBlobSha);
 const concurrentContent=browserContent+'\nConcurrent synthetic writer change. Test branch only.\n';const concurrent=await client.commitFiles({expectedHeadOid:browserSha,message:'Test concurrent content writer on isolated branch',files:[{path,contentBase64:textToBase64(concurrentContent)}]});
 await assert.rejects(publishStory({session,state:{...oldStory,bodyBlocks:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Stale synthetic body must never replace concurrent content.'}]}]}}}),/开始编辑后已变化/);
 const finalSha=await client.getHead();assert.equal(finalSha,concurrent.sha);assert.equal((await client.readFile(path,finalSha)).content,concurrentContent);
 assert.match((await client.readFile('src/content/projects/morning-radar.md',finalSha)).content,/ISOLATED CMS BROWSER TEST/);
 assert.match((await client.readFile('src/content/images/photo-main-landscape.md',finalSha)).content,/ISOLATED CMS BROWSER TEST/);
 const mainAfter=(await api('/repos/'+REPOSITORY+'/git/ref/heads/main')).object.sha;
 const report={schema:1,scope:'SYNTHETIC_AUTH_REAL_GITHUB_TEST_BRANCH_WRITES',productionWrites:false,realOAuthValidated:false,status:'PASS',sourceSha:source,testBranch:branch,draftSha:draftCommit.sha,studioSha:result.commitSha,publishSha:finalSha,mainBefore,mainAfter,mainChangedDuringTest:mainBefore!==mainAfter,checks:['ACTUAL_HTTP_COOKIE_CSRF','REAL_DRAFT_COMMIT_AND_READBACK','REAL_STUDIO_PUBLICATION_ON_TEST_BRANCH','STALE_HEAD_REJECTED','WORKFLOW_AND_CODE_WRITES_REJECTED','UNCONFIGURED_TARGETS_NOT_SUCCESS','REAL_GITHUB_CMS_BROWSER_FORMS','REAL_UPLOAD_BYTES_READBACK','REAL_CONTENT_BLOB_CONFLICT_REFUSED']};
 await writeFile('admin-integration.json',JSON.stringify(report,null,2)+'\n');await writeFile(process.env.GITHUB_OUTPUT,`test_branch=${branch}\ncontent_sha=${finalSha}\n`,{flag:'a'});console.log(JSON.stringify(report));
}catch{console.error('Isolated Admin integration failed at '+stage);process.exitCode=1;}finally{globalThis.fetch=nativeFetch;if(server)await new Promise(r=>server.close(r));if(root)await rm(root,{recursive:true,force:true});}
