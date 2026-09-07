import { marked } from 'marked';

export function renderMarkdownBody(markdown) {
  const result = marked.parse(markdown ?? '', { async: false, gfm: true, breaks: false });
  return typeof result === 'string' ? result : '';
}
