import test from 'node:test';import assert from 'node:assert/strict';import {inspectTargets} from '../ops/admin-broker/deployment-status.mjs';
const sha='a'.repeat(40),old='b'.repeat(40),targets={pages:'https://pages.example/project/',vps:'https://vps.example/'};
test('one public target failure cannot suppress the other target version/health result',async()=>{
 const calls=[];const result=await inspectTargets({targets,branch:'main',expectedSha:sha,fetchImpl:async(url,options)=>{calls.push(String(url));assert.equal(options.redirect,'error');if(String(url).includes('vps.example'))throw Error('TLS failed');return options.method==='HEAD'?new Response(null):Response.json({sourceSha:sha,target:'pages'});}});
 assert.equal(result[0].status,'CURRENT_VERSION_VERIFIED');assert.equal(result[1].status,'UNKNOWN');assert.equal(calls.filter(x=>x.includes('vps.example')).length,1);assert(calls.includes('https://pages.example/project/deployment.json'));
});
test('test branch commit and old marker never become successful production deployment',async()=>{
 const result=await inspectTargets({targets,branch:'codex/probe',expectedSha:sha,fetchImpl:async url=>Response.json({sourceSha:old,target:String(url).includes('vps.')?'vps':'pages'})});assert(result.every(x=>x.status==='NOT_DEPLOYED'&&x.actualSha===old));
});
test('unconfigured, invalid and unhealthy targets report their actual limited state',async()=>{
 const missing=await inspectTargets({expectedSha:sha,branch:'main'});assert(missing.every(x=>x.status==='UNKNOWN'));
 const result=await inspectTargets({targets:{pages:'http://evil.example/',vps:targets.vps},branch:'main',expectedSha:sha,fetchImpl:async(url,options)=>options.method==='HEAD'?new Response(null,{status:503}):Response.json({sourceSha:sha,target:'vps'})});assert.equal(result[0].status,'UNKNOWN');assert.equal(result[1].status,'FAILED');
});


test('a matching build identity cannot hide a missing article page',async()=>{
 const result=await inspectTargets({targets,branch:'main',expectedSha:sha,contentPath:'essays/new-post/',fetchImpl:async(url,options)=>options.method==='HEAD'?new Response(null,{status:String(url).includes('essays/new-post')?404:200}):Response.json({sourceSha:sha,target:String(url).includes('vps.')?'vps':'pages'})});
 assert(result.every(x=>x.status==='FAILED'&&x.reason==='CONTENT_HEALTH_FAILED'));
});
test('content URLs retain each target base and reject arbitrary or traversing paths before fetching',async()=>{
 const calls=[];const result=await inspectTargets({targets,branch:'main',expectedSha:sha,contentPath:'essays/new-post/',fetchImpl:async(url,options)=>{calls.push(String(url));return options.method==='HEAD'?new Response(null):Response.json({sourceSha:sha,target:String(url).includes('vps.')?'vps':'pages'});}});
 assert.equal(result[0].contentUrl,'https://pages.example/project/essays/new-post/');assert.equal(result[1].contentUrl,'https://vps.example/essays/new-post/');assert(result.every(x=>x.status==='CURRENT_VERSION_VERIFIED'));
 for(const path of ['../secret','https://evil.example/','//evil.example/','essays/../secret/'])await assert.rejects(inspectTargets({targets,expectedSha:sha,contentPath:path,fetchImpl:()=>{throw Error('must not fetch');}}),/Invalid content path/);
});
