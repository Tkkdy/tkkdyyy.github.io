// Shared navigation adds only this small enhancement; no Pixi/GSAP outside About.
const aboutPath = new URL(import.meta.env.BASE_URL + 'about/', location.origin).pathname;
let navigating = false;
let curtain: HTMLDivElement | null = null;
let recoveryTimer = 0;
function resetNavigation() {
  clearTimeout(recoveryTimer);
  curtain?.remove();
  curtain = null;
  navigating = false;
}
document.addEventListener('click', async (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
  if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
  const destination = new URL(link.href, location.href);
  if (destination.origin !== location.origin || destination.pathname !== aboutPath || location.pathname === aboutPath) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  event.preventDefault();
  if (navigating) return;
  navigating = true;
  const overlay = document.createElement('div');
  curtain = overlay;
  overlay.setAttribute('aria-hidden', 'true');
  Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '2147483647', background: '#000', opacity: '0', pointerEvents: 'none' });
  document.body.append(overlay);
  try { await overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-in-out', fill: 'forwards' }).finished; }
  catch { overlay.style.opacity = '1'; }
  if (!navigating) return;
  // Restore the previous document if navigation was cancelled or could not finish.
  recoveryTimer = window.setTimeout(resetNavigation, 8000);
  // Full document navigation deliberately preserves all existing page scripts.
  location.assign(destination.href);
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && navigating) resetNavigation(); });
window.addEventListener('pageshow', resetNavigation);
