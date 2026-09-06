import { getCollection } from 'astro:content';

export type TaxonomyKind = 'categories' | 'tags';

export interface TaxonomyStory {
  title: string;
  slug: string;
  href: string;
  type: '文章' | '随笔' | '碎片';
  publishedAt: Date;
  categories: string[];
  tags: string[];
}

export interface TaxonomyTerm {
  name: string;
  slug: string;
  stories: TaxonomyStory[];
}

/**
 * Taxonomy stays string-based in frontmatter. Slugs are derived in one place so
 * article templates, archive pages and the CMS never need a second registry.
 */
export function toTaxonomySlug(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('zh-CN')
    .replace(/\+/gu, '-plus-')
    .replace(/#/gu, '-sharp-')
    .replace(/&/gu, '-and-')
    .replace(/[\\/]+/gu, '-')
    .replace(/[\s_]+/gu, '-')
    .replace(/[^\p{Letter}\p{Number}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

export function taxonomyHref(kind: TaxonomyKind, value: string): string {
  return `${kind}/${encodeURIComponent(toTaxonomySlug(value))}/`;
}

export async function getPublishedTaxonomyStories(): Promise<TaxonomyStory[]> {
  const [articles, essays, fragments] = await Promise.all([
    getCollection('articles'),
    getCollection('essays'),
    getCollection('fragments'),
  ]);

  const stories: TaxonomyStory[] = [
    ...articles
      .filter(({ data }) => data.status === 'published')
      .map(({ data }) => ({
        title: data.title,
        slug: data.slug,
        href: `articles/${data.slug}/`,
        type: '文章' as const,
        publishedAt: data.publishedAt,
        categories: data.categories ?? [],
        tags: data.tags ?? [],
      })),
    ...essays
      .filter(({ data }) => data.status === 'published')
      .map(({ data }) => ({
        title: data.title,
        slug: data.slug,
        href: `essays/${data.slug}/`,
        type: '随笔' as const,
        publishedAt: data.publishedAt,
        categories: data.categories ?? [],
        tags: data.tags ?? [],
      })),
    ...fragments
      .filter(({ data }) => data.status === 'published')
      .map(({ data }) => ({
        title: `碎片 · ${data.publishedAt.toISOString().slice(0, 10)}`,
        slug: data.slug,
        href: 'fragments/',
        type: '碎片' as const,
        publishedAt: data.publishedAt,
        categories: [],
        tags: data.tags ?? [],
      })),
  ];

  return stories.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

export async function getTaxonomyTerms(kind: TaxonomyKind): Promise<TaxonomyTerm[]> {
  const stories = await getPublishedTaxonomyStories();
  const terms = new Map<string, TaxonomyTerm>();

  for (const story of stories) {
    const storyTerms = new Map<string, string>();

    for (const name of story[kind]) {
      const slug = toTaxonomySlug(name);
      if (!slug) continue;
      if (!storyTerms.has(slug)) storyTerms.set(slug, name);
    }

    for (const [slug, name] of storyTerms) {
      const existing = terms.get(slug);
      if (existing) {
        existing.stories.push(story);
      } else {
        terms.set(slug, { name, slug, stories: [story] });
      }
    }
  }

  return [...terms.values()].sort((a, b) =>
    b.stories.length - a.stories.length || a.name.localeCompare(b.name, 'zh-CN'),
  );
}
