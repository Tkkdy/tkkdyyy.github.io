import test from 'node:test';
import assert from 'node:assert/strict';
import { toDeploymentUrl, rewriteContentUrl, publicAssetPath, rewriteSrcset } from '../src/lib/content-url.mjs';
import { normalizeHtmlUrls } from '../src/lib/content/normalize-html.mjs';
const pages = { base: '/tkkdyyy.github.io/' }, vps = { base: '/' };
test('legacy uploader paths work on both targets without duplicate prefixes', () => {
  for (const path of ['/uploads/a.png', '/tkkdyyy.github.io/uploads/a.png', 'https://tkkdy.github.io/tkkdyyy.github.io/uploads/a.png', '//tkkdy.github.io/tkkdyyy.github.io/uploads/a.png']) {
    assert.equal(toDeploymentUrl(path, pages), '/tkkdyyy.github.io/uploads/a.png');
    assert.equal(toDeploymentUrl(path, vps), '/uploads/a.png');
  }
});
test('external URLs, data images, fragments and queries are preserved', () => {
  for (const path of ['https://other.example/a.png','//other.example/a.png','data:image/png;base64,abc==','mailto:a@example.test','#heading','?view=1','https://tkkdy.github.io/other-repository/a.png']) {
    assert.equal(toDeploymentUrl(path, pages), path);assert.equal(toDeploymentUrl(path, vps), path);
  }
});
test('Markdown relative URLs keep their meaning while root links use deployment base', () => {
  assert.equal(rewriteContentUrl('../other/#x', pages), '../other/#x');
  assert.equal(rewriteContentUrl('relative.png', pages), 'relative.png');
  assert.equal(rewriteContentUrl('/', pages), '/tkkdyyy.github.io/');
  assert.equal(rewriteContentUrl('/essays/?a=1#x', pages), '/tkkdyyy.github.io/essays/?a=1#x');
});
test('a similarly named path or a hostile lookalike origin is not mistaken for the old project', () => {
  assert.equal(toDeploymentUrl('/tkkdyyy.github.io-extra/a', vps), '/tkkdyyy.github.io-extra/a');
  assert.equal(toDeploymentUrl('https://tkkdy.github.io.evil.test/tkkdyyy.github.io/a', vps), 'https://tkkdy.github.io.evil.test/tkkdyyy.github.io/a');
});
test('public-file lookup handles old prefixes, absolute legacy origin and query', () => {
  assert.equal(publicAssetPath('/tkkdyyy.github.io/uploads/a%20b.png?v=2#x'), '/uploads/a b.png');
  assert.equal(publicAssetPath('https://tkkdy.github.io/tkkdyyy.github.io/uploads/a.png'), '/uploads/a.png');
  assert.equal(publicAssetPath('https://other.example/a.png'), null);
});
test('raw HTML image, link and video attributes normalize without changing code/script text', () => {
  const html='<img src="/tkkdyyy.github.io/uploads/a.png"><a href="/">Home</a><video poster="/uploads/p.png"></video><script>const sample="/uploads/keep.png";</script><code>/uploads/keep.png</code>';
  const out=normalizeHtmlUrls(html,pages);
  assert.match(out.html,/src="\/tkkdyyy.github.io\/uploads\/a.png"/);
  assert.match(out.html,/href="\/tkkdyyy.github.io\/"/);
  assert.match(out.html,/poster="\/tkkdyyy.github.io\/uploads\/p.png"/);
  assert.match(out.html,/const sample="\/uploads\/keep.png"/);
  assert.match(out.html,/<code>\/uploads\/keep.png<\/code>/);
});
test('canonical remains absolute while historical body images change target', () => {
  const input='<!doctype html><html><head><link rel="canonical" href="https://tkkdy.github.io/tkkdyyy.github.io/essays/"></head><body><img src="https://tkkdy.github.io/tkkdyyy.github.io/uploads/a.png"></body></html>';
  const out=normalizeHtmlUrls(input,{...vps,document:true});
  assert.match(out.html,/rel="canonical" href="https:\/\/tkkdy.github.io\/tkkdyyy.github.io\/essays\/"/);
  assert.match(out.html,/<img src="\/uploads\/a.png">/);
});
test('srcset preserves data URL commas and candidate descriptors', () => {
  const out=rewriteSrcset('data:image/png;base64,abc== 1x, /uploads/a.png 2x',pages);
  assert.equal(out,'data:image/png;base64,abc== 1x, /tkkdyyy.github.io/uploads/a.png 2x');
  assert.equal(rewriteSrcset('/uploads/a.png, /uploads/b.png 2x',vps),'/uploads/a.png, /uploads/b.png 2x');
});
test('rewriting is idempotent and future root-domain neutral', () => {
  const input='<img src="/tkkdyyy.github.io/uploads/a.png"><a href="/essays/">Read</a>';
  for(const options of [pages,vps,{base:'/another-project/'}]) {
    const once=normalizeHtmlUrls(input,options);
    assert.equal(normalizeHtmlUrls(once.html,options).html,once.html);
  }
});
