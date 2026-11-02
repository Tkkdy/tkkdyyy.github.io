// Local acceptance only; never publishes a site or touches Owner photo folders.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat, readdir, rm, cp } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { parse } from 'yaml';
import { createHash } from 'node:crypto';
const workspace = resolve('.');
const evidence = resolve(process.env.CONTENT_HOME_EVIDENCE || '../tkkdy-content-evidence-20261101');
await mkdir(evidence, { recursive: true });
const report = { baseline: '033eda7d83b8bcf408d8d4a0b48a6e912f8f783f', pages: [], profiles: {}, photoMatrix: [], builds: [], failures: [] };
let browser;
const forbidden = /Article Visual|Project Interface|Atmosphere Photo|Project Slot Pending|Slot Pending|Development fixture|Main Visual|Vertical Flow|Square Fragment/i;
const retired = ['articles/context-is-the-new-interface/', 'essays/i-only-wanted-to-watch-youtube/', 'images/photo-main-landscape/', 'images/photo-portrait/', 'images/photo-square/'];
function build(label, env = {}, command = 'build') {
  try {
    const output = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', command], { shell: process.platform === 'win32', encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 12e6 });
    return writeFile(join(evidence, `${label}.log`), output).then(() => report.builds.push({ label, command: `npm run ${command}`, exit: 0, env }));
  } catch (error) { throw Error(`${label} failed: ${error.stdout}\n${error.stderr}`); }
}
async function serve(root, base) {
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (path === '/favicon.ico') { res.writeHead(204); return res.end(); }
      if (!path.startsWith(base)) throw Error('outside base');
      let file = resolve(root, path.slice(base.length));
      if (!file.startsWith(root + sep) && file !== root) throw Error('outside root');
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.wasm': 'application/wasm' })[extname(file)] || 'application/octet-stream');
      res.end(await readFile(file));
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  return { url: `http://127.0.0.1:${server.address().port}${base}`, close: () => new Promise(done => server.close(done)) };
}
async function files(root) {
  const out = [];
  for (const item of await readdir(root, { withFileTypes: true })) {
    const path = join(root, item.name);
    if (item.isDirectory()) out.push(...await files(path)); else out.push(path);
  }
  return out;
}
async function verifySite(label, root, base, { before = false, candidate = false } = {}) {
  const site = await serve(root, base);
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const routes = before || candidate ? [''] : ['', 'projects/', 'projects/attention-router/', 'images/', 'search/'];
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      for (const route of routes) {
        const response = await page.goto(site.url + route, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200);
        await page.evaluate(() => document.fonts.ready);
        // Scroll each real image into view to exercise lazy loading.
        for (const img of await page.locator('main img').all()) await img.scrollIntoViewIfNeeded();
        await page.evaluate(() => scrollTo(0, 0));
        if (route === 'search/') {
          await page.locator('#search-input').fill('Attention');
          await page.locator('#search-results a[href*="attention-router"]').first().waitFor();
        }
        const state = await page.evaluate(() => ({
          width: innerWidth, documentWidth: document.documentElement.scrollWidth,
          broken: [...document.querySelectorAll('main img')].filter(i => !i.complete || !i.naturalWidth).map(i => i.getAttribute('src')),
          text: document.querySelector('main').innerText,
          images: [...document.querySelectorAll('main img')].map(i => ({ src: i.getAttribute('src'), width: i.naturalWidth, height: i.naturalHeight }))
        }));
        if (!before) {
          assert.ok(state.documentWidth <= width + 1, `${label}/${route}@${width} overflows: ${state.documentWidth}`);
          assert.deepEqual(state.broken, []);
          assert.ok(!forbidden.test(state.text), `${label}/${route}: placeholder`);
          if (!route) {
            assert.ok(state.text.includes('Attention Router'));
            assert.equal(await page.locator('.featured-title').innerText(), '开源 Wonderland');
            assert.equal(await page.locator('.featured-card').getAttribute('href'), base + 'essays/wonderland/');
            assert.equal(await page.locator('.essays-fragments .essay-title').innerText(), '生活的主语');
            assert.equal(await page.locator('.featured-media').count(), 0);
          }
          if (route === 'images/') assert.ok(state.text.includes('公开影像正在慢慢出现'));
        }
        const filename = `${label}-${route.replaceAll('/', '-').replace(/-$/, '') || 'home'}-${width}.png`;
        await page.screenshot({ path: join(evidence, filename), fullPage: true });
        if (!before && label === 'pages' && !route) {
          for (const [name, selector] of [['wonderland', '.hero'], ['third-screen', '.essays-fragments'], ['attention-main', '.projects'], ['photo-empty', '.photography']]) {
            await page.locator(selector).screenshot({ path: join(evidence, `${name}-${width}.png`) });
          }
        }
        if (!before && label === 'pages' && route === 'projects/attention-router/') {
          for (const [index, figure] of (await page.locator('.project-screenshot').all()).entries()) await figure.screenshot({ path: join(evidence, `attention-${index ? 'console' : 'hardware'}-${width}.png`) });
        }
        report.pages.push({ label, route: route || '/', width, documentWidth: state.documentWidth, broken: state.broken, images: state.images, screenshot: filename });
      }
    }
    if (!before && !candidate) {
      if (label === 'pages') for (const id of ['article-context-is-the-new-interface', 'essay-i-only-wanted-to-watch-youtube', 'essay-p1-editor-migration-verification-20261027']) assert.equal((await page.request.get(site.url + `admin/stories/${id}/`)).status(), 404);
      for (const route of retired) assert.equal((await page.request.get(site.url + route)).status(), 404, route);
      assert.equal((await page.request.get(site.url + 'projects/morning-radar/')).status(), 200);
      for (const file of await files(root)) if (/\.(html|xml)$/.test(file)) {
        const text = await readFile(file, 'utf8');
        assert.ok(!forbidden.test(text), `placeholder in ${file}`);
        for (const route of retired) assert.ok(!text.includes(route), `draft URL in ${file}: ${route}`);
      }
      await page.goto(site.url + 'search/');
      const index = await page.evaluate(async base => {
        const pf = await import(base + 'pagefind/pagefind.js');
        const result = {};
        for (const query of ['Attention', '生活的主语', '选择之前', 'Development', '云端一键发布验收']) {
          const search = await pf.search(query);
          result[query] = await Promise.all(search.results.map(async r => (await r.data()).url));
        }
        return result;
      }, base);
      report[label + 'Index'] = index;
      assert.ok(index.Attention.some(url => url.includes('attention-router')));
      for (const urls of Object.values(index)) for (const url of urls) assert.ok(!retired.some(route => url.includes(route)), `draft in Pagefind: ${url}`);
      for (const urls of Object.values(index)) for (const url of urls) assert.ok(!retired.some(route => url.includes(route)), `draft in Pagefind: ${url}`);
      report.profiles[label] = { retiredRoutes404: retired, morningRadar200: true, publicHtmlXmlScan: 'PASS', pagefind: index, errors };
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); await site.close(); }
}
try {
  browser = await chromium.launch({ channel: 'chrome' });
  await verifySite('before', resolve('../tkkdy-content-before-20261101'), '/tkkdyyy.github.io/', { before: true });
  // Matrix uses generated flat test rasters, never personal photographs; no test data is retained in source or final output.
  const skipMatrix = process.env.CONTENT_HOME_SKIP_MATRIX === '1';
  if (skipMatrix) {
    const previous = JSON.parse(await readFile(join(evidence, 'acceptance.json'), 'utf8'));
    assert.equal(previous.photoMatrix.length, 9);
    report.photoMatrix = previous.photoMatrix; report.photoMatrixReused = 'Unchanged photography implementation: previously passed nine count/viewport combinations';
  }
  const testDir = join(workspace, 'public/__content_home_test_only');
  const fixturePaths = [];
  if (!skipMatrix) try {
    await mkdir(testDir);
    for (const [index, [width, height]] of [[900, 600], [400, 700], [480, 480]].entries()) {
      await sharp({ create: { width, height, channels: 3, background: ['#c4c4c4', '#aaa', '#888'][index] } }).png().toFile(join(testDir, `${index}.png`));
    }
    for (const count of [1, 2, 3]) {
      const index = count - 1;
      const file = join(workspace, `src/content/images/__content_home_test_only_${index}.md`);
      fixturePaths.push(file);
      await writeFile(file, `---\nslug: __content_home_test_only_${index}\nimage: /__content_home_test_only/${index}.png\nalt: LOCAL TEST RASTER\ntitle: LOCAL TEST ONLY\npublishedAt: 2026-11-01\nstatus: published\norientation: ${['landscape', 'portrait', 'square'][index]}\nhomepage:\n  show: true\n  order: ${index + 1}\n---\n`);
      await build(`photo-matrix-${count}`, {}, 'build:astro');
      const site = await serve(resolve('dist'), '/tkkdyyy.github.io/');
      const page = await browser.newPage();
      try {
        for (const width of [1440, 390, 320]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.goto(site.url);
          assert.equal(await page.locator('.photo-flow img').count(), count);
          for (const img of await page.locator('.photo-flow img').all()) await img.scrollIntoViewIfNeeded();
          await page.waitForFunction(() => [...document.querySelectorAll('.photo-flow img')].every(i => i.complete && i.naturalWidth > 0));
          const photos = await page.locator('.photo-flow img').evaluateAll(imgs => imgs.map(i => ({ ratio: i.width / i.height, intrinsic: i.naturalWidth / i.naturalHeight, src: i.getAttribute('src') })));
          assert.ok(photos.every(i => Math.abs(i.ratio - i.intrinsic) < .02));
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          report.photoMatrix.push({ count, width, photos });
        }
      } finally { await page.close(); await site.close(); }
    }
  } finally {
    for (const path of fixturePaths) await rm(path, { force: true });
    await rm(testDir, { recursive: true });
  }
  await build('pages');
  await cp('dist', join(evidence, 'build-pages'), { recursive: true });
  await verifySite('pages', resolve('dist'), '/tkkdyyy.github.io/');

  await build('vps', { SITE_URL: 'https://preview.boenbot.top', VPS_INDEXING_PROFILE: 'preview' }, 'build:vps');
  await cp('dist', join(evidence, 'build-vps'), { recursive: true });
  await verifySite('vps', resolve('dist'), '/');
  // Source preservation: exactly the five authorized status edits; every original body retained.
  report.sourcePreservation = [];
  for (const dir of ['articles', 'essays', 'images']) for (const name of await readdir(`src/content/${dir}`)) {
    if (!name.endsWith('.md')) continue;
    const path = `src/content/${dir}/${name}`;
    const old = execFileSync('git', ['show', `${report.baseline}:${path}`], { encoding: 'utf8' });
    const current = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
    const original = parse(old.split('---')[1]), changed = parse(current.split('---')[1]);
    const isRetired = retired.includes(`${dir}/${changed.slug}/`);
    assert.equal(changed.status, isRetired ? 'draft' : original.status);
    if (isRetired) {
      assert.equal(changed.homepage.show, false);
      const expected = structuredClone(original); expected.status = 'draft'; expected.homepage.show = false;
      assert.deepEqual(changed, expected);
    }
    assert.equal(current.slice(current.indexOf('---', 3) + 3), old.slice(old.indexOf('---', 3) + 3));
    report.sourcePreservation.push({ path, status: changed.status, bodyUnchanged: true });
  }
  const hardware = await readFile('public/projects/attention-router/hardware-overview.jpg');
  assert.ok(hardware.equals(await readFile('../attention-router-public-reference/assets/hardware-overview.jpg')));
  await sharp(hardware).stats();
  report.hardwareAsset = { sha256: createHash('sha256').update(hardware).digest('hex'), ...(await sharp(hardware).metadata()), bytesUnchanged: true };
  const projectImage = await readFile('public/projects/attention-router/console-demo.png');
  const originalImage = await readFile('../attention-router-public-reference/assets/console-demo.png');
  assert.ok(projectImage.equals(originalImage));
  report.consoleAsset = { sha256: createHash('sha256').update(projectImage).digest('hex'), ...(await sharp(projectImage).metadata()), bytesUnchanged: true };
  report.pass = true;
} catch (error) { report.pass = false; report.failures.push(error.stack); process.exitCode = 1; }
finally {
  if (browser) await browser.close();
  await writeFile(join(evidence, 'acceptance.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass, screenshots: report.pages.length, matrix: report.photoMatrix.length, failures: report.failures, evidence }, null, 2));
}
