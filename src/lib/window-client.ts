import { choosePhoto, localContext, LATE_GREETING } from './flavor-selection.mjs';
import type { WindowPhoto } from './content/window';
const STORAGE_KEY = 'tkkdy:window:v1';
export function initializeWindows() {
  document.querySelectorAll<HTMLElement>('[data-window]').forEach(root => {
    const pool: WindowPhoto[] = JSON.parse(root.dataset.photos || '[]');
    const image = root.querySelector<HTMLImageElement>('[data-window-image]')!;
    const button = root.querySelector<HTMLButtonElement>('[data-window-next]')!;
    const bad = new Set<string>();
    let current = '', generation = 0;
    const context = () => localContext(new Date());
    const greeting = () => {
      const node = root.querySelector<HTMLElement>('[data-window-greeting]')!;
      node.textContent = LATE_GREETING;
      node.hidden = root.classList.contains('life-window-compact') || root.hidden || context().time !== 'late-night';
    };
    function remember(id: string) { try { sessionStorage.setItem(STORAGE_KEY, id); } catch { /* Optional persistence. */ } }
    async function show(photo: WindowPhoto | null): Promise<void> {
      const run = ++generation;
      if (!photo) { root.hidden = true; greeting(); return; }
      button.disabled = true;
      // Set sizes before srcset so the preload starts with the final responsive candidate.
      const next = new Image(); next.sizes = image.sizes; next.srcset = photo.srcset; next.src = photo.src;
      try { await next.decode(); } catch {
        if (run !== generation) return;
        bad.add(photo.id);
        return show(choosePhoto(pool.filter(p => !bad.has(p.id)), context(), current));
      }
      if (run !== generation) return;
      image.srcset = photo.srcset; image.src = photo.src; image.alt = photo.alt;
      image.width = photo.width; image.height = photo.height;
      root.querySelectorAll<HTMLAnchorElement>('[data-window-link]').forEach(link => { link.href = photo.href; });
      for (const [selector, value] of [['note', photo.note], ['date', photo.date], ['location', photo.location]]) {
        const node = root.querySelector<HTMLElement>(`[data-window-${selector}]`)!;
        node.textContent = value; node.hidden = !value;
        if (selector === 'date') node.setAttribute('datetime', value);
      }
      current = photo.id; remember(current); root.hidden = false; greeting();
      button.hidden = pool.filter(p => !bad.has(p.id)).length < 2; button.disabled = false;
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) image.animate([{ opacity: .5 }, { opacity: 1 }], { duration: 180 });
    }
    image.addEventListener('error', () => { if (current) bad.add(current); void show(choosePhoto(pool.filter(p => !bad.has(p.id)), context(), current)); });
    button.addEventListener('click', () => void show(choosePhoto(pool.filter(p => !bad.has(p.id)), context(), current)));
    let saved = ''; try { saved = sessionStorage.getItem(STORAGE_KEY) || ''; } catch { /* Storage can be denied. */ }
    // Finish the server-rendered image request before changing its source.
    // Otherwise first-visit random selection can abort an in-flight image load.
    void image.decode().catch(() => undefined).then(() =>
      show(pool.find(p => p.id === saved) || choosePhoto(pool, context())));
    // Refresh only the greeting across midnight/05:00; never rotate a photo automatically.
    let timer = window.setInterval(greeting, 15000);
    document.addEventListener('visibilitychange', greeting);
    window.addEventListener('pagehide', () => { clearInterval(timer); timer = 0; });
    window.addEventListener('pageshow', () => { greeting(); if (!timer) timer = window.setInterval(greeting, 15000); });
  });
}
