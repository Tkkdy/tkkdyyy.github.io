// VDVXDV 碎片查询层（时间流页使用）
//
// 碎片是短内容（CONTENT_MODEL §6），没有独立详情页：
// 时间流页面直接展示 body，不强行制造详情页。

import { getCollection, type CollectionEntry } from 'astro:content';

/** 公开碎片时间流：status = published，按 publishedAt 倒序 */
export async function getPublishedFragments(): Promise<CollectionEntry<'fragments'>[]> {
  const entries = await getCollection('fragments');
  return entries
    .filter((entry) => entry.data.status === 'published')
    .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
}
