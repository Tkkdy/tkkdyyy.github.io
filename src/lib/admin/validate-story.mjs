export function validateStory(state) {
  const errors = [];
  if (!['Article', 'Essay', 'Fragment'].includes(state.type)) errors.push('Choose a supported story type.');
  if (state.status !== 'published') errors.push('Set status to Published before publishing.');
  if (state.type !== 'Fragment' && !state.title?.trim()) errors.push('Add a title.');
  if (!state.slug?.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)) errors.push('Use a lowercase slug with letters, numbers, and single hyphens.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.publishedAt ?? '')) errors.push('Choose a publication date.');
  if (!state.body?.trim()) errors.push('Add story body content.');
  if (state.cover && !state.coverAlt?.trim()) errors.push('Add alt text for the cover image.');
  if (state.type === 'Article' && !state.deck?.trim()) {
    errors.push('Articles require a deck/description before publishing.');
  }
  if (state.type === 'Article' && state.status !== 'draft' && (!Number.isInteger(state.publishNumber) || state.publishNumber < 1)) {
    errors.push('Published articles require a positive Article number.');
  }
  const expectedDirectory = { Article: 'articles', Essay: 'essays', Fragment: 'fragments' }[state.type];
  if (state.sourcePath && expectedDirectory && !state.sourcePath.startsWith(`src/content/${expectedDirectory}/`)) {
    errors.push('Changing the type of an existing story is not supported. Create a new story instead.');
  }
  return errors;
}

export function assertValidStory(state) {
  const errors = validateStory(state);
  if (errors.length) throw new Error(errors.join('\n'));
}
