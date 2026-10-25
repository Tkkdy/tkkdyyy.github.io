// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GitHub Pages Project Site：仓库名不是 <username>.github.io，必须保留 base path。
// sitemap filter 排除：搜索页、404 与后台路由。
export default defineConfig({
  site: 'https://tkkdy.github.io',
  base: '/tkkdyyy.github.io',
  trailingSlash: 'always',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/search/') && !page.endsWith('/404.html') && !/\/admin(?:\/|$)/.test(new URL(page).pathname),
    }),
  ],
});
