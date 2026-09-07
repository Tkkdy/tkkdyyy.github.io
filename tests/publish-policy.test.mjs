import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { mergeStudioFrontmatter, splitContentFile } from '../src/lib/admin/frontmatter.mjs';
import { assertNoDestinationCollision } from '../src/lib/admin/publish-story.mjs';
import { validateStory } from '../src/lib/admin/validate-story.mjs';

const validStory = {
  title: 'A publishable story',
  type: 'Essay',
  status: 'published',
  slug: 'a-publishable-story',
  publishedAt: '2026-09-06',
  body: 'Canonical Markdown body.',
  cover: '',
  coverAlt: '',
};

test('publish validation accepts a complete published essay', () => {
  assert.deepEqual(validateStory(validStory), []);
});

test('publish validation blocks draft status and missing cover alt', () => {
  const errors = validateStory({ ...validStory, status: 'draft', cover: 'data:image/png;base64,ZmFrZQ==' });
  assert.ok(errors.some((error) => error.includes('已发布')));
  assert.ok(errors.some((error) => error.includes('Alt 文本')));
});

test('published articles require a positive stable publish number', () => {
  const missing = validateStory({ ...validStory, type: 'Article', deck: 'A deck' });
  const accepted = validateStory({ ...validStory, type: 'Article', deck: 'A deck', publishNumber: 7 });
  assert.ok(missing.some((error) => error.includes('文章编号')));
  assert.deepEqual(accepted, []);
});

test('published articles require a non-empty deck/description', () => {
  const missing = validateStory({ ...validStory, type: 'Article', publishNumber: 7 });
  const empty = validateStory({ ...validStory, type: 'Article', publishNumber: 7, deck: '   ' });
  const accepted = validateStory({ ...validStory, type: 'Article', publishNumber: 7, deck: 'A deck' });
  assert.ok(missing.some((error) => error.includes('副标题 / 描述')));
  assert.ok(empty.some((error) => error.includes('副标题 / 描述')));
  assert.deepEqual(accepted, []);
});

test('an existing story cannot silently change collection type', () => {
  const errors = validateStory({ ...validStory, sourcePath: 'src/content/articles/original.md' });
  assert.ok(errors.some((error) => error.includes('不能更改类型')));
});

test('homepage merge preserves order when show flips', () => {
  const existing = `---\ntitle: Story\nslug: story\nhomepage:\n  show: true\n  order: 7\n---\n\nBody.\n`;
  for (const show of [false, true]) {
    const merged = mergeStudioFrontmatter(existing, 'Article', {
      homepage: { show },
    });
    const data = parse(splitContentFile(merged).frontmatter);
    assert.equal(data.homepage.show, show);
    assert.equal(data.homepage.order, 7);
  }
});

test('slug destination collision rejects rename onto existing path', () => {
  assert.throws(
    () => assertNoDestinationCollision({
      sourcePath: 'src/content/articles/old-slug.md',
      destinationPath: 'src/content/articles/taken-slug.md',
      destinationExists: true,
    }),
    /已经存在其他内容/,
  );
  assert.doesNotThrow(() => assertNoDestinationCollision({
    sourcePath: 'src/content/articles/old-slug.md',
    destinationPath: 'src/content/articles/new-slug.md',
    destinationExists: false,
  }));
  assert.doesNotThrow(() => assertNoDestinationCollision({
    sourcePath: 'src/content/articles/same.md',
    destinationPath: 'src/content/articles/same.md',
    destinationExists: true,
  }));
});
