// 在现有 Playwright browser_run_code_unsafe 中执行本函数，无需新增依赖。
// 先运行旧预览，再启动 GitHub Pages / VPS 产物的本机回环服务。
// 默认端口：冻结旧预览18086，修复后GitHub Pages18084，修复后VPS18085。
async (page) => {
  const oldUrl = 'http://127.0.0.1:18086/tkkdyyy.github.io/search/';
  const targets = [
    { name: 'github-pages', base: 'http://127.0.0.1:18084/tkkdyyy.github.io/' },
    { name: 'vps', base: 'http://127.0.0.1:18085/' },
  ];
  const cases = [];
  for (const target of targets) {
    const context = await page.context().browser().newContext();
    const tab = await context.newPage();
    let phase = 'old';
    const errors = [], requests = [], responses = [];
    tab.on('console', m => {
      if (m.type() === 'error') errors.push({ phase, kind: 'console', text: m.text(), location: m.location() });
    });
    tab.on('pageerror', e => errors.push({ phase, kind: 'pageerror', text: String(e) }));
    tab.on('requestfailed', r => errors.push({ phase, kind: 'failed', url: r.url(), failure: r.failure() }));
    tab.on('request', r => {
      if (r.url().includes('pagefind')) requests.push({ phase, url: r.url(), origin: r.headers().origin ?? null, referer: r.headers().referer ?? null });
    });
    tab.on('response', r => {
      if (r.url().includes('pagefind')) responses.push({ phase, url: r.url(), status: r.status(), allowOrigin: r.headers()['access-control-allow-origin'] ?? null });
    });
    const result = { target: target.name, oldUrl, targetBase: target.base, errors, requests, responses, pass: false };
    cases.push(result);
    try {
      const oldResponse = await tab.goto(oldUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await tab.locator('#search-input').fill('wonderland');
      await tab.waitForFunction(() => document.querySelector('#search-status')?.textContent.includes('wonderland') && !!document.querySelector('#search-results a'), null, { timeout: 15000 });
      result.oldStatus = oldResponse.status();
      result.oldSearchStatus = await tab.locator('#search-status').textContent();
      phase = 'new';
      const response = await tab.goto(target.base + 'search/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      result.newStatus = response.status();
      result.searches = [];
      for (const query of ['wonderland', '上下文']) {
        const started = Date.now();
        await tab.locator('#search-input').fill(query);
        await tab.waitForFunction(q => document.querySelector('#search-status')?.textContent.includes(q) && !!document.querySelector('#search-results a'), query, { timeout: 15000 });
        result.searches.push({ query, ms: Date.now() - started, status: await tab.locator('#search-status').textContent(), results: await tab.locator('.search-result').evaluateAll(xs => xs.map(x => ({ title: x.querySelector('a')?.textContent, href: x.querySelector('a')?.href, type: x.querySelector('.search-result-type')?.textContent }))) });
      }
      const first = result.searches[0].results.find(x => x.href === target.base + 'essays/wonderland/');
      if (!first || first.title !== '开源 Wonderland' || first.type !== '随笔') throw new Error('Wonderland title/type/link regression');
      if (result.searches.some(s => s.results.some(x => x.title?.includes(', type:')))) throw new Error('Combined Pagefind metadata returned');
      const incorrect = requests.filter(r => r.phase === 'new' && !r.url.startsWith(target.base));
      if (incorrect.length) throw new Error('New page requested Pagefind outside current origin/base: ' + JSON.stringify(incorrect));
      if (errors.some(e => e.phase === 'new')) throw new Error('New page console/resource errors');
      if (responses.some(r => r.phase === 'new' && (r.status !== 200 || r.allowOrigin !== null))) throw new Error('Unexpected Pagefind status/CORS header');
      await tab.locator('#search-input').fill('wonderland');
      await tab.waitForFunction(() => document.querySelector('#search-status')?.textContent.includes('wonderland'), null, { timeout: 8000 });
      const navigation = tab.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
      await tab.locator('#search-results a').filter({ hasText: '开源 Wonderland' }).click();
      const clicked = await navigation;
      result.clicked = { url: tab.url(), status: clicked.status(), h1: await tab.locator('h1').textContent() };
      if (result.clicked.url !== target.base + 'essays/wonderland/' || result.clicked.status !== 200) throw new Error('Search result navigation failed');
      result.pass = true;
    } catch (e) {
      result.failure = String(e);
      result.lastUrl = tab.url();
      result.body = (await tab.locator('body').textContent()).slice(0,1200);
      return { pass: false, cases };
    }
  }
  return { pass: cases.every(c => c.pass), cases };
}