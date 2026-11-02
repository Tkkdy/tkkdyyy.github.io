import sharp from 'sharp';
import type { GetStaticPaths, APIRoute } from 'astro';
import { getWindowSources, WINDOW_WIDTHS } from '../../lib/content/window';
export const getStaticPaths: GetStaticPaths = async () => (await getWindowSources()).flatMap(({ file, hash }) => WINDOW_WIDTHS.map(width => ({ params: { asset: `${hash}-${width}` }, props: { file, width } })));
export const GET: APIRoute = async ({ props }) => {
  // Re-encoding strips EXIF/GPS/device metadata. Never copy the original into window assets.
  const bytes = await sharp(props.file).rotate().resize({ width: props.width }).webp({ quality: 82 }).toBuffer();
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/webp' } });
};
