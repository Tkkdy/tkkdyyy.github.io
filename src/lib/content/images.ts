// VDVXDV 影像查询层（栏目页与单张详情页共用）

import { existsSync } from 'node:fs';
import { getCollection, type CollectionEntry } from 'astro:content';

export type ImageOrientation = 'landscape' | 'portrait' | 'square';
export type PublishedImage = CollectionEntry<'images'>;

/** 公开影像列表：status = published，按 publishedAt 倒序，slug 稳定排序 */
export async function getPublishedImages(): Promise<PublishedImage[]> {
  const entries = await getCollection('images');
  return entries
    .filter((entry) => entry.data.status === 'published')
    .sort((a, b) => {
      const byDate = b.data.publishedAt.getTime() - a.data.publishedAt.getTime();
      if (byDate !== 0) return byDate;
      return a.data.slug.localeCompare(b.data.slug);
    });
}

/**
 * 检查图片文件是否真实存在于 public/ 目录。
 * 当前 image 条目指向的 /images/photos/*.jpg 尚不存在（Stage 2 fixture），
 * 文件不存在时页面保留 Placeholder，不生成 broken <img>。
 */
export function imageFileExists(imagePath: string): boolean {
  const publicFile = `./public${imagePath.startsWith('/') ? imagePath : `/${imagePath}`}`;
  try {
    return existsSync(publicFile);
  } catch {
    return false;
  }
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
