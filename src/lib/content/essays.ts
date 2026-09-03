// VDVXDV 随笔查询层（列表页与详情页共用）

import { getCollection, type CollectionEntry } from 'astro:content';

/** 公开随笔列表：status = published，按 publishedAt 倒序 */
export async function getPublishedEssays(): Promise<CollectionEntry<'essays'>[]> {
  const entries = await getCollection('essays');
  return entries
    .filter((entry) => entry.data.status === 'published')
    .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
}
