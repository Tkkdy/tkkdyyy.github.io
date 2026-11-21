import { gsap } from 'gsap';
import type { UniverseScene } from './scene';
export function enterUniverse(root: HTMLElement, scene: UniverseScene, restored: boolean) {
  const curtain = document.querySelector<HTMLElement>('[data-universe-curtain]')!;
  const copy = root.querySelectorAll<HTMLElement>('[data-entry-copy]');
  if (restored || !document.documentElement.classList.contains('universe-boot')) {
    document.documentElement.classList.remove('universe-boot');
    scene.setEntryZoom(1.04);
    root.dataset.entry = 'complete';
    return () => {};
  }
  gsap.set(copy, { '--entry-opacity': 0 });
  const zoom = { value: 1 };
  const timeline = gsap.timeline({ onComplete() {
    document.documentElement.classList.remove('universe-boot');
    root.dataset.entry = 'complete';
    gsap.set(copy, { clearProps: '--entry-opacity' });
  } });
  timeline.fromTo(curtain, { '--unveil': '-24%' }, { '--unveil': '154%', duration: 2.65, ease: 'power1.inOut' }, 0)
    .to(zoom, { value: 1.04, duration: 4.2, ease: 'power2.out', onUpdate: () => scene.setEntryZoom(zoom.value) }, 0)
    .to(root.querySelector('.universe-title'), { '--entry-opacity': 1, duration: 1.1 }, 1.35)
    .to(root.querySelector('.universe-subtitle'), { '--entry-opacity': 1, duration: 1.1 }, 1.8)
    .to(root.querySelector('[data-scroll-cue]'), { '--entry-opacity': 1, duration: 1 }, 2.7);
  // Scrolling is always native; interrupt entry copy animation as soon as the reader moves.
  const interrupt = () => {
    if (window.scrollY > 20) { timeline.progress(1); window.removeEventListener('scroll', interrupt); }
  };
  window.addEventListener('scroll', interrupt, { passive: true });
  return () => { timeline.kill(); gsap.set(copy, { clearProps: '--entry-opacity' }); window.removeEventListener('scroll', interrupt); document.documentElement.classList.remove('universe-boot'); };
}
