// Run after npm run build. Uses real Pagefind indexes and both public search UIs.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
import { chromium } from 'playwright';
import * as pagefind from 'pagefind';

const site = resolve(process.env.PAGEFIND_TEST_SITE || 'dist');
const base = process.env.PAGEFIND_TEST_BASE || '/tkkdyyy.github.io/';
assert.ok(base.startsWith('/') && base.endsWith('/'));
const temporary = await mkdtemp(join(tmpdir(), 'pagefind-chinese-'));
const report = { checks: [], pageErrors: [], failedIndexRequests: [] };
let server, browser, index;
try {
  const created = await pagefind.createIndex();
  assert.deepEqual(created.errors, []);
  index = created.index;
  for (const [url, content] of [
    ['/fixture/', '上下文正在成为个人 AI 的真正界面。云端一键发布验收 Development fixture'],
    ['/noise/', '云计算与存储设备，没有完整关键词。'],
    ['/terminal/', '端口服务，与另一页面不同。'],
    ['/english/', 'Development fixture English search'],
  ]) {
    const added = await index.addHTMLFile({ url, content: `<html lang="zh-CN"><body><main data-pagefind-body>${content}</main></body></html>` });
    assert.deepEqual(added.errors, []);
  }
  assert.deepEqual((await index.writeFiles({ outputPath: join(temporary, 'pagefind') })).errors, []);
  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname === '/favicon.ico') {
        res.writeHead(204);
        return res.end();
      }
      let root = site, relative;
      if (pathname === '/__fixture/') {
        res.setHeader('Content-Type', 'text/html');
        return res.end('<html lang="zh-CN"><body>isolated real index</body></html>');
      }
      if (pathname === '/__search-helper.mjs') {
        res.setHeader('Content-Type', 'text/javascript');
        return res.end(await readFile('src/lib/search/chinese-fallback.mjs'));
      }
      if (pathname.startsWith('/__fixture/pagefind/')) {
        root = temporary;
        relative = pathname.slice('/__fixture/'.length);
      } else {
        if (!pathname.startsWith(base)) throw Error('outside base');
        relative = pathname.slice(base.length);
      }
      let file = resolve(root, relative);
      if (file !== root && !file.startsWith(root + sep)) throw Error('outside root');
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' })[extname(file)] || 'application/octet-stream');
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch(process.env.PAGEFIND_TEST_BROWSER === 'chrome' ? { channel: 'chrome' } : {});
  const fixtureContext = await browser.newContext();
  const fixture = await fixtureContext.newPage();
  fixture.on('console', message => { (report.minimalLogs ??= []).push(message.text()); });
  await fixture.goto(origin + '/__fixture/');
  report.minimal = await fixture.evaluate(async () => {
    const pf = await import('/__fixture/pagefind/pagefind.js');
    const { searchWithChineseFallback } = await import('/__search-helper.mjs');
    const original = await pf.search('云端', { verbose: true });
    const fixed = await searchWithChineseFallback(pf, '云端');
    const mixed = await searchWithChineseFallback(pf, '云端 Development');
    return {
      language: document.documentElement.lang,
      entry: await (await fetch('/__fixture/pagefind/pagefind-entry.json')).json(),
      originalCount: original.results.length,
      cloud: await Promise.all(fixed.results.map(async result => (await result.data()).url)),
      mixed: await Promise.all(mixed.results.map(async result => (await result.data()).url)),
      englishCount: (await searchWithChineseFallback(pf, 'Development')).results.length,
    };
  });
  assert.equal(report.minimal.originalCount, 0, 'minimal reproduction of the tokenizer mismatch');
  assert.deepEqual(report.minimal.cloud, ['/__fixture/fixture/']);
  assert.deepEqual(report.minimal.mixed, ['/__fixture/fixture/']);
  assert.equal(report.minimal.englishCount, 2);
  await fixtureContext.close();

  for (const entry of ['page', 'navigation']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('requestfailed', request => {
      if (request.url().includes('/pagefind/')) report.failedIndexRequests.push(request.url());
    });
    page.on('request', request => {
      if (request.url().includes('/pagefind/')) assert.ok(request.url().startsWith(origin + base), 'index must use current origin/base');
    });
    await page.goto(origin + base + (entry === 'page' ? 'search/' : ''), { waitUntil: 'domcontentloaded' });
    if (entry === 'navigation') await page.locator('[data-search-trigger]').click();
    const input = page.locator(entry === 'page' ? '#search-input' : '[data-search-input]');
    const results = entry === 'page' ? '#search-results' : '[data-search-panel-results]';
    for (const query of ['云端', '上下文', 'Development', '云端 App', '云端一键发布验收', '云端']) {
      await input.fill(query);
      await page.waitForFunction(({ entry, query }) => entry === 'page'
        ? document.querySelector('#search-status')?.textContent.includes(`「${query}」`) && !!document.querySelector('#search-results a')
        : document.querySelector('[data-search-panel-all]')?.getAttribute('href')?.endsWith(`?q=${encodeURIComponent(query)}`), { entry, query });
      const article = page.locator(`${results} a[href*="/articles/context-is-the-new-interface/"]`);
      await article.waitFor({ state: 'visible' });
      assert.equal(new URL(await article.getAttribute('href'), origin).pathname, base + 'articles/context-is-the-new-interface/');
      report.checks.push({ entry, query, articleFound: true });
    }
    await page.locator(`${results} a[href*="/articles/context-is-the-new-interface/"]`).click();
    await page.waitForURL(origin + base + 'articles/context-is-the-new-interface/');
    assert.ok((await page.locator('body').innerText()).includes('云端一键发布验收'));
    await context.close();
  }
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.failedIndexRequests, []);
  report.pass = true;
} catch (error) {
  report.pass = false;
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(done => server.close(done));
  if (index) await index.deleteIndex();
  await pagefind.close();
  // Only the unique directory created by this invocation is removed.
  await rm(temporary, { recursive: true });
  if (process.env.PAGEFIND_TEST_REPORT) await writeFile(process.env.PAGEFIND_TEST_REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
