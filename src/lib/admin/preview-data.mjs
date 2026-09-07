export const PREVIEW_STORAGE_KEY = 'vdvxdv-editorial:preview';

export function createPreviewPayload(state, markdown) {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    story: {
      id: state.id,
      title: state.title,
      deck: state.deck,
      type: state.type,
      status: state.status,
      slug: state.slug,
      categories: state.categories,
      tags: state.tags,
      publishedAt: state.publishedAt,
      cover: state.cover,
      coverAlt: state.coverAlt,
      markdown,
    },
  };
}

export function parsePreviewPayload(value) {
  if (!value) return null;
  try {
    const payload = JSON.parse(value);
    if (payload?.version !== 1 || typeof payload?.story?.markdown !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}
