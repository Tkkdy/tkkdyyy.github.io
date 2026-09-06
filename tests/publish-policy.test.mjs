import test from 'node:test';
import assert from 'node:assert/strict';
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
  assert.ok(errors.some((error) => error.includes('Published')));
  assert.ok(errors.some((error) => error.includes('alt text')));
});

test('published articles require a positive stable publish number', () => {
  const missing = validateStory({ ...validStory, type: 'Article' });
  const accepted = validateStory({ ...validStory, type: 'Article', publishNumber: 7 });
  assert.ok(missing.some((error) => error.includes('Article number')));
  assert.deepEqual(accepted, []);
});

test('an existing story cannot silently change collection type', () => {
  const errors = validateStory({ ...validStory, sourcePath: 'src/content/articles/original.md' });
  assert.ok(errors.some((error) => error.includes('Changing the type')));
});
