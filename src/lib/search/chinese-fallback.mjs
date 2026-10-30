// Pagefind 1.5 uses different Chinese segmenters at build and query time.
// E.g. the index keeps 云端, while Intl.Segmenter may query 云 AND 端.
// Only recover empty plain-keyword searches, using Pagefind's own candidates.
// Do not change Intl, the index language, successful searches or quoted syntax.
export async function searchWithChineseFallback(pagefind, query) {
  const original = await pagefind.search(query);
  if (original.results.length ||
      !/^[\p{Script=Han}\p{Script=Latin}\p{Number}\s]+$/u.test(query) ||
      /(?:^|\s)(?:OR|AND|NOT)(?:\s|$)/u.test(query)) {
    return original;
  }
  const chinese = query.match(/\p{Script=Han}{2,}/u)?.[0];
  if (!chinese) return original;

  // A single-character prefix survives query segmentation. Pagefind can match
  // it to an indexed whole word; the full keyword check below rejects noise
  // such as 云计算 ... 端口 for 云端, or pages missing another query term.
  const candidates = await pagefind.search(Array.from(chinese)[0]);
  const terms = query.trim().toLowerCase().split(/\s+/u);
  const matches = [];
  // Bound concurrent fragment downloads, preserve Pagefind's candidate ranking
  // and reuse loaded fragments when the UI renders the accepted results.
  for (let offset = 0; offset < candidates.results.length; offset += 4) {
    const batch = candidates.results.slice(offset, offset + 4);
    const data = await Promise.all(batch.map(result => result.data()));
    for (let i = 0; i < batch.length; i++) {
      const text = `${data[i].meta?.title ?? ''} ${data[i].content}`.toLowerCase();
      if (terms.every(term => text.includes(term))) {
        matches.push({ ...batch[i], data: async () => data[i] });
      }
    }
  }
  return { ...original, results: matches, unfilteredResultCount: matches.length };
}
