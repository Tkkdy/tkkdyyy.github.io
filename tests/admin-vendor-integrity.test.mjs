import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
test('vendored CMS bytes and bootstrap integrity match the verified fixed package',async()=>{
 const raw=await readFile(new URL('../public/admin/vendor/sveltia-cms-0.164.2.js',import.meta.url));const provenance=JSON.parse(await readFile(new URL('../public/admin/vendor/provenance.json',import.meta.url),'utf8'));assert.equal(createHash('sha256').update(raw).digest('hex'),provenance.scriptSha256);assert.equal('sha384-'+createHash('sha384').update(raw).digest('base64'),provenance.scriptSRI);const loader=await readFile(new URL('../public/admin/sveltia-loader.js',import.meta.url),'utf8');assert(loader.includes(provenance.scriptSRI));
});

test('local icon font matches its recorded hash and remains a WOFF2 file',async()=>{
 const sources=JSON.parse(await readFile(new URL('../public/admin/vendor/fonts-provenance.json',import.meta.url),'utf8'));
 for(const source of sources){const raw=await readFile(new URL('../public/admin/vendor/'+source.file,import.meta.url));assert.equal(raw.subarray(0,4).toString(),'wOF2');assert.equal(raw.length,source.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),source.sha256);}
});
