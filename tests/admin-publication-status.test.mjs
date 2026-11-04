import test from 'node:test';
import assert from 'node:assert/strict';
import {proposalStatusView,deploymentStatusView} from '../src/lib/admin/publication-status.mjs';
import {inspectProposalChecks} from '../ops/admin-broker/proposal-checks.mjs';
import {inspectWorkflow} from '../ops/admin-broker/workflow-status.mjs';
const sha='a'.repeat(40),branch='codex/editorial-proposal-test',repository='Tkkdy/tkkdyyy.github.io';
const run={id:12,head_sha:sha,head_branch:branch,head_repository:{id:1355866312},event:'pull_request',path:'.github/workflows/ci.yml',status:'completed',conclusion:'failure'};
const jobs=[{name:'check',status:'completed',conclusion:'failure',steps:[{name:'Run npm run test:search',conclusion:'failure'}]}];
const github=async path=>path.includes('/jobs?')?{total_count:jobs.length,jobs}:{total_count:1,workflow_runs:[run]};
const target=(name,status='CURRENT_VERSION_VERIFIED',pipeline='SUCCEEDED')=>({target:name,status,actualSha:sha,url:'https://example.com/',pipeline:{state:pipeline}});
test('exact-head failed search is explained before deployment, with original proposal preserved',async()=>{
 const checks=await inspectProposalChecks({github,original:{commitSha:sha,branch}});
 assert.equal(checks.state,'FAILED');assert.equal(checks.step,'Run npm run test:search');
 const view=proposalStatusView({state:'PULL_REQUEST_OPEN',checks,publication:{state:'CI_FAILED'}});
 assert.match(view.summary,/中文搜索检查未通过/);assert.equal(view.steps.checks,'failure');assert.equal(view.steps.merge,'waiting');assert(view.targets.every(t=>/尚未开始部署/.test(t.text)));assert.equal(view.done,true);
});
test('different head, branch, repository or workflow cannot supply CI status',async()=>{
 for(const change of [{head_sha:'b'.repeat(40)},{head_branch:'other'},{head_repository:{id:1}},{path:'.github/workflows/deploy.yml'}]){
  const result=await inspectProposalChecks({github:async()=>({total_count:1,workflow_runs:[{...run,...change}]}),original:{commitSha:sha,branch}});assert.equal(result.state,'PENDING');
 }
});
test('green outer CI without all expected successful jobs never claims checks passed',async()=>{
 const result=await inspectProposalChecks({github:async path=>path.includes('/jobs?')?{total_count:0,jobs:[]}:{total_count:1,workflow_runs:[{...run,conclusion:'success'}]},original:{commitSha:sha,branch}});
 assert.equal(result.state,'UNKNOWN');
});
test('public marker during deployment acceptance is not final publication success',()=>{
 const view=deploymentStatusView({targets:[target('pages'),target('vps','CURRENT_VERSION_VERIFIED','PENDING')]});
 assert.equal(view.state,'running');assert.match(view.summary,/一站已上线/);assert.equal(view.done,false);assert.equal(view.targets[1].live,false);assert.match(view.targets[1].text,/验收尚未结束/);
});
test('green pipelines with stale or unreachable public versions continue tracking',()=>{
 for(const status of ['VERSION_DIFFERS','UNKNOWN']){const view=deploymentStatusView({targets:[target('pages'),target('vps',status)]});assert.equal(view.done,false);assert.notEqual(view.state,'success');assert.equal(view.targets[0].live,true);}
 assert.notEqual(deploymentStatusView({targets:[]}).state,'success');
});
test('one failed target never hides the independent successful target',()=>{
 const bad=target('vps','VERSION_DIFFERS','FAILED');bad.pipeline.job='vps-deploy';bad.pipeline.step='Single guarded transaction and browser acceptance';
 const view=deploymentStatusView({targets:[target('pages'),bad]});assert.equal(view.state,'failure');assert.equal(view.targets[0].live,true);assert.equal(view.targets[1].state,'failure');assert.equal(view.done,true);assert.match(view.targets[1].detail,/部署或验收/);
});
test('both targets require independent matching public versions and successful pipelines',()=>{
 const view=deploymentStatusView({targets:[target('pages'),target('vps')]});assert.equal(view.state,'success');assert.equal(view.done,true);assert(view.targets.every(t=>t.live));
});
test('partial production job list reports build progress and failed builds remain failures',async()=>{
 const base={repository,expectedSha:sha,branch:'main'};
 for(const failed of [false,true]){
  const result=await inspectWorkflow({...base,github:async path=>path.includes('/jobs?')?{total_count:1,jobs:[{name:'pages-build',status:failed?'completed':'in_progress',conclusion:failed?'failure':null,steps:[{name:'npm run build',status:'in_progress'}]}]}:{workflow_runs:[{...run,event:'push',path:'.github/workflows/deploy.yml',head_branch:'main',status:'in_progress'}]}});
  assert.equal(result.pages.state,failed?'FAILED':'PENDING');if(!failed)assert.equal(result.pages.job,'pages-build');
 }
});
