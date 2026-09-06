import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdownBody } from '../src/lib/content/render-body.mjs';
import { findLocalImageSources, rewriteImageSources, serializeTipTap } from '../src/lib/admin/serialize-tiptap.mjs';

const document = {
  type: 'doc',
  content: [
    {
      type: 'heading', attrs: { level: 2 }, content: [
        { type: 'text', text: 'Canonical', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' pipeline', marks: [{ type: 'underline' }] },
      ],
    },
    { type: 'callout', content: [{ type: 'text', text: 'Linked note', marks: [{ type: 'link', attrs: { href: 'https://example.test' } }] }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'GFM item' }] }] }] },
    { type: 'image', attrs: { src: 'data:image/png;base64,ZmFrZQ==', alt: 'Local image' } },
  ],
};

test('TipTap serializes to canonical Markdown with explicit underline and callout HTML', () => {
  const markdown = serializeTipTap(document);
  assert.match(markdown, /^## \*\*Canonical\*\*<u> pipeline<\/u>/);
  assert.match(markdown, /<aside data-callout><a href="https:\/\/example\.test">Linked note<\/a><\/aside>/);
  assert.match(markdown, /- GFM item/);
  assert.match(markdown, /!\[Local image\]\(data:image\/png;base64,ZmFrZQ==\)/);

  const html = renderMarkdownBody(markdown);
  assert.match(html, /<h2><strong>Canonical<\/strong><u> pipeline<\/u><\/h2>/);
  assert.match(html, /<aside data-callout><a href="https:\/\/example\.test">Linked note<\/a><\/aside>/);
  assert.match(html, /<ul>/);
});

test('local image sources are discoverable and rewritable before serialization', () => {
  const [source] = findLocalImageSources(document);
  assert.equal(source, 'data:image/png;base64,ZmFrZQ==');
  const rewritten = rewriteImageSources(document, { [source]: '/uploads/story-image.png' });
  assert.equal(findLocalImageSources(rewritten).length, 0);
  assert.match(serializeTipTap(rewritten), /\/uploads\/story-image\.png/);
});
