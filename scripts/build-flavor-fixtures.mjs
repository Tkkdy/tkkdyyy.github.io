/** Isolated acceptance only. No fixture is committed into the real photo library. */
import { readFile,writeFile,mkdir,unlink,rename,rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
const settings='src/content/site/settings.json',original=await readFile(settings),created=[];
const evidence='docs/flavor-review';
async function create(path,bytes){if(existsSync(path))throw Error('Refusing overwrite: '+path);await writeFile(path,bytes);created.push(path);}
function build(target){
 const result=spawnSync(process.execPath,['node_modules/astro/bin/astro.mjs','build',...(target==='vps'?['--config','astro.config.vps.mjs']:[])],{env:{...process.env,SITE_URL:'https://tkkdy.me',VPS_INDEXING_PROFILE:'production'},encoding:'utf8'});
 return result;
}
try{
 await mkdir('public/flavor-test',{recursive:true});await mkdir('.flavor-builds',{recursive:true});
 for(const [id,color,width,height]of [['a','#c2c9bc',1600,900],['b','#b5bcc5',800,1200],['c','#d6c9b7',1000,1000]]){
  const svg=Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="48%" text-anchor="middle" font-family="sans-serif" font-size="${width/30}" fill="#3f443f">TEST FIXTURE ${id.toUpperCase()}</text><text x="50%" y="55%" text-anchor="middle" font-family="sans-serif" font-size="${width/55}" fill="#3f443f">LAYOUT ONLY / NOT OWNER PHOTOGRAPHY</text></svg>`);
  const bytes=await sharp(svg).png().toBuffer();await create(`public/flavor-test/${id}.png`,bytes);
  await create(`src/content/images/flavor-test-${id}.md`,`---\nslug: flavor-test-${id}\nimage: /flavor-test/${id}.png\nalt: TEST FIXTURE ${id.toUpperCase()} — layout only, not owner photography\npublishedAt: 2026-11-02\nstatus: published\n${id==='a'?'capturedAt: 2026-11-02\nlocation: TEST LOCATION (synthetic metadata)\n':''}window:\n  enabled: true\n  timeOfDay: [late-night, dusk, unknown-future-value]\n  seasons: [autumn, unknown-future-value]\n  note: 测试素材 ${id.toUpperCase()} · 仅验证布局，非本人摄影\n---\n`);
 }
 await create('src/content/images/flavor-test-missing.md','---\nslug: flavor-test-missing\nimage: /flavor-test/missing.jpg\nalt: TEST missing file\npublishedAt: 2026-11-02\nstatus: published\nwindow:\n  enabled: true\n---\n');
 await create('src/content/images/flavor-test-draft.md','---\nslug: flavor-test-draft\nimage: /flavor-test/a.png\nalt: TEST unpublished image\npublishedAt: 2026-11-02\nstatus: draft\nwindow:\n  enabled: true\n---\n');
 const value=JSON.parse(original);value.recent={doing:'测试文案 · 在做字段（未确认为真实近况）',listening:'测试文案 · 在听字段',thinking:'测试文案 · 在想字段'};await writeFile(settings,JSON.stringify(value,null,2));
 for(const target of ['pages','vps','no-source']){
  if(target==='no-source'){value.music.source='';value.recent.doing='';value.recent.thinking='';await writeFile(settings,JSON.stringify(value,null,2));}
  const result=build(target);await writeFile(`${evidence}/build-fixture-${target}.txt`,result.stdout+'\n'+result.stderr);if(result.status!==0)throw Error('Fixture build failed: '+target+'\n'+result.stderr);
  // Only remove this script's fixed, workspace-local generated build directory.
  await rm(`.flavor-builds/fixture-${target}`,{recursive:true,force:true});
  await rename('dist',`.flavor-builds/fixture-${target}`);console.log('Fixture build PASS: '+target);
 }
}finally{
 await writeFile(settings,original);for(const path of created.reverse())await unlink(path);
}
