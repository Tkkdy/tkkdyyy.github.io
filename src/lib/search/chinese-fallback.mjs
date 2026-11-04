// Pagefind 1.5 uses different Chinese segmenters at build and query time.
// E.g. the index keeps 云端, while Intl.Segmenter may query 云 AND 端.
// Complete plain-keyword searches using Pagefind's own candidates, even when
// the original search found only some matching pages. Preserve its ranking
// and leave English, single-character and explicit query syntax unchanged.
export async function searchWithChineseFallback(pagefind, query) {
  const original = await pagefind.search(query);
  if (!/^[\p{Script=Han}\p{Script=Latin}\p{Number}\s]+$/u.test(query) ||
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
  const matches = [...original.results];
  const seen = new Set(original.results.map(result => result.id));
  // Bound concurrent fragment downloads, preserve Pagefind's candidate ranking
  // and reuse loaded fragments when the UI renders the accepted results.
  for (let offset = 0; offset < candidates.results.length; offset += 4) {
    const batch = candidates.results.slice(offset, offset + 4);
    const data = await Promise.all(batch.map(result => result.data()));
    for (let i = 0; i < batch.length; i++) {
      const text = `${data[i].meta?.title ?? ''} ${data[i].content}`.toLowerCase();
      if (!seen.has(batch[i].id) && terms.every(term => text.includes(term))) {
        seen.add(batch[i].id);
        matches.push({ ...batch[i], data: async () => data[i] });
      }
    }
  }
  if (matches.length === original.results.length) return original;
  return { ...original, results: matches, unfilteredResultCount: matches.length };
}
