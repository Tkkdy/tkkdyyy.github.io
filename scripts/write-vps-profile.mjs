import { readFileSync, writeFileSync } from 'node:fs';
import { vpsIndexingProfile } from './vps-indexing-profile.mjs';
const profile = vpsIndexingProfile();
writeFileSync('dist/vps-build.json', JSON.stringify({schema: 1, site: new URL(process.env.SITE_URL).origin, indexingProfile: profile}), {flag: 'wx'});

// The standalone WebGL document is served from public/ rather than an Astro page.
const scenePath = 'meadow/refinement/light-studio/scene.html';
const sceneURL = new URL(scenePath, process.env.SITE_URL).href;
const metadata = [
  '<link rel="canonical" href="' + sceneURL + '">',
  '<meta property="og:url" content="' + sceneURL + '">',
  ...(profile === 'preview' ? ['<meta name="robots" content="noindex,nofollow">'] : []),
].join('');
const file = 'dist/' + scenePath;
const sceneHTML = readFileSync(file, 'utf8');
if (!sceneHTML.includes('</title>')) throw Error('Missing meadow scene head');
writeFileSync(file, sceneHTML.replace('</title>', '</title>' + metadata));
