import { parseDocument } from 'yaml';

const STUDIO_FIELDS = {
  Article: new Set([
    'title', 'slug', 'description', 'publishedAt', 'updatedAt', 'status', 'publishNumber',
    'tags', 'categories', 'cover', 'coverAlt', 'featured', 'homepage',
  ]),
  Essay: new Set([
    'title', 'slug', 'summary', 'publishedAt', 'status', 'tags', 'categories', 'cover',
    'coverAlt', 'featured', 'homepage',
  ]),
  Fragment: new Set([
    'slug', 'publishedAt', 'status', 'tags', 'image', 'imageAlt', 'homepage',
  ]),
};

export function splitContentFile(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) return { frontmatter: '', body: source };
  return { frontmatter: match[1], body: match[2].replace(/^\r?\n/, '') };
}

/** Preserve unmanaged homepage keys (e.g. order) while updating show. */
export function mergeHomepageShow(existingHomepage, show) {
  const base = existingHomepage && typeof existingHomepage === 'object' && !Array.isArray(existingHomepage)
    ? existingHomepage
    : {};
  return { ...base, show: Boolean(show) };
}

function readHomepageFromDocument(document) {
  const node = document.get('homepage');
  if (!node || typeof node !== 'object') return {};
  if (typeof node.toJSON === 'function') {
    const value = node.toJSON();
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }
  return { ...node };
}

export function mergeStudioFrontmatter(existingSource, storyType, studioFields, nextBody) {
  const ownedFields = STUDIO_FIELDS[storyType];
  if (!ownedFields) throw new Error(`不支持的内容类型：${storyType}`);

  const { frontmatter, body } = splitContentFile(existingSource);
  const document = parseDocument(frontmatter || '{}');
  if (document.errors.length) throw document.errors[0];

  for (const [key, value] of Object.entries(studioFields)) {
    if (!ownedFields.has(key)) continue;
    if (key === 'homepage') {
      const show = value && typeof value === 'object' ? value.show : value;
      document.set(key, mergeHomepageShow(readHomepageFromDocument(document), show));
      continue;
    }
    if (value === undefined || value === '' || value === false && ['featured'].includes(key)) {
      document.delete(key);
    } else {
      document.set(key, value);
    }
  }

  const yaml = document.toString({ lineWidth: 0 }).trimEnd();
  const resolvedBody = nextBody === undefined ? body : nextBody;
  return `---\n${yaml}\n---\n\n${resolvedBody.replace(/^\s+/, '')}`;
}

export function studioOwnedFields(storyType) {
  return [...(STUDIO_FIELDS[storyType] ?? [])];
}
