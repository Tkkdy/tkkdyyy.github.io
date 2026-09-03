// RSS Feed /rss.xml
// V0.1 Feed 内容：Articles + Essays（published only，按 publishedAt 倒序）。
// 摘要使用 frontmatter（description / summary），不使用 body，
// 避免 Development fixture 测试内容进入社交预览。
// Fragments / Projects / Images / About 默认不进入 Feed（保持内容质量与长度稳定）。

import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedArticles } from '../lib/content/articles';
import { getPublishedEssays } from '../lib/content/essays';
import { SITE } from '../config';
import { withBase } from '../lib/site-url';

export async function GET(_context: APIContext) {
  const [articles, essays] = await Promise.all([
    getPublishedArticles(),
    getPublishedEssays(),
  ]);

  const articleItems = articles.map((article) => ({
    title: article.data.title,
    description: article.data.description,
    pubDate: article.data.publishedAt,
    link: withBase(`articles/${article.data.slug}/`),
  }));

  const essayItems = essays.map((essay) => ({
    title: essay.data.title,
    description: essay.data.summary ?? undefined,
    pubDate: essay.data.publishedAt,
    link: withBase(`essays/${essay.data.slug}/`),
  }));

  const items = [...articleItems, ...essayItems].sort(
    (a, b) => b.pubDate.getTime() - a.pubDate.getTime(),
  );

  return rss({
    title: `${SITE.name} — 文章与随笔`,
    description: SITE.description,
    site: SITE.url,
    items,
    customData: '<language>zh-cn</language>',
  });
}
