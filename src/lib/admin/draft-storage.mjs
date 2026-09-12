const DRAFT_ID_PATTERN = /^draft-[a-zA-Z0-9-]{8,}$/;

export function createDraftId(cryptoSource = globalThis.crypto) {
  if (typeof cryptoSource?.randomUUID === 'function') {
    return `draft-${cryptoSource.randomUUID()}`;
  }

  const bytes = new Uint8Array(12);
  cryptoSource?.getRandomValues?.(bytes);
  const entropy = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `draft-${Date.now().toString(36)}-${entropy || Math.random().toString(36).slice(2)}`;
}

export function resolveDraftId(initialId, currentUrl, cryptoSource = globalThis.crypto) {
  if (initialId !== 'new-story') return { id: initialId, url: currentUrl };

  const url = new URL(currentUrl);
  const existing = url.searchParams.get('draft');
  const id = existing && DRAFT_ID_PATTERN.test(existing) ? existing : createDraftId(cryptoSource);
  if (existing !== id) url.searchParams.set('draft', id);
  return { id, url: url.toString() };
}

export function draftStorageKey(id) {
  return `tkkdy-editorial:${id}`;
}
