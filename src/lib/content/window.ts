import { getCollection } from 'astro:content';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateImageFile, localImageFile } from './image-file.mjs';
import { withBase } from '../site-url';
import { formatDate } from './homepage';
export type WindowPhoto = { id: string; src: string; srcset: string; href: string; alt: string; date: string; location: string; note: string; width: number; height: number; timeOfDay: string[]; seasons: string[] };
export const WINDOW_WIDTHS = [640, 1200, 1800];
let cached: Promise<{ photo: WindowPhoto; file: string; hash: string }[]> | undefined;
export function getWindowSources() {
  return cached ??= (async () => {
    const entries = await getCollection('images');
    const sources = [];
    for (const entry of entries) {
      const data = entry.data;
      if (data.status !== 'published' || data.window?.enabled !== true) continue;
      try {
        const file = localImageFile(data.image);
        if (!file) throw Error('not a local raster image');
        const { width, height } = await validateImageFile(data.image);
        const hash = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 20);
        const src = (width: number) => withBase(`window/${hash}-${width}.webp`);
        sources.push({ file, hash, photo: { id: data.slug, href: withBase(`images/${data.slug}/`), src: src(1200), srcset: WINDOW_WIDTHS.map(w => `${src(w)} ${w}w`).join(', '), alt: data.alt, date: data.capturedAt ? formatDate(data.capturedAt) : '', location: data.location || '', note: data.window.note || data.caption || '', width, height, timeOfDay: data.window.timeOfDay || [], seasons: data.window.seasons || [] } });
      } catch { console.warn(`[window] Excluded missing or invalid image: ${data.slug}`); }
    }
    return sources;
  })();
}
export async function getWindowPhotos(): Promise<WindowPhoto[]> { return (await getWindowSources()).map(source => source.photo); }
