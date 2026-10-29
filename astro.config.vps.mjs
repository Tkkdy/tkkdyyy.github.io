// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { vpsIndexingProfile } from './scripts/vps-indexing-profile.mjs';
const profile = vpsIndexingProfile();

// VPS 按域名根路径部署；仅从构建进程读取公开站点地址。
const rawSite = process.env.SITE_URL;
let site;
try {
  if (!rawSite || rawSite !== rawSite.trim()) throw new Error();
  site = new URL(rawSite);
  if (
    !['https:', 'http:'].includes(site.protocol) ||
    !site.hostname ||
    site.username || site.password ||
    site.pathname !== '/' || site.search || site.hash
  ) throw new Error();
} catch {
  throw new Error('[build:vps] SITE_URL must be an absolute HTTP(S) root URL without credentials, query, or fragment.');
}

export default defineConfig({
  site: site.origin,
  trailingSlash: 'always',
  output: 'static',
  vite: { define: { 'import.meta.env.VPS_PREVIEW': JSON.stringify(profile === 'preview') } },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/search/') && !page.endsWith('/404.html') && !/\/admin(?:\/|$)/.test(new URL(page).pathname),
    }),
  ],
});
