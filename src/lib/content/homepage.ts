// VDVXDV 首页内容查询层
//
// 职责（CONTENT_MODEL §9）：
// - 所有内容类型统一只取 status = published（draft / archived 排除）；
// - 只取 homepage.show = true 的内容；
// - 同类型内按 homepage.order 排序（缺省排最后，再按发布日期倒序）；
// - 构建期检查同类型 homepage.order 重复。
//
// 说明：project 的 projectStatus（developing 等）是项目生命周期状态，
// 与内容发布状态 status（draft / published / archived）相互独立；
// 首页显示哪种状态由组件决定，查询层只按发布状态过滤。

import { getCollection, type CollectionEntry } from 'astro:content';

type HomepageEntry = CollectionEntry<'articles'> | CollectionEntry<'essays'> | CollectionEntry<'fragments'> | CollectionEntry<'projects'> | CollectionEntry<'images'>;

/** 内容发布状态过滤：只有 published 参与首页策展（draft / archived 排除） */
function isPublished(entry: HomepageEntry): boolean {
  return entry.data.status === 'published';
}

/** 首页策展开关：homepage.show */
function isShownOnHomepage(entry: HomepageEntry): boolean {
  return entry.data.homepage?.show === true;
}

/** 同类型内部排序：homepage.order 升序，缺省排最后；再按发布日期倒序 */
function byHomepageOrder(a: HomepageEntry, b: HomepageEntry): number {
  const orderA = a.data.homepage?.order ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.data.homepage?.order ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;

  // project 没有 publishedAt 字段（CONTENT_MODEL §7），其他类型都有
  const dateA = 'publishedAt' in a.data ? a.data.publishedAt.getTime() : 0;
  const dateB = 'publishedAt' in b.data ? b.data.publishedAt.getTime() : 0;
  return dateB - dateA;
}

/**
 * 构建期检查：同类型内 homepage.order 不允许重复。
 * 重复时抛出明确错误，让 build 失败而不是默默依赖文件系统顺序。
 */
function assertUniqueHomepageOrder(entries: HomepageEntry[], label: string): void {
  const seen = new Map<number, string>();
  for (const entry of entries) {
    const order = entry.data.homepage?.order;
    if (order === undefined) continue;
    if (seen.has(order)) {
      throw new Error(
        `[homepage] ${label} 的 homepage.order 冲突：` +
          `${seen.get(order)} 与 ${entry.id} 的 order 都是 ${order}，请修改其中一个。`,
      );
    }
    seen.set(order, entry.id);
  }
}

// ---- 各类型首页查询 ----

export async function getHomepageArticles(): Promise<CollectionEntry<'articles'>[]> {
  const entries = (await getCollection('articles'))
    .filter((e) => isPublished(e) && isShownOnHomepage(e))
    .sort(byHomepageOrder);
  assertUniqueHomepageOrder(entries, 'articles');
  return entries;
}

export async function getHomepageEssays(): Promise<CollectionEntry<'essays'>[]> {
  const entries = (await getCollection('essays'))
    .filter((e) => isPublished(e) && isShownOnHomepage(e))
    .sort(byHomepageOrder);
  assertUniqueHomepageOrder(entries, 'essays');
  return entries;
}

export async function getHomepageFragments(): Promise<CollectionEntry<'fragments'>[]> {
  const entries = (await getCollection('fragments'))
    .filter((e) => isPublished(e) && isShownOnHomepage(e))
    .sort(byHomepageOrder);
  assertUniqueHomepageOrder(entries, 'fragments');
  return entries;
}

export async function getHomepageImages(): Promise<CollectionEntry<'images'>[]> {
  const entries = (await getCollection('images'))
    .filter((e) => isPublished(e) && isShownOnHomepage(e))
    .sort(byHomepageOrder);
  assertUniqueHomepageOrder(entries, 'images');
  return entries;
}

/** 项目与其他内容类型一样按发布状态过滤（projectStatus 是项目生命周期状态，不影响首页筛选） */
export async function getHomepageProjects(): Promise<CollectionEntry<'projects'>[]> {
  const entries = (await getCollection('projects'))
    .filter((e) => isPublished(e) && isShownOnHomepage(e))
    .sort(byHomepageOrder);
  assertUniqueHomepageOrder(entries, 'projects');
  return entries;
}

/** 首页一次性取回全部策展内容 */
export async function getHomepageContent() {
  const [articles, essays, fragments, images, projects] = await Promise.all([
    getHomepageArticles(),
    getHomepageEssays(),
    getHomepageFragments(),
    getHomepageImages(),
    getHomepageProjects(),
  ]);
  return { articles, essays, fragments, images, projects };
}

/** 日期显示：YYYY-MM-DD（本地时区），与 CONTENT_MODEL 日期格式一致 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
