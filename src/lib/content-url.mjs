// Historical content URLs are interpreted at render/build time; source Markdown stays unchanged.
export const LEGACY_PAGES_ORIGIN = 'https://tkkdy.github.io';
export const LEGACY_PAGES_BASE = '/tkkdyyy.github.io';
function normalizedBase(base = '/') { return '/' + base.replace(/^\/+|\/+$/g, '') + (base.replace(/\//g, '') ? '/' : ''); }
function legacyPath(value) {
  if (/^(?:https?:)?\/\//i.test(value)) {
    try {
      const url = new URL(value, LEGACY_PAGES_ORIGIN);
      if (url.origin !== LEGACY_PAGES_ORIGIN || !(url.pathname === LEGACY_PAGES_BASE || url.pathname.startsWith(LEGACY_PAGES_BASE + '/'))) return null;
      return url.pathname.slice(LEGACY_PAGES_BASE.length) + url.search + url.hash || '/';
    } catch { return null; }
  }
  return value === LEGACY_PAGES_BASE || value.startsWith(LEGACY_PAGES_BASE + '/') || value.startsWith(LEGACY_PAGES_BASE + '?') || value.startsWith(LEGACY_PAGES_BASE + '#')
    ? value.slice(LEGACY_PAGES_BASE.length) || '/' : undefined;
}
export function toDeploymentUrl(value = '', { base = '/' } = {}) {
  if (typeof value !== 'string') throw new TypeError('Content URL must be a string');
  if (/^[#?]/.test(value)) return value;
  const historical = legacyPath(value);
  if (historical === null || (/^[a-z][a-z0-9+.-]*:/i.test(value) && historical === undefined)) return value;
  const path = historical ?? value;
  base = normalizedBase(base);
  if (base !== '/' && (path === base.slice(0, -1) || path.startsWith(base))) return path;
  return base + path.replace(/^\/+/, '');
}
export function rewriteContentUrl(value, options = {}) {
  return value.startsWith('/') || legacyPath(value) !== undefined ? toDeploymentUrl(value, options) : value;
}
export function publicAssetPath(value) {
  const url = toDeploymentUrl(value, { base: '/' });
  if (!url.startsWith('/') || url.startsWith('//')) return null;
  return decodeURIComponent(new URL(url, 'https://asset.invalid').pathname);
}
export function rewriteSrcset(value, options = {}) {
  const candidates = []; let i = 0;
  while (i < value.length) {
    while (i < value.length && /[\s,]/.test(value[i])) i++;
    if (i >= value.length) break;
    const start = i; while (i < value.length && !/\s/.test(value[i])) i++;
    let url = value.slice(start, i), descriptor = '';
    if (url.endsWith(',')) url = url.replace(/,+$/, '');
    else {
      const d = i; let depth = 0;
      while (i < value.length) {
        if (value[i] === '(') depth++;
        if (value[i] === ')') depth--;
        if (value[i] === ',' && depth === 0) break;
        i++;
      }
      descriptor = value.slice(d, i).trim(); if (value[i] === ',') i++;
    }
    candidates.push(rewriteContentUrl(url, options) + (descriptor ? ' ' + descriptor : ''));
  }
  return candidates.join(', ');
}
