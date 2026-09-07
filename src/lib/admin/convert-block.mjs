function inlineContent(block) {
  if (block?.type === 'blockquote') {
    return block.content?.find((child) => child.type === 'paragraph')?.content;
  }
  return block?.content;
}

function textOnly(content = []) {
  return content.map((node) => node.type === 'text' ? node.text ?? '' : '').join('');
}

export function convertedBlockJson(block, targetType) {
  const content = structuredClone(inlineContent(block) ?? []);
  const inline = content.length ? content : undefined;

  if (targetType === 'paragraph') return { type: 'paragraph', content: inline };
  if (targetType === 'heading') return { type: 'heading', attrs: { level: 2 }, content: inline };
  if (targetType === 'quote') return { type: 'blockquote', content: [{ type: 'paragraph', content: inline }] };
  if (targetType === 'callout') return { type: 'callout', content: inline };
  if (targetType === 'code') {
    const text = textOnly(content);
    return { type: 'codeBlock', content: text ? [{ type: 'text', text }] : undefined };
  }
  throw new Error(`不支持转换为此区块类型：${targetType}`);
}
