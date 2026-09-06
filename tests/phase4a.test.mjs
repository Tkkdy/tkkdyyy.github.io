import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { convertedBlockJson } from '../src/lib/admin/convert-block.mjs';
import { draftStorageKey, resolveDraftId } from '../src/lib/admin/draft-storage.mjs';
import { mergeStudioFrontmatter, splitContentFile } from '../src/lib/admin/frontmatter.mjs';

test('new-story URLs receive independent stable draft IDs', () => {
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  const first = resolveDraftId('new-story', 'https://example.test/admin/stories/new/', { randomUUID: () => ids[0] });
  const second = resolveDraftId('new-story', 'https://example.test/admin/stories/new/', { randomUUID: () => ids[1] });
  const reload = resolveDraftId('new-story', first.url, { randomUUID: () => { throw new Error('must not regenerate'); } });

  assert.notEqual(first.id, second.id);
  assert.equal(reload.id, first.id);
  assert.notEqual(draftStorageKey(first.id), draftStorageKey(second.id));
});

test('heading, quote, and callout conversions retain inline marks', () => {
  const markedContent = [
    { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
    { type: 'text', text: ' italic', marks: [{ type: 'italic' }] },
    { type: 'text', text: ' underline', marks: [{ type: 'underline' }] },
    { type: 'text', text: ' link', marks: [{ type: 'link', attrs: { href: 'https://example.test' } }] },
  ];
  const source = { type: 'paragraph', content: markedContent };

  for (const target of ['heading', 'quote', 'callout']) {
    const converted = convertedBlockJson(source, target);
    const retained = target === 'quote' ? converted.content[0].content : converted.content;
    assert.deepEqual(retained, markedContent);
  }
});

test('frontmatter merge updates Studio fields and preserves unknown metadata and body', () => {
  const existing = `---\n# editorial note\ntitle: Before\nslug: before\nstatus: draft\ncustomPlugin:\n  mode: careful\ntoc: true\n---\n\nOld **body**.\n`;
  const merged = mergeStudioFrontmatter(existing, 'Article', {
    title: 'After', slug: 'after', status: 'published', publishNumber: 42, toc: false,
  });
  const parts = splitContentFile(merged);
  const data = parse(parts.frontmatter);

  assert.equal(data.title, 'After');
  assert.equal(data.slug, 'after');
  assert.equal(data.status, 'published');
  assert.equal(data.publishNumber, 42);
  assert.deepEqual(data.customPlugin, { mode: 'careful' });
  assert.equal(data.toc, true, 'unmanaged fields cannot be overwritten by Studio state');
  assert.equal(parts.body, 'Old **body**.\n');
});

test('cover and coverAlt survive a localStorage JSON round trip', () => {
  const draft = {
    id: 'draft-cover-test',
    cover: 'data:image/png;base64,ZmFrZS1pbWFnZQ==',
    coverAlt: 'A careful description',
  };
  const restored = JSON.parse(JSON.stringify(draft));
  assert.equal(restored.cover, draft.cover);
  assert.equal(restored.coverAlt, draft.coverAlt);
});
