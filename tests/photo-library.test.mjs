import {test} from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import {photoLibraryRecords,photoLibraryGroups,photoPreviewUrl} from '../src/lib/admin/photo-library.mjs';
const photo=(slug,series,status='published')=>({type:'Image',sourcePath:`src/content/images/${slug}.md`,sourceBlobSha:'a'.repeat(40),rawContent:'---\n'+YAML.stringify({slug,series,status,image:'/uploads/test.webp',alt:'说明'})+'---\n'});
test('library separates live photos and unsent edits, hides matched and confirmed historical receipts without deleting drafts',()=>{
 const live=photo('one','公园'),draft={key:'draft-photo-one',state:{...live,rawContent:live.rawContent.replace('公园','旅行')}};
 const receipt={key:'draft-photo-old',state:{...live,publication:{publishedContent:live.rawContent}}};
 const historical={key:'draft-photo-older',merged:true,state:{...live,publication:{publishedContent:'previous live content'}}};
 const unknown={key:'draft-photo-pending',state:{...live,publication:{state:'pending'}}};
 const records=photoLibraryRecords([live],[draft,receipt,historical,unknown]);
 assert.equal(records.filter(r=>r.tab==='published').length,1);assert.equal(records.filter(r=>r.tab==='drafts').length,2);
 assert.equal(photoLibraryGroups(records,'published')[0].title,'公园');assert.equal(photoLibraryGroups(records,'drafts')[0].title,'旅行');
 assert.equal(receipt.state.publication.publishedContent,live.rawContent);
});
test('ungrouped is a stable group and arbitrary image schemes are refused',()=>{
 const r=photo('one','');assert.equal(photoLibraryGroups(photoLibraryRecords([r],[]),'published')[0].key,'ungrouped');
 assert.equal(photoPreviewUrl('javascript:alert(1)'),'');assert.equal(photoPreviewUrl('//evil.test/x'),'');assert.equal(photoPreviewUrl('https://user:pass@example.com/x'),'');assert.equal(photoPreviewUrl('/uploads/test.webp'),'https://tkkdy.me/uploads/test.webp');
});
