export function validateStory(state) {
  const errors = [];
  if (!['Article', 'Essay', 'Fragment'].includes(state.type)) errors.push('请选择支持的内容类型。');
  if (state.status !== 'published') errors.push('发布前请将状态设为「已发布」。');
  if (state.type !== 'Fragment' && !state.title?.trim()) errors.push('请填写标题。');
  if (!state.slug?.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)) errors.push('URL Slug 只能使用小写字母、数字和单个连字符。');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.publishedAt ?? '')) errors.push('请选择发布日期。');
  if (!state.body?.trim()) errors.push('请填写正文内容。');
  if (state.cover && !state.coverAlt?.trim()) errors.push('请填写封面图片的 Alt 文本。');
  if (state.type === 'Article' && !state.deck?.trim()) {
    errors.push('发布文章前必须填写副标题 / 描述。');
  }
  if (state.type === 'Article' && state.status !== 'draft' && (!Number.isInteger(state.publishNumber) || state.publishNumber < 1)) {
    errors.push('发布文章前必须填写有效的文章编号。');
  }
  const expectedDirectory = { Article: 'articles', Essay: 'essays', Fragment: 'fragments' }[state.type];
  if (state.sourcePath && expectedDirectory && !state.sourcePath.startsWith(`src/content/${expectedDirectory}/`)) {
    errors.push('现有内容不能更改类型，请新建内容。');
  }
  return errors;
}

export function assertValidStory(state) {
  const errors = validateStory(state);
  if (errors.length) throw new Error(errors.join('\n'));
}
