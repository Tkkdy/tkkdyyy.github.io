import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { localContext, photoWeight, choosePhoto, LATE_GREETING } from '../src/lib/flavor-selection.mjs';
import { validateSiteSettings, validMusicSource, SETTINGS_PATH } from '../src/lib/site-settings.mjs';
import { validateImageFile } from '../src/lib/content/image-file.mjs';
import { validateAddition, validateCommit, permittedPath } from '../ops/admin-broker/policy.mjs';
import { createContentReader } from '../ops/admin-broker/content-reader.mjs';
const raw=JSON.parse(await readFile(SETTINGS_PATH,'utf8'));
test('local time buckets and exact greeting at all requested boundaries',()=>{
 for(const [hour,minute,time] of [[23,59,'night'],[0,0,'late-night'],[4,59,'late-night'],[5,0,'morning'],[10,59,'morning'],[11,0,'daytime'],[16,59,'daytime'],[17,0,'dusk'],[19,59,'dusk'],[20,0,'night']])assert.equal(localContext(new Date(2026,10,2,hour,minute)).time,time);
 assert.equal(LATE_GREETING,'这么晚还不睡，早点睡觉哦。');
 for(const [month,season] of [[0,'winter'],[1,'winter'],[2,'spring'],[4,'spring'],[5,'summer'],[7,'summer'],[8,'autumn'],[10,'autumn'],[11,'winter']])assert.equal(localContext(new Date(2026,month,1)).season,season);
});
test('weighted random retains all-pool freedom and excludes the previous photo',()=>{
 const context={time:'dusk',season:'autumn'},pool=[{id:'both',timeOfDay:['dusk'],seasons:['autumn']},{id:'one',seasons:['autumn']},{id:'none',timeOfDay:['future'],seasons:['unknown']}];
 assert.deepEqual(pool.map(p=>photoWeight(p,context)),[6,3,1]);
 assert.equal(choosePhoto([],context),null);assert.equal(choosePhoto([pool[0]],context,'both').id,'both');
 assert.equal(choosePhoto(pool,context,'',()=>0).id,'both');assert.equal(choosePhoto(pool,context,'',()=>.65).id,'one');assert.equal(choosePhoto(pool,context,'',()=>.99).id,'none');
 for(let i=0;i<100;i++)assert.notEqual(choosePhoto(pool,context,'both').id,'both');
 assert.equal(photoWeight({id:'unknown',timeOfDay:'dusk',seasons:null},context),1);
});
test('site content defaults are honest; strict fields and safe music URLs',()=>{
 assert.deepEqual(validateSiteSettings(raw).recent,{doing:'',listening:'',thinking:''});
 for(const url of ['', 'https://music.example/song','/music/angelika-vee-you-are-my-sunshine.mp3'])assert(validMusicSource(url));
 for(const url of ['javascript:alert(1)','data:audio/mp3,x','http://example.com/','https://user:secret@example.com','//example.com','/music/../secret.mp3'])assert(!validMusicSource(url));
 for(const value of [{...raw,unknown:1},{...raw,recent:{...raw.recent,mood:'invented'}},{...raw,recent:{...raw.recent,doing:'x'.repeat(241)}}])assert.throws(()=>validateSiteSettings(value));
 assert.doesNotThrow(()=>validateSiteSettings({...raw,music:{...raw.music,source:''}}));
});
test('only the exact JSON settings file is writable; malformed values and deletion rejected',()=>{
 assert(permittedPath(SETTINGS_PATH));
 for(const path of ['src/content/site/other.json','src/content/site/settings.json.js','src/content/site/../settings.json','public/music/upload.mp3'])assert(!permittedPath(path));
 assert.doesNotThrow(()=>validateAddition({path:SETTINGS_PATH,contents:Buffer.from(JSON.stringify(raw)).toString('base64')}));
 for(const text of ['{','{"unknown":true}',JSON.stringify({...raw,music:{...raw.music,source:'javascript:alert(1)'}})])assert.throws(()=>validateAddition({path:SETTINGS_PATH,contents:Buffer.from(text).toString('base64')}));
 assert.throws(()=>validateCommit({branch:{repositoryNameWithOwner:'Tkkdy/tkkdyyy.github.io',branchName:'codex/test'},expectedHeadOid:'a'.repeat(40),message:{headline:'delete settings'},fileChanges:{deletions:[{path:SETTINGS_PATH}]}},{repository:'Tkkdy/tkkdyyy.github.io',branch:'codex/test'}));
});
test('existing pinned-head reader exposes settings with blob identity and excludes other JSON',async()=>{
 const reader=createContentReader({repository:'Tkkdy/tkkdyyy.github.io',branch:'main',github:async url=>url.includes('/git/ref/')?{object:{sha:'a'.repeat(40)}}:url.includes('/git/trees/')?{truncated:false,tree:[{type:'blob',path:SETTINGS_PATH,sha:'b'.repeat(40),size:200},{type:'blob',path:'private-settings.json',sha:'c'.repeat(40),size:100}]}:{data:{repository:{f0:{text:JSON.stringify(raw)}}}}});
 const catalog=await reader();assert.equal(catalog.resources.length,1);assert.equal(catalog.resources[0].type,'SiteSettings');assert.equal(catalog.resources[0].sourceBlobSha,'b'.repeat(40));
});
test('window assets reject missing/corrupt/traversal/remote input; re-encoding strips GPS',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'window-image-'));
 try{
  await mkdir(join(dir,'photos'));
  await sharp({create:{width:160,height:90,channels:3,background:'#ddd'}}).jpeg().withExif({IFD0:{Artist:'PRIVATE DEVICE'},IFD3:{GPSLatitudeRef:'N',GPSLatitude:'37/1 0/1 0/1',GPSLongitudeRef:'E',GPSLongitude:'122/1 0/1 0/1'}}).toFile(join(dir,'photos/test.jpg'));
  const meta=await validateImageFile('/photos/test.jpg',dir);assert.equal(meta.width,160);
  const derived=await sharp(join(dir,'photos/test.jpg')).rotate().resize({width:80}).webp().toBuffer();assert.equal((await sharp(derived).metadata()).exif,undefined);
  await writeFile(join(dir,'photos/corrupt.jpg'),'not an image');
  for(const path of ['/photos/missing.jpg','/photos/corrupt.jpg','/../secret.jpg','/%2e%2e/secret.jpg','https://example.com/photo.jpg'])await assert.rejects(validateImageFile(path,dir));
 }finally{await rm(dir,{recursive:true,force:true});}
});
