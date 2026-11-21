import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../public/meadow/refinement/arrival-study/bake/',import.meta.url);
const load=n=>readFile(new URL(n,root),'utf8');
const {id,sourceLF}=JSON.parse(await load('source-lock.json'));
for(const path of Object.keys(id.dependencies)){
 const text=(await load(path)).replaceAll('\r\n','\n');
 assert.equal(createHash('sha256').update(text).digest('hex'),sourceLF[path],path+' differs from the baked coast');
}
for(const q of ['desktop','mobile'])assert.deepEqual(JSON.parse(await load('D-'+q+'.json')).id,id);
console.log('Meadow coast sources and both manifests verified');
