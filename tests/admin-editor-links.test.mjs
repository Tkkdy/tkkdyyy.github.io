import test from 'node:test';
import assert from 'node:assert/strict';
import {editorLink} from '../src/lib/admin/editor-links.mjs';
test('photo and recent drafts recover into their own workbenches',()=>{
 assert.equal(editorLink({type:'Image',key:'draft-photo-12345678'}),'/admin/photos/edit/?draft=draft-photo-12345678');
 assert.equal(editorLink({type:'Image',sourcePath:'src/content/images/原图.md'}),'/admin/photos/edit/?source='+encodeURIComponent('src/content/images/原图.md'));
 assert.equal(editorLink({type:'SiteSettings',key:'draft-site-settings'}),'/admin/recent/');
 assert.equal(editorLink({type:'Project',sourcePath:'src/content/projects/demo.md'},'/site/'),'/site/admin/content/?source='+encodeURIComponent('src/content/projects/demo.md'));
 assert.equal(editorLink({type:'Essay',key:'draft-12345678'}),'/admin/stories/new/?draft=draft-12345678');
});
