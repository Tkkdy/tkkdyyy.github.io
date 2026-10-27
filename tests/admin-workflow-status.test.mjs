import test from 'node:test';import assert from 'node:assert/strict';import {inspectWorkflow} from '../ops/admin-broker/workflow-status.mjs';
const sha='a'.repeat(40),repository='Tkkdy/tkkdyyy.github.io';const run={id:2,head_sha:sha,head_branch:'main',path:'.github/workflows/deploy.yml',event:'push'};
const job=(name,conclusion)=>({name,status:'completed',conclusion});
async function inspect(jobs,runs=[run]){return inspectWorkflow({repository,branch:'main',expectedSha:sha,github:async path=>path.includes('/jobs?')?{jobs,total_count:jobs.length}:{workflow_runs:runs}});}
test('one target failed while the other succeeded remains independent with a bounded failure reason',async()=>{
 const result=await inspect([job('pages-build','success'),job('pages-deploy','success'),job('vps-build','success'),{...job('vps-deploy','failure'),steps:[{name:'Public resource integrity',conclusion:'failure'}]}]);assert.equal(result.pages.state,'SUCCEEDED');assert.equal(result.vps.state,'FAILED');assert.equal(result.vps.step,'Public resource integrity');
});
test('wrong workflow, wrong SHA, PR and unrelated green jobs cannot be treated as target deployment',async()=>{
 for(const alternate of [{...run,path:'.github/workflows/admin-isolated-validation.yml'},{...run,head_sha:'b'.repeat(40)},{...run,event:'pull_request'}]){const result=await inspect([job('pages-build','success'),job('pages-deploy','success')],[alternate]);assert.equal(result.pages.state,'UNKNOWN');}
 assert.equal((await inspect([job('build','success'),job('deploy','success')])).pages.state,'UNKNOWN');
});
test('test branches do not query production; running and skipped are never success',async()=>{
 const result=await inspectWorkflow({repository,branch:'codex/test',expectedSha:sha,github:()=>{throw Error('Must not query');}});assert.equal(result.pages.state,'NOT_REQUESTED');
 assert.equal((await inspect([job('pages-build','success'),{name:'pages-deploy',status:'in_progress',conclusion:null}])).pages.state,'PENDING');assert.equal((await inspect([job('vps-build','success'),job('vps-deploy','skipped')])).vps.state,'SKIPPED');
});
