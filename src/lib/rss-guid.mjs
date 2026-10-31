// Keep already published VPS item identities stable when navigation links change.
export function rssGuidData(path, preview, site, baseline) {
  const guid = baseline[path];
  if (preview || !guid || site !== 'https://tkkdy.me') return undefined;
  const escaped = guid.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  return `<guid isPermaLink="true">${escaped}</guid>`;
}
