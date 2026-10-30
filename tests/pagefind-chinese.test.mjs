import test from 'node:test';
import assert from 'node:assert/strict';
import { searchWithChineseFallback } from '../src/lib/search/chinese-fallback.mjs';

const empty = () => ({ results: [], unfilteredResultCount: 0 });
const entry = (id, content) => ({ id, data: async () => ({ content, meta: { title: id } }) });

test('Chinese zero-result query recovers full keywords, not separated characters', async () => {
  const calls = [];
  const original = empty();
  const pagefind = { search: async query => {
    calls.push(query);
    return query === '云' ? { results: [
      entry('wrong', '云计算与端口'),
      entry('right', '云端一键发布验收 Development fixture'),
      entry('wrong-other-term', '云端测试'),
    ] } : original;
  } };
  const result = await searchWithChineseFallback(pagefind, '云端 Development');
  assert.deepEqual(calls, ['云端 Development', '云']);
  assert.deepEqual(result.results.map(x => x.id), ['right']);
  assert.equal(result.unfilteredResultCount, 1);
  assert.match((await result.results[0].data()).content, /云端一键发布验收/);
  assert.equal(original.results.length, 0, 'do not mutate the original response');
});

test('successful Chinese and English searches retain the exact Pagefind response', async () => {
  for (const query of ['上下文', 'Development']) {
    const response = { results: [entry('original', 'original')], unfilteredResultCount: 1 };
    let calls = 0;
    assert.equal(await searchWithChineseFallback({ search: async () => { calls++; return response; } }, query), response);
    assert.equal(calls, 1);
  }
});

test('English, single-character and quoted searches do not trigger fallback', async () => {
  for (const query of ['missing English', '云', '"云端"', '云端 OR 发布', '云端 -发布']) {
    // Explicit syntax must be left to Pagefind, including a leading minus.
    const response = empty();
    let calls = 0;
    const result = await searchWithChineseFallback({ search: async () => { calls++; return response; } }, query);
    assert.equal(result, response, query);
    assert.equal(calls, 1, query);
  }
});

test('candidate failures remain errors instead of false zero-result success', async () => {
  await assert.rejects(searchWithChineseFallback({ search: async query => {
    if (query === '云端') return empty();
    return { results: [{ data: async () => { throw Error('fragment unavailable'); } }] };
  } }, '云端'), /fragment unavailable/);
});
