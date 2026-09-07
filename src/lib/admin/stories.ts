import { getCollection } from 'astro:content';

export type EditorialStory = {
  id: string;
  title: string;
  deck: string;
  body: string;
  type: 'Article' | 'Essay' | 'Fragment';
  status: 'draft' | 'published' | 'archived';
  slug: string;
  categories: string[];
  tags: string[];
  publishedAt: string;
  updatedAt: string;
  showOnHomepage: boolean;
  featured: boolean;
  cover: string;
  coverAlt: string;
  publishNumber?: number;
  sourcePath: string;
};

export type EditorialTaxonomy = {
  categories: string[];
  tags: string[];
};

function dateValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getEditorialStories(): Promise<EditorialStory[]> {
  const [articles, essays, fragments] = await Promise.all([
    getCollection('articles'),
    getCollection('essays'),
    getCollection('fragments'),
  ]);

  const stories: EditorialStory[] = [
    ...articles.map((entry) => ({
      id: `article-${entry.data.slug}`,
      title: entry.data.title,
      deck: entry.data.description,
      body: entry.body ?? '',
      type: 'Article' as const,
      status: entry.data.status,
      slug: entry.data.slug,
      categories: entry.data.categories ?? [],
      tags: entry.data.tags ?? [],
      publishedAt: dateValue(entry.data.publishedAt),
      updatedAt: dateValue(entry.data.updatedAt ?? entry.data.publishedAt),
      showOnHomepage: entry.data.homepage?.show ?? false,
      featured: entry.data.featured ?? false,
      cover: entry.data.cover ?? '',
      coverAlt: entry.data.coverAlt ?? '',
      publishNumber: entry.data.publishNumber,
      sourcePath: `src/content/articles/${entry.id}.md`,
    })),
    ...essays.map((entry) => ({
      id: `essay-${entry.data.slug}`,
      title: entry.data.title,
      deck: entry.data.summary ?? '',
      body: entry.body ?? '',
      type: 'Essay' as const,
      status: entry.data.status,
      slug: entry.data.slug,
      categories: entry.data.categories ?? [],
      tags: entry.data.tags ?? [],
      publishedAt: dateValue(entry.data.publishedAt),
      updatedAt: dateValue(entry.data.publishedAt),
      showOnHomepage: entry.data.homepage?.show ?? false,
      featured: entry.data.featured ?? false,
      cover: entry.data.cover ?? '',
      coverAlt: entry.data.coverAlt ?? '',
      sourcePath: `src/content/essays/${entry.id}.md`,
    })),
    ...fragments.map((entry) => ({
      id: `fragment-${entry.data.slug}`,
      title: entry.body?.trim().split('\n')[0]?.slice(0, 64) || '无标题碎片',
      deck: '',
      body: entry.body ?? '',
      type: 'Fragment' as const,
      status: entry.data.status,
      slug: entry.data.slug,
      categories: [],
      tags: entry.data.tags ?? [],
      publishedAt: dateValue(entry.data.publishedAt),
      updatedAt: dateValue(entry.data.publishedAt),
      showOnHomepage: entry.data.homepage?.show ?? false,
      featured: false,
      cover: entry.data.image ?? '',
      coverAlt: entry.data.imageAlt ?? '',
      sourcePath: `src/content/fragments/${entry.id}.md`,
    })),
  ];

  return stories.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getEditorialTaxonomy(stories: EditorialStory[]): EditorialTaxonomy {
  return {
    categories: [...new Set(stories.flatMap((story) => story.categories))].sort(),
    tags: [...new Set(stories.flatMap((story) => story.tags))].sort(),
  };
}

export function emptyEditorialStory(): EditorialStory {
  const today = new Date().toISOString().slice(0, 10);

  return {
    id: 'new-story',
    title: '',
    deck: '',
    body: '',
    type: 'Essay',
    status: 'draft',
    slug: '',
    categories: [],
    tags: [],
    publishedAt: today,
    updatedAt: today,
    showOnHomepage: false,
    featured: false,
    cover: '',
    coverAlt: '',
    sourcePath: '',
  };
}
