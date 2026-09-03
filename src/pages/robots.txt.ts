// robots.txt（动态生成：域名统一来自 src/config.ts，部署时只改一处）

import type { APIContext } from 'astro';
import { SITE } from '../config';

export async function GET(_context: APIContext) {
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${SITE.url}/sitemap-index.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
