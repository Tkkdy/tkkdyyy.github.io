import { SETTINGS_PATH, validateSiteSettings } from '../site-settings.mjs';
import { createCloudDraftClient } from './cloud-drafts.mjs';
import { readAdminSession, createGitHubClient, textToBase64 } from './github-content.mjs';
export async function initializeSiteSettings() {
  const root = document.querySelector<HTMLElement>('.site-settings'); if (!root) return;
  const message = root.querySelector<HTMLElement>('[data-settings-message]')!;
  const form = root.querySelector<HTMLFormElement>('form')!;
  const preview = root.querySelector<HTMLElement>('[data-settings-preview-body]')!;
  let timer = 0, dirty = false, composing = false, busy = false, attempted = false;
  try {
    const auth = await readAdminSession();
    if (!auth.privateDrafts || auth.publicationMode !== 'pull-request') throw Error('请在支持私有草稿和发布提案的受保护编辑台使用此页。');
    const load = async () => { const r = await fetch('/api/content?path=' + encodeURIComponent(SETTINGS_PATH), { credentials: 'same-origin', cache: 'no-store' }); if (!r.ok) throw Error('编辑台尚未支持站点设置；请保留 JSON 配置并通过代码 PR 更新。'); return r.json(); };
    const live = await load(), client = createCloudDraftClient({ key: 'draft-site-settings', session: readAdminSession }), saved = await client.load();
    const baseline = saved?.state?.sourceBlobSha || live.resource.sourceBlobSha;
    const initial = validateSiteSettings(JSON.parse(saved?.state?.rawContent || live.resource.rawContent));
    const names = { recent: ['doing', 'listening', 'thinking'], music: ['title', 'artist', 'note', 'source'] };
    for (const [group, fields] of Object.entries(names)) for (const name of fields) (form.elements.namedItem(name) as HTMLInputElement).value = initial[group as 'recent' | 'music'][name];
    function snapshot() {
      const content = Object.fromEntries(Object.entries(names).map(([group, fields]) => [group, Object.fromEntries(fields.map(name => [name, (form.elements.namedItem(name) as HTMLInputElement).value]))]));
      return { id: 'site-settings', title: '站点设置 / 最近与音乐', type: 'SiteSettings', sourcePath: SETTINGS_PATH, sourceBlobSha: baseline, rawContent: JSON.stringify(validateSiteSettings(content), null, 2) + '\n' };
    }
    async function save() { const state = snapshot(); await client.save(state); dirty = snapshot().rawContent !== state.rawContent; message.textContent = '已保存到云端 · 私有草稿'; return state; }
    async function safeSave() { try { await save(); } catch (error) { dirty = true; message.textContent = (error instanceof Error ? error.message : '保存失败。') + ' 当前内容仍在此页，可下载备份。'; } }
    function schedule() { dirty = true; clearTimeout(timer); if (!composing && !busy) timer = window.setTimeout(() => void safeSave(), 900); }
    form.addEventListener('input', schedule);
    form.addEventListener('compositionstart', () => { composing = true; clearTimeout(timer); });
    form.addEventListener('compositionend', () => { composing = false; schedule(); });
    window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
    root.querySelector('[data-settings-save]')?.addEventListener('click', () => void safeSave());
    root.querySelector('[data-settings-preview]')?.addEventListener('click', () => {
      try {
        const { recent, music } = JSON.parse(snapshot().rawContent);
        // Text only: private content and URLs never become executable HTML or autoplay media.
        preview.textContent = ['未发布的内容预览', ...Object.entries({ doing: '在做什么', listening: '在听什么', thinking: '在想什么' }).filter(([key]) => recent[key]).map(([key, label]) => `${label}：${recent[key]}`), music.title, music.artist, music.note, music.source ? '聆听来源：' + music.source : '未设置音源，不显示播放操作'].filter(Boolean).join('\n'); preview.hidden = false;
      } catch (error) { message.textContent = error instanceof Error ? error.message : '配置无效。'; }
    });
    root.querySelector('[data-settings-download]')?.addEventListener('click', () => {
      // Export even invalid edits for recovery; do not lose user input to validation.
      const raw = Object.fromEntries(Object.entries(names).map(([group, fields]) => [group, Object.fromEntries(fields.map(name => [name, (form.elements.namedItem(name) as HTMLInputElement).value]))]));
      const url = URL.createObjectURL(new Blob([JSON.stringify(raw, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'site-settings-backup.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy || attempted) return; busy = true; clearTimeout(timer);
      const button = form.querySelector<HTMLButtonElement>('[type="submit"]')!; button.disabled = true;
      try {
        const state = await save(), latest = await load();
        if (latest.resource.sourceBlobSha !== baseline) throw Error('站点设置已变化，请下载草稿并比较后继续。');
        if (JSON.stringify(JSON.parse(state.rawContent)) === JSON.stringify(JSON.parse(latest.resource.rawContent))) throw Error('设置没有变化，无需创建提案。');
        const session = await readAdminSession(), github = createGitHubClient({ owner: 'Tkkdy', repo: 'tkkdyyy.github.io', branch: session.branch, csrf: session.csrf });
        attempted = true; // An unknown write result is never replayed automatically.
        const result = await github.proposeFiles({ expectedHeadOid: latest.head, message: 'Update site settings: recent notes and music', files: [{ path: SETTINGS_PATH, contentBase64: textToBase64(state.rawContent) }] });
        message.textContent = '发布提案已创建，等待审核、CI 与合并；正式站尚未更新。';
        const link = document.createElement('a'); link.href = result.proposal.url; link.textContent = '查看发布提案'; message.append(' ', link);
      } catch (error) { message.textContent = (error instanceof Error ? error.message : '发布未确认。') + (attempted ? ' 请核对提案状态，不要重复提交。' : ''); }
      finally { busy = false; button.disabled = attempted; }
    });
    message.textContent = saved ? '已恢复私有草稿；尚未发布。' : '已读取当前设置；修改会自动保存到私有草稿。'; form.hidden = false;
  } catch (error) { message.textContent = error instanceof Error ? error.message : '无法载入站点设置。'; }
}
