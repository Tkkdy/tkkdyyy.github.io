export {};

const card = document.querySelector<HTMLElement>('[data-music-card]');
const audio = card?.querySelector<HTMLAudioElement>('[data-music]');
const status = card?.querySelector<HTMLElement>('[data-music-state]');
const controls = card?.querySelector<HTMLElement>('[data-music-controls]');
const toggle = card?.querySelector<HTMLButtonElement>('[data-music-toggle]');
const seek = card?.querySelector<HTMLInputElement>('[data-music-seek]');
const elapsed = card?.querySelector<HTMLElement>('[data-music-elapsed]');
const duration = card?.querySelector<HTMLElement>('[data-music-duration]');
const mute = card?.querySelector<HTMLButtonElement>('[data-music-mute]');
const volume = card?.querySelector<HTMLInputElement>('[data-music-volume]');
const volumeLabel = card?.querySelector<HTMLOutputElement>('[data-music-volume-label]');

if (card && audio && status && controls && toggle && seek && elapsed && duration && mute && volume && volumeLabel) {
  const fadeDuration = 2400;
  let preferredVolume = 0.35;
  let unavailable = false;
  let leaving = false;
  let frame = 0;
  let lastVolume = 0.01;
  const cancelFade = () => { cancelAnimationFrame(frame); frame = 0; };
  const setVolume = (value: number) => { lastVolume = value; audio.volume = value; };
  const time = (seconds: number) => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '--:--';
  const syncPlayback = () => {
    card.dataset.state = audio.paused ? 'paused' : 'playing';
    toggle.setAttribute('aria-label', audio.paused ? '播放' : '暂停');
    toggle.setAttribute('aria-pressed', String(!audio.paused));
  };
  const syncProgress = () => {
    const ready = Number.isFinite(audio.duration) && audio.duration > 0;
    elapsed.textContent = time(audio.currentTime);
    duration.textContent = time(audio.duration);
    seek.disabled = !ready;
    seek.value = ready ? String(audio.currentTime / audio.duration * 100) : '0';
    seek.style.setProperty('--music-fill', `${seek.value}%`);
    seek.setAttribute('aria-valuetext', `${time(audio.currentTime)} / ${time(audio.duration)}`);
  };
  const syncVolume = () => {
    const muted = audio.muted || preferredVolume === 0;
    card.dataset.muted = String(muted);
    mute.setAttribute('aria-label', muted ? '取消静音' : '静音');
    mute.setAttribute('aria-pressed', String(muted));
    // Show the visitor's chosen volume, independently of the temporary fade envelope.
    volume.value = String(Math.round(preferredVolume * 100));
    volume.style.setProperty('--music-fill', `${volume.value}%`);
    volume.setAttribute('aria-valuetext', `${volume.value}%`);
    volumeLabel.textContent = muted ? '0%' : `${volume.value}%`;
  };
  const manualVolume = () => { cancelFade(); preferredVolume = audio.volume; syncVolume(); };
  audio.addEventListener('volumechange', () => {
    if (Math.abs(audio.volume - lastVolume) > 0.001) manualVolume();
    else syncVolume();
  });
  audio.addEventListener('play', () => { cancelFade(); setVolume(Math.min(0.01, preferredVolume)); syncPlayback(); });
  audio.addEventListener('playing', () => {
    if (unavailable || leaving) return;
    status.textContent = '正在播放';
    syncPlayback();
    cancelFade();
    const started = performance.now();
    const from = audio.volume;
    const fade = (now: number) => {
      if (audio.paused || unavailable || leaving) return;
      if (Math.abs(audio.volume - lastVolume) > 0.001) { manualVolume(); return; }
      const progress = Math.min(1, (now - started) / fadeDuration);
      setVolume(from + (preferredVolume - from) * progress);
      frame = progress < 1 ? requestAnimationFrame(fade) : 0;
    };
    frame = requestAnimationFrame(fade);
  });
  for (const [event, text] of [['pause', '已暂停'], ['ended', '播放结束']]) audio.addEventListener(event, () => {
    cancelFade(); syncPlayback();
    if (!unavailable) status.textContent = text;
  });
  for (const event of ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked']) audio.addEventListener(event, syncProgress);
  const failed = () => {
    unavailable = true; cancelFade(); audio.pause(); audio.hidden = true; controls.hidden = true; toggle.hidden = true;
    status.classList.add('music-state-error'); status.textContent = '这首歌暂时无法播放。';
  };
  const play = () => {
    void audio.play().catch((error: unknown) => {
      if (unavailable || leaving) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (audio.error) failed();
      else status.textContent = '浏览器暂未允许自动播放，点击播放，音乐会轻轻淡入。';
      syncPlayback();
    });
  };
  toggle.addEventListener('click', () => { if (audio.paused) play(); else audio.pause(); });
  seek.addEventListener('input', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) { audio.currentTime = Number(seek.value) / 100 * audio.duration; syncProgress(); }
  });
  volume.addEventListener('input', () => {
    cancelFade(); preferredVolume = Number(volume.value) / 100;
    setVolume(preferredVolume); audio.muted = preferredVolume === 0; syncVolume();
  });
  mute.addEventListener('click', () => {
    const wasMuted = audio.muted || preferredVolume === 0;
    if (preferredVolume === 0) { preferredVolume = 0.35; setVolume(preferredVolume); }
    audio.muted = !wasMuted; syncVolume();
  });
  audio.addEventListener('error', failed);
  audio.querySelector('source')?.addEventListener('error', failed);
  // Keep native controls usable without JS; replace only after the custom controls are bound.
  controls.hidden = false; toggle.hidden = false; audio.hidden = true;
  syncPlayback(); syncProgress(); syncVolume();
  const title = card.querySelector('h2');
  if (title && card.closest('.about-music')) {
    const box = card.getBoundingClientRect(), text = title.getBoundingClientRect();
    card.style.setProperty('--music-title-x', `${box.left + box.width / 2 - text.left - text.width / 2}px`);
    card.style.setProperty('--music-title-y', `${box.top + box.height / 2 - text.top - text.height / 2}px`);
    card.dataset.musicReady = 'true';
    // Keyboard focus reveals controls immediately; pointer focus must not move the button between press and release.
    card.addEventListener('focusin', event => {
      if (!(event.target instanceof HTMLElement) || !event.target.matches(':focus-visible')) return;
      for (const animation of card.getAnimations({ subtree: true })) animation.finish();
    });
  }

  const start = () => {
    leaving = false; status.textContent = '准备轻轻播放…';
    setVolume(Math.min(0.01, preferredVolume));
    play();
  };
  window.addEventListener('pagehide', () => { leaving = true; cancelFade(); audio.pause(); audio.currentTime = 0; });
  window.addEventListener('pageshow', event => { if (event.persisted) start(); });
  start();
}
