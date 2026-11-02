// tkkdy 影像查询层（栏目页与单张详情页共用）

import { localImageFile, validateImageFile } from './image-file.mjs';
import { getCollection, type CollectionEntry } from 'astro:content';

export type ImageOrientation = 'landscape' | 'portrait' | 'square';
export type PublishedImage = CollectionEntry<'images'>;

/** 公开影像列表：status = published，按 publishedAt 倒序，slug 稳定排序 */
export async function getPublishedImages(): Promise<PublishedImage[]> {
  const entries = await getCollection('images');
  const published = entries.filter((entry) => entry.data.status === 'published');
  await Promise.all(published.map((entry) => validateImageFile(entry.data.image)));
  return published
    .sort((a, b) => {
      const byDate = b.data.publishedAt.getTime() - a.data.publishedAt.getTime();
      if (byDate !== 0) return byDate;
      return a.data.slug.localeCompare(b.data.slug);
    });
}

/**
 * 检查图片文件是否真实存在于 public/ 目录。
 * 只接受支持的本地文件；公开集合在构建时完整解码，缺失或损坏即失败。
 */
export function imageFileExists(imagePath: string): boolean {
  return localImageFile(imagePath) !== null;
}

/** 展示比例：优先使用内容字段，其次从 slug / 路径推断，默认 landscape */
export function getImageOrientation(data: PublishedImage['data']): ImageOrientation {
  if (data.orientation) return data.orientation;

  const hint = `${data.slug} ${data.image}`.toLowerCase();
  if (hint.includes('portrait') || hint.includes('vertical')) return 'portrait';
  if (hint.includes('square')) return 'square';
  return 'landscape';
}

export function getImageDisplayTitle(data: PublishedImage['data']): string {
  return data.title ?? data.caption ?? '影像';
}

export function getAdjacentImages(
  images: PublishedImage[],
  slug: string,
): { previous?: PublishedImage; next?: PublishedImage } {
  const index = images.findIndex((image) => image.data.slug === slug);
  if (index < 0) return {};
  return {
    previous: index > 0 ? images[index - 1] : undefined,
    next: index < images.length - 1 ? images[index + 1] : undefined,
  };
}
