import { statSync, realpathSync, readFileSync } from 'node:fs';
import { resolve, relative, extname, isAbsolute } from 'node:path';
import sharp from 'sharp';
import { publicAssetPath } from '../content-url.mjs';
export function localImageFile(imagePath, root = resolve('public')) {
  try {
    // Reject traversal before URL normalization, including percent-encoded segments.
    const decoded = decodeURIComponent(imagePath);
    if (decoded.includes('\\') || decoded.split('/').includes('..')) return null;
    const asset = publicAssetPath(imagePath);
    if (!asset || !['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'].includes(extname(asset).toLowerCase())) return null;
    const file = realpathSync(resolve(root, '.' + asset));
    const inside = relative(realpathSync(root), file);
    if (inside.startsWith('..') || isAbsolute(inside) || !statSync(file).isFile()) return null;
    return file;
  } catch { return null; }
}
export async function validateImageFile(imagePath, root) {
  const file = localImageFile(imagePath, root);
  if (!file) throw new Error(`[images] Missing or unsupported local image: ${imagePath}`);
  try {
    const image = sharp(readFileSync(file), { failOn: 'warning' });
    const metadata = await image.metadata();
    const allowed = { '.jpg': ['jpeg'], '.jpeg': ['jpeg'], '.png': ['png'], '.webp': ['webp'], '.avif': ['heif', 'avif'], '.gif': ['gif'] };
    if (!allowed[extname(file).toLowerCase()]?.includes(metadata.format)) throw new Error('Extension does not match decoded format');
    await image.stats(); // Decode pixel data, not just the header.
    return { width: metadata.width, height: metadata.height, format: metadata.format };
  } catch (error) { throw new Error(`[images] Cannot decode ${imagePath}: ${error.message}`); }
}
