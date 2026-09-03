// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Stage 4B：site 使用占位域名（正式部署前必须替换为真实域名，与 src/config.ts 同步）。
// sitemap filter 排除：搜索页与 404（无公开 SEO 价值）。
export default defineConfig({
  site: 'https://vdvxdv.example.com',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/search/') && !page.endsWith('/404.html'),
    }),
  ],
});
