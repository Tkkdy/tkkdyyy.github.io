import { parse, parseFragment, serialize } from 'parse5';
import { rewriteContentUrl, rewriteSrcset } from '../content-url.mjs';
// URL normalization only, NOT a sanitizer. Admin credential isolation is a separate security layer.
export function normalizeHtmlUrls(html, { base = '/', document = false } = {}) {
  const root = document ? parse(html) : parseFragment(html); let changed = 0;
  function visit(node) {
    const canonical = node.tagName === 'link' && node.attrs?.some(a => a.name === 'rel' && a.value.split(/\s+/).includes('canonical'));
    for (const attr of node.attrs ?? []) {
      if (!['src', 'href', 'poster', 'srcset'].includes(attr.name) || (canonical && attr.name === 'href')) continue;
      const next = attr.name === 'srcset' ? rewriteSrcset(attr.value, { base }) : rewriteContentUrl(attr.value, { base });
      if (next !== attr.value) { attr.value = next; changed++; }
    }
    for (const child of node.childNodes ?? []) visit(child);
    if (node.content) visit(node.content);
  }
  visit(root);
  return { html: changed ? serialize(root) : html, changed };
}
