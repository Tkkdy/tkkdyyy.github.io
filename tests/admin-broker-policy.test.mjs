import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';import {join,relative} from 'node:path';
import {permittedPath,validateAddition,validateSvg,validateCommit,authorizeGraphql} from '../ops/admin-broker/policy.mjs';
const config={repository:'Tkkdy/tkkdyyy.github.io',branch:'codex/admin-probe',allowMain:false};
const markdown='---\ntitle: Test draft\nslug: test-draft\nstatus: draft\npublishedAt: 2026-10-25\n---\nSynthetic integration draft.';
const addition={path:'src/content/essays/test-draft.md',contents:Buffer.from(markdown).toString('base64')};
const input=()=>({branch:{repositoryNameWithOwner:config.repository,branchName:config.branch},expectedHeadOid:'a'.repeat(40),message:{headline:'Save isolated draft'},fileChanges:{additions:[addition],deletions:[]}});
const mutation='mutation($input:CreateCommitOnBranchInput!){createCommitOnBranch(input:$input){commit{oid}}}';
test('all current content collections including projects and images retain valid writes',()=>{
 for(const collection of ['articles','essays','fragments','projects','images'])for(const filename of readdirSync(`src/content/${collection}`))if(filename.endsWith('.md')){const path=`src/content/${collection}/${filename}`;assert.doesNotThrow(()=>validateAddition({path,contents:readFileSync(path).toString('base64')}),path);}
});
test('no workflow, executable, hidden file, traversal, encoded path or arbitrary upload can be written',()=>{
 for(const path of ['.github/workflows/deploy.yml','src/config.ts','public/admin/config.yml','public/uploads/test.html','public/uploads/test.js','src/content/essays/../config.md','public/uploads/.env','public/uploads/%2e%2e/token.svg'])assert(!permittedPath(path),path);
});
test('active SVG, external references and renamed executables fail while static SVG remains supported',()=>{
 assert.doesNotThrow(()=>validateSvg('<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop offset="0" /></linearGradient></defs><path fill="url(#g)" d="M0 0" /></svg>'));
 for(const svg of ['<svg onload="alert(1)"></svg>','<svg><script>alert(1)</script></svg>','<svg><foreignObject><p>x</p></foreignObject></svg>','<svg><use href="https://evil.example/x"/></svg>','<svg><path style="fill:red"/></svg>','<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg/>'])assert.throws(()=>validateSvg(svg));
 assert.throws(()=>validateAddition({path:'public/uploads/file.png',contents:Buffer.from('<html>script</html>').toString('base64')}));
});
test('main, different repository/branch, malformed head and duplicate changes are refused',()=>{
 assert.doesNotThrow(()=>validateCommit(input(),config));
 for(const patch of [{branch:{repositoryNameWithOwner:'other/repo',branchName:config.branch}},{branch:{repositoryNameWithOwner:config.repository,branchName:'main'}},{expectedHeadOid:'main'},{fileChanges:{additions:[addition,addition]}}])assert.throws(()=>validateCommit({...input(),...patch},config));
 assert.throws(()=>validateCommit({...input(),branch:{repositoryNameWithOwner:config.repository,branchName:'main'}},{...config,branch:'main'}));
});
test('GraphQL parser admits Sveltia commit mutation but rejects alternate writes and multiple operations',()=>{
 assert.equal(authorizeGraphql({query:mutation,variables:{input:input()}},config).mutation,true);
 for(const query of ['mutation {deleteRepository(input:{repositoryId:"x"}) {clientMutationId}}',mutation+' query {viewer{login}}','query {repository(owner:"wrong",name:"repo"){id}}'])assert.throws(()=>authorizeGraphql({query,variables:{input:input()}},config));
 assert.equal(authorizeGraphql({query:'query($o:String!,$r:String!){repository(owner:$o,name:$r){ref(qualifiedName:"main"){target{... on Commit{oid}}}}}',variables:{o:'Tkkdy',r:'tkkdyyy.github.io'}},config).mutation,false);
});
test('secrets and malformed frontmatter are refused before any GitHub API call',()=>{
 for(const body of ['no frontmatter',markdown.replace('status: draft','status: unknown'),markdown+'\n-----BEGIN PRIVATE KEY-----',markdown+'\nghp_'+'a'.repeat(40)])assert.throws(()=>validateAddition({...addition,contents:Buffer.from(body).toString('base64')}));
});
