// Only the VPS build invokes this step, before Pagefind indexes dist.
import { lstatSync, realpathSync, readdirSync, rmSync, existsSync, unlinkSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
if (realpathSync(process.cwd()) !== projectRoot) {
  throw new Error('[build:vps] Run this script from its project root.');
}
if (process.argv.length !== 2) {
  throw new Error('[build:vps] This script accepts no target-path arguments.');
}
const dist = join(projectRoot, 'dist');
const admin = join(dist, 'admin');
function plainDirectory(path) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isDirectory() || realpathSync(path) !== path) {
    throw new Error('[build:vps] Refusing linked or non-directory output: ' + path);
  }
}
plainDirectory(dist);
if (relative(dist, admin) !== 'admin') throw new Error('[build:vps] Invalid admin target.');
plainDirectory(admin);

// Validate the complete tree before removing anything. Never traverse links.
const files = [];
function inspect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const rel = relative(dist, path);
    if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
      throw new Error('[build:vps] Output escaped dist.');
    }
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || realpathSync(path) !== path) {
      throw new Error('[build:vps] Refusing link inside admin output.');
    }
    if (stat.isDirectory()) inspect(path);
    else if (stat.isFile()) files.push(relative(admin, path).split(sep).join('/'));
    else throw new Error('[build:vps] Refusing special file inside admin output.');
  }
}
inspect(admin);
console.log(JSON.stringify({ step: 'vps-admin-before-removal', files: files.sort() }));
rmSync(admin, { recursive: true, force: false });
console.log('[build:vps] Removed dist/admin/ (' + files.length + ' files) before Pagefind indexing.');

// The source upload directory marker is not a public asset.
const uploadMarker = join(dist, 'uploads', '.gitkeep');
if (existsSync(uploadMarker)) {
  const markerStat = lstatSync(uploadMarker);
  if (markerStat.isSymbolicLink() || !markerStat.isFile() || realpathSync(uploadMarker) !== uploadMarker) {
    throw new Error('[build:vps] Refusing non-regular upload marker.');
  }
  unlinkSync(uploadMarker);
}

// Astro emits shared bundles before admin HTML is removed. Keep only bundles
// reachable from public output, including transitive JS/CSS references.
const assetsDir = join(dist, '_astro');
plainDirectory(assetsDir);
const assets = readdirSync(assetsDir);
for (const name of assets) {
  const path = join(assetsDir, name);
  const info = lstatSync(path);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error('[build:vps] Unexpected asset type: ' + path);
}
const retained = new Set();
const queue = [];
function follow(text) {
  for (const name of assets) {
    if (!retained.has(name) && text.includes(name)) { retained.add(name); queue.push(name); }
  }
}
function publicReferences(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (path === assetsDir) continue;
    if (entry.isSymbolicLink()) throw new Error('[build:vps] Linked output: ' + path);
    if (entry.isDirectory()) publicReferences(path);
    else if (/\.(html|css|js|xml|json|svg)$/.test(entry.name)) follow(readFileSync(path, 'utf8'));
  }
}
publicReferences(dist);
while (queue.length) {
  const name = queue.pop();
  if (/\.(js|css|json|svg)$/.test(name)) follow(readFileSync(join(assetsDir, name), 'utf8'));
}
const removed = assets.filter(name => !retained.has(name));
for (const name of removed) unlinkSync(join(assetsDir, name));
console.log(JSON.stringify({ step: 'vps-unused-bundles-removed', files: removed }));
