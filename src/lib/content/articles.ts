// VDVXDV 文章查询层（列表页与详情页共用）
//
// 职责：
// - 只返回 status = published 的文章（draft 不公开、archived 不进主列表）；
// - 按 publishedAt 从新到旧排序；
// - 为详情页 getStaticPaths 提供数据。

import { getCollection, type CollectionEntry } from 'astro:content';

function assertUniquePublishNumbers(entries: CollectionEntry<'articles'>[]): void {
  const owners = new Map<number, string>();

  for (const entry of entries) {
    const publishNumber = entry.data.publishNumber;

    if (publishNumber === undefined) {
      throw new Error(`Published article "${entry.id}" is missing publishNumber`);
    }

    const existingOwner = owners.get(publishNumber);
    if (existingOwner) {
      throw new Error(
        `Duplicate article publishNumber ${publishNumber}: "${existingOwner}" and "${entry.id}"`,
      );
    }

    owners.set(publishNumber, entry.id);
  }
}

const articleDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatArticleDate(date: Date): string {
  return articleDateFormatter.format(date);
}

export function formatPublishNumber(publishNumber: number): string {
  return `No. ${String(publishNumber).padStart(3, '0')}`;
}

/** 公开文章列表：published 且按发布日期倒序 */
export async function getPublishedArticles(): Promise<CollectionEntry<'articles'>[]> {
  const entries = await getCollection('articles');
  const publishedEntries = entries.filter((entry) => entry.data.status === 'published');

  assertUniquePublishNumbers(publishedEntries);

  return publishedEntries.sort(
    (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
  );
}
