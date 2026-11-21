import { lstatSync, readdirSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { normalizeHtmlUrls } from '../src/lib/content/normalize-html.mjs';
const target = process.argv[2];
if (!['pages', 'vps'].includes(target) || process.argv.length !== 3) throw Error('Expected exactly one target: pages or vps');
const root = resolve('dist');
if (lstatSync(root).isSymbolicLink() || realpathSync(root) !== root) throw Error('Refusing linked dist');
let htmlFiles = 0, rewrittenAttributes = 0;
function visit(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name), info = lstatSync(path);
    if (info.isSymbolicLink()) throw Error('Refusing link in output');
    if (info.isDirectory()) visit(path);
    else if (info.isFile() && name.endsWith('.html')) {
      const result = normalizeHtmlUrls(readFileSync(path, 'utf8'), { base: target === 'pages' ? '/tkkdyyy.github.io/' : '/', document: true });
      htmlFiles++; rewrittenAttributes += result.changed;
      if (result.changed) writeFileSync(path, result.html);
    } else if (!info.isFile()) throw Error('Refusing special file');
  }
}
visit(root);
console.log(JSON.stringify({ step: 'normalize-public-urls', target, htmlFiles, rewrittenAttributes }));

// The standalone WebGL document is served from public/ rather than an Astro page.
const scenePath = 'meadow/refinement/light-studio/scene.html';
const sceneURL = new URL(scenePath, target === 'pages' ? 'https://tkkdy.github.io/tkkdyyy.github.io/' : process.env.SITE_URL).href;
const metadata = [
  '<link rel="canonical" href="' + sceneURL + '">',
  '<meta property="og:url" content="' + sceneURL + '">',
  ...(target === 'vps' && (process.env.VPS_INDEXING_PROFILE || 'preview') === 'preview' ? ['<meta name="robots" content="noindex,nofollow">'] : []),
].join('');
const file = 'dist/' + scenePath;
const sceneHTML = readFileSync(file, 'utf8');
if (!sceneHTML.includes('</title>')) throw Error('Missing meadow scene head');
writeFileSync(file, sceneHTML.replace('</title>', '</title>' + metadata));
