function escapeMarkdown(value) {
  return value.replace(/([\\`*_[\]<>])/g, '\\$1');
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function markValue(mark, value, html = false) {
  if (mark.type === 'bold') return html ? `<strong>${value}</strong>` : `**${value}**`;
  if (mark.type === 'italic') return html ? `<em>${value}</em>` : `*${value}*`;
  if (mark.type === 'strike') return html ? `<s>${value}</s>` : `~~${value}~~`;
  if (mark.type === 'underline') return `<u>${value}</u>`;
  if (mark.type === 'code') return html ? `<code>${value}</code>` : `\`${value}\``;
  if (mark.type === 'link') {
    const href = escapeHtml(String(mark.attrs?.href ?? ''));
    const title = mark.attrs?.title ? ` title="${escapeHtml(String(mark.attrs.title))}"` : '';
    return html ? `<a href="${href}"${title}>${value}</a>` : `[${value}](${href}${mark.attrs?.title ? ` "${escapeHtml(String(mark.attrs.title))}"` : ''})`;
  }
  return value;
}

function inline(nodes = [], html = false) {
  return nodes.map((node) => {
    if (node.type === 'hardBreak') return html ? '<br>' : '  \n';
    if (node.type !== 'text') return '';
    let value = html ? escapeHtml(node.text ?? '') : escapeMarkdown(node.text ?? '');
    for (const mark of node.marks ?? []) value = markValue(mark, value, html);
    return value;
  }).join('');
}

function indent(value, prefix) {
  return value.split('\n').map((line) => line ? `${prefix}${line}` : line).join('\n');
}

function block(node) {
  if (node.type === 'paragraph') return inline(node.content);
  if (node.type === 'heading') return `${'#'.repeat(Number(node.attrs?.level) || 2)} ${inline(node.content)}`;
  if (node.type === 'blockquote') return indent((node.content ?? []).map(block).join('\n\n'), '> ');
  if (node.type === 'callout') return `<aside data-callout>${inline(node.content, true)}</aside>`;
  if (node.type === 'image') {
    const alt = String(node.attrs?.alt ?? '').replace(/([\]\\])/g, '\\$1');
    const src = String(node.attrs?.src ?? '').replace(/[()]/g, '\\$&');
    const title = node.attrs?.title ? ` "${String(node.attrs.title).replace(/"/g, '\\"')}"` : '';
    return `![${alt}](${src}${title})`;
  }
  if (node.type === 'horizontalRule') return '---';
  if (node.type === 'codeBlock') {
    const language = String(node.attrs?.language ?? '');
    const content = (node.content ?? []).map((child) => child.text ?? '').join('');
    const fence = content.includes('```') ? '````' : '```';
    return `${fence}${language}\n${content}\n${fence}`;
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return (node.content ?? []).map((item, index) => {
      const marker = node.type === 'orderedList' ? `${Number(node.attrs?.start ?? 1) + index}. ` : '- ';
      const itemBody = (item.content ?? []).map(block).join('\n\n');
      const [first = '', ...rest] = itemBody.split('\n');
      return `${marker}${first}${rest.length ? `\n${indent(rest.join('\n'), '  ')}` : ''}`;
    }).join('\n');
  }
  if (node.type === 'listItem') return (node.content ?? []).map(block).join('\n\n');
  return (node.content ?? []).map(block).join('\n\n');
}

export function serializeTipTap(document) {
  if (!document || document.type !== 'doc') throw new Error('无法读取 TipTap 文档');
  return (document.content ?? []).map(block).filter(Boolean).join('\n\n').trim();
}

export function findLocalImageSources(document) {
  const sources = [];
  const visit = (node) => {
    if (node?.type === 'image' && typeof node.attrs?.src === 'string' && node.attrs.src.startsWith('data:')) sources.push(node.attrs.src);
    for (const child of node?.content ?? []) visit(child);
  };
  visit(document);
  return [...new Set(sources)];
}

export function rewriteImageSources(document, replacements) {
  const copy = structuredClone(document);
  const visit = (node) => {
    if (node?.type === 'image' && replacements[node.attrs?.src]) node.attrs.src = replacements[node.attrs.src];
    for (const child of node?.content ?? []) visit(child);
  };
  visit(copy);
  return copy;
}
