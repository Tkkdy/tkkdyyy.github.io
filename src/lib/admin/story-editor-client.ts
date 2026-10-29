import {continueCloudPublication} from './continue-cloud-publication.mjs';
import { createCloudDraftClient } from './cloud-drafts.mjs';
import {createPublicationAttempt} from './publication-attempt.mjs';
import { readAdminSession } from './github-content.mjs';
import { rememberProposal } from './proposal-history.mjs';
import { Editor, Node, mergeAttributes, type JSONContent } from '@tiptap/core';
import DragHandle from '@tiptap/extension-drag-handle';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { TextSelection } from '@tiptap/pm/state';
import { marked } from 'marked';
import { sanitizeAdminHtml } from './safe-preview.mjs';
import { convertedBlockJson } from './convert-block.mjs';
import { draftStorageKey, resolveDraftId } from './draft-storage.mjs';
import { createPreviewPayload, PREVIEW_STORAGE_KEY } from './preview-data.mjs';
import { serializeTipTap } from './serialize-tiptap.mjs';
import { publishStory } from './publish-story.mjs';
import { validateStory } from './validate-story.mjs';

type TaxonomyKind = 'categories' | 'tags';
type InsertBlock = 'paragraph' | 'heading' | 'quote' | 'callout' | 'image' | 'list' | 'code' | 'divider';

type EditorState = {
  id: string;
  title: string;
  deck: string;
  body: string;
  bodyBlocks?: JSONContent;
  editorVersion?: number;
  type: string;
  status: string;
  slug: string;
  categories: string[];
  tags: string[];
  publishedAt: string;
  showOnHomepage: boolean;
  featured: boolean;
  cover: string;
  coverAlt: string;
  publishNumber?: number;
  sourcePath: string;
  sourceBlobSha?: string;
  publication?: Record<string, any>;
};

const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  defining: true,
  parseHTML() {
    return [{ tag: 'aside[data-callout]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0];
  },
});

const isJsonDocument = (value: unknown): value is JSONContent => {
  if (!value || typeof value !== 'object') return false;
  const document = value as JSONContent;
  return document.type === 'doc' && Array.isArray(document.content);
};

const valueOf = (element: Element | null) =>
  element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement ? element.value : '';

const checkedOf = (element: Element | null) => element instanceof HTMLInputElement && element.checked;

const setValue = (element: Element | null, value: string) => {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) element.value = value ?? '';
};

const setChecked = (element: Element | null, value: boolean) => {
  if (element instanceof HTMLInputElement) element.checked = Boolean(value);
};

function parseStoredState(value: string | null): Partial<EditorState> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as Partial<EditorState> : {};
  } catch {
    return {};
  }
}

function markdownToHtml(markdown: string): string {
  const result = marked.parse(markdown, { async: false, gfm: true });
  return typeof result === 'string' && result.trim() ? sanitizeAdminHtml(result) : '<p></p>';
}

function countWords(text: string): number {
  const cjkCharacters = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) ?? [];
  const withoutCjk = text.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu, ' ');
  const latinWords = withoutCjk.match(/[\p{Script=Latin}\p{Number}]+(?:['’-][\p{Script=Latin}\p{Number}]+)*/gu) ?? [];
  return cjkCharacters.length + latinWords.length;
}

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('无法读取图片。')));
    reader.addEventListener('error', () => reject(new Error('无法读取图片。')));
    reader.readAsDataURL(file);
  });
}

function initializeStoryEditor(editorRoot: HTMLElement, cloud?: ReturnType<typeof createCloudDraftClient>) {
  const initial = JSON.parse(editorRoot.dataset.story || '{}') as EditorState;
  const identity = resolveDraftId(initial.id, window.location.href);
  if (identity.url !== window.location.href) window.history.replaceState(null, '', identity.url);
  initial.id = identity.id;
  const storageKey = draftStorageKey(initial.id);
  const state: EditorState = { ...initial, ...(cloud ? {} : parseStoredState(localStorage.getItem(storageKey))), id: initial.id };
  state.categories = Array.isArray(state.categories) ? state.categories : [];
  state.tags = Array.isArray(state.tags) ? state.tags : [];

  const title = editorRoot.querySelector('.story-title-input');
  const deck = editorRoot.querySelector('.story-deck-input');
  const status = editorRoot.querySelector('[name="status"]');
  const type = editorRoot.querySelector('[name="type"]');
  const date = editorRoot.querySelector('[name="publishedAt"]');
  const slug = editorRoot.querySelector('[name="slug"]');
  const homepage = editorRoot.querySelector('[name="showOnHomepage"]');
  const featured = editorRoot.querySelector('[name="featured"]');
  const publishNumber = editorRoot.querySelector('[name="publishNumber"]');
  const coverAlt = editorRoot.querySelector('[name="coverAlt"]');
  const editorElement = editorRoot.querySelector('.story-block-editor');
  const saveLabel = document.querySelector('.editor-save-state span');
  const wordCount = editorRoot.querySelector('.editor-word-count span');
  const currentBlockLabel = editorRoot.querySelector('[data-current-block]');
  const imageEditAction = editorRoot.querySelector('[data-block-action="edit-image"]');
  const toast = document.querySelector('.admin-toast');
  const progress = editorRoot.querySelector('[data-publish-progress]');
  const publishedUrl = editorRoot.querySelector('[data-published-url]');
  let slugWasEdited = Boolean(state.slug);
  let saveTimer = 0;
  let composing = false;
  let dirty = false;
  let pendingSaves = 0;
  let imageDialogMode: 'insert' | 'edit' = 'insert';

  if (!(editorElement instanceof HTMLElement)) return;

  setValue(title, state.title);
  setValue(deck, state.deck);
  setValue(status, state.status);
  setValue(type, state.type);
  setValue(date, state.publishedAt);
  setValue(slug, state.slug);
  setChecked(homepage, state.showOnHomepage);
  setChecked(featured, state.featured);
  setValue(publishNumber, state.publishNumber === undefined ? '' : String(state.publishNumber));
  setValue(coverAlt, state.coverAlt);
  const coverPreview = editorRoot.querySelector('.cover-preview');
  if (state.cover && coverPreview instanceof HTMLElement) {
    const image = document.createElement('img');
    image.alt = state.coverAlt || '当前内容封面';
    image.src = state.cover;
    coverPreview.replaceChildren(image);
  }

  const showToast = (message: string) => {
    if (!(toast instanceof HTMLElement)) return;
    toast.textContent = message;
    toast.hidden = false;
    window.setTimeout(() => { toast.hidden = true; }, 3200);
  };

  const slugify = (value: string) => {
    const generated = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return generated || `story-${valueOf(date) || new Date().toISOString().slice(0, 10)}`;
  };

  const resizeTextareas = () => {
    [title, deck].forEach((element) => {
      if (!(element instanceof HTMLTextAreaElement)) return;
      element.style.height = 'auto';
      element.style.height = `${element.scrollHeight}px`;
    });
  };

  const renderTaxonomy = (kind: TaxonomyKind) => {
    const field = editorRoot.querySelector(`[data-taxonomy="${kind}"]`);
    const chips = field?.querySelector('.taxonomy-chips');
    if (!(chips instanceof HTMLElement)) return;
    chips.replaceChildren();
    state[kind].forEach((value) => {
      const chip = document.createElement('span');
      chip.className = 'taxonomy-chip';
      chip.append(document.createTextNode(value));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.setAttribute('aria-label', `删除${kind === 'categories' ? '分类' : '标签'}：${value}`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        state[kind] = state[kind].filter((item) => item !== value);
        renderTaxonomy(kind);
        scheduleSave();
      });
      chip.append(remove);
      chips.append(chip);
    });
  };

  const dragHandle = document.createElement('button');
  dragHandle.type = 'button';
  dragHandle.className = 'block-drag-handle';
  dragHandle.hidden = true;
  dragHandle.setAttribute('aria-label', '拖动区块以重新排序');
  dragHandle.innerHTML = '<span></span><span></span><span></span><span></span><span></span><span></span>';

  const editor = new Editor({
    element: editorElement,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false }, trailingNode: false }),
      Image.configure({ allowBase64: true, HTMLAttributes: { class: 'editor-image' } }),
      Placeholder.configure({ placeholder: '开始写作……' }),
      Callout,
      DragHandle.configure({ render: () => dragHandle, nested: false }),
    ],
    content: markdownToHtml(isJsonDocument(state.bodyBlocks) ? serializeTipTap(state.bodyBlocks) : state.body || initial.body || ''),
    editorProps: {
      attributes: { class: 'story-prose', 'aria-label': '正文区块' },
    },
    onUpdate: () => scheduleSave(),
    onSelectionUpdate: () => updateToolbar(),
    onFocus: () => {
      dragHandle.hidden = false;
      updateToolbar();
    },
    onBlur: () => { dragHandle.hidden = true; },
  });

  editorElement.addEventListener('mouseenter', () => { dragHandle.hidden = false; });
  editorElement.addEventListener('mouseleave', () => {
    if (!editor.isFocused) dragHandle.hidden = true;
  });
  window.addEventListener('resize', resizeTextareas, { passive: true });

  const currentBlock = () => {
    const count = editor.state.doc.childCount;
    if (!count) return null;
    const { $from } = editor.state.selection;
    const selectedOffset = $from.depth >= 1 ? $from.before(1) : editor.state.selection.from;
    let offset = 0;
    for (let childIndex = 0; childIndex < count; childIndex += 1) {
      const node = editor.state.doc.child(childIndex);
      if (offset === selectedOffset || selectedOffset > offset && selectedOffset < offset + node.nodeSize) {
        return { index: childIndex, node, offset };
      }
      offset += node.nodeSize;
    }
    const index = count - 1;
    const node = editor.state.doc.child(index);
    return { index, node, offset: editor.state.doc.content.size - node.nodeSize };
  };

  const updateToolbar = () => {
    const block = currentBlock();
    const labels: Record<string, string> = {
      paragraph: '正文', heading: '标题', blockquote: '引用', callout: '强调块',
      image: '图片', bulletList: '列表', orderedList: '列表', codeBlock: '代码', horizontalRule: '分割线',
    };
    if (currentBlockLabel) currentBlockLabel.textContent = block ? labels[block.node.type.name] ?? '正文' : '正文';
    if (imageEditAction instanceof HTMLButtonElement) imageEditAction.hidden = block?.node.type.name !== 'image';
    editorRoot.querySelectorAll<HTMLButtonElement>('[data-format]').forEach((button) => {
      const format = button.dataset.format;
      const active = Boolean(format && editor.isActive(format));
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  const updateDerived = () => {
    if (wordCount) wordCount.textContent = String(countWords(editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ')));
    const route = valueOf(type).toLowerCase() === 'fragment' ? 'fragments' : `${valueOf(type).toLowerCase()}s`;
    const url = editorRoot.querySelector('.story-url code');
    if (url) url.textContent = `/${route}/${valueOf(slug) || '尚未填写'}/`;
    const publishNumberField = publishNumber?.closest('label');
    if (publishNumberField instanceof HTMLElement) publishNumberField.hidden = valueOf(type) !== 'Article';
    resizeTextareas();
  };

  const snapshot = (): EditorState => {
    const bodyBlocks = editor.getJSON();
    return {
      ...state,
      editorVersion: 1,
      title: valueOf(title),
      deck: valueOf(deck),
      body: serializeTipTap(bodyBlocks),
      bodyBlocks,
      status: valueOf(status),
      type: valueOf(type),
      publishedAt: valueOf(date),
      slug: valueOf(slug),
      showOnHomepage: checkedOf(homepage),
      featured: checkedOf(featured),
      publishNumber: valueOf(publishNumber) ? Number(valueOf(publishNumber)) : undefined,
      cover: state.cover,
      coverAlt: valueOf(coverAlt),
    };
  };

  const persistDraft = (nextState = snapshot()) => {
    if (!cloud) localStorage.setItem(storageKey, JSON.stringify(nextState));
    Object.assign(state, nextState);
    return nextState;
  };

  document.addEventListener('admin:flush-draft', (event) => {
    if(cloud){event.preventDefault();showToast('云端草稿请在“私有草稿与恢复”页面下载备份。');return;}
    window.clearTimeout(saveTimer);
    try { persistDraft(); } catch { event.preventDefault(); showToast('草稿未能保存，导出已停止。'); }
  });

  const feedback = document.createElement('div');
  feedback.className = 'cloud-draft-feedback';
  feedback.setAttribute('role','status');
  const feedbackText = document.createElement('span');
  feedbackText.textContent = '私有草稿已载入；修改会自动保存。';
  const retry = document.createElement('button'); retry.type='button'; retry.textContent='重试保存'; retry.hidden=true;
  const reload = document.createElement('button'); reload.type='button'; reload.textContent='载入另一设备版本'; reload.hidden=true;
  const copy = document.createElement('button'); copy.type='button'; copy.textContent='将此页另存为草稿'; copy.hidden=true;
  const download = document.createElement('button'); download.type='button'; download.textContent='下载此页备份'; download.hidden=true;
  const login=document.createElement('a');login.href='/auth/login?back='+encodeURIComponent(location.pathname+location.search);login.target='_blank';login.rel='noopener';login.textContent='重新登录后返回此页重试';login.hidden=true;
  feedback.append(feedbackText,retry,reload,copy,download,login);
  if(cloud){editorRoot.querySelector('.writing-inner')?.prepend(feedback);if(saveLabel)saveLabel.textContent='私有草稿已载入';}
  function syncMessage(message:string){if(saveLabel)saveLabel.textContent=message;feedbackText.textContent=message;}
  async function saveCloud(nextState = snapshot()) {
    if(!cloud)return;
    const sent=JSON.stringify(nextState); pendingSaves++;
    syncMessage('正在保存私有草稿……');
    try {
      await cloud.save(nextState);
      dirty=JSON.stringify(snapshot())!==sent;
      retry.hidden=reload.hidden=copy.hidden=download.hidden=login.hidden=true;
      syncMessage(dirty?'继续写作，正在等待保存……':'已保存到云端 · 私有草稿');
    } catch(error) {
      dirty=true;login.hidden=false;
      const failure=error as Error & {status?:number};
      syncMessage(failure.message);retry.hidden=failure.status===409;reload.hidden=copy.hidden=failure.status!==409;download.hidden=false;
      // Best effort recovery only, never a substitute for a successful server acknowledgement.
      try{localStorage.setItem(storageKey,JSON.stringify(nextState));}catch{/* Download remains available for image-heavy drafts. */}
      throw error;
    } finally {pendingSaves--;}
  }
  retry.addEventListener('click',()=>{void saveCloud().catch(()=>{});});
  reload.addEventListener('click',()=>{dirty=false;location.reload();});
  copy.addEventListener('click',async()=>{
    copy.disabled=true;
    try{
      const id='draft-'+crypto.randomUUID(),client=createCloudDraftClient({key:id,session:readAdminSession});
      await client.save({...snapshot(),id});dirty=false;location.assign('/admin/stories/new/?draft='+id);
    }catch(error){syncMessage(error instanceof Error?error.message:'另存失败，请下载此页备份。');}finally{copy.disabled=false;}
  });
  download.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='editorial-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  editorRoot.addEventListener('compositionstart',()=>{composing=true;window.clearTimeout(saveTimer);});
  editorRoot.addEventListener('compositionend',()=>{composing=false;scheduleSave();});
  window.addEventListener('beforeunload',event=>{if(cloud&&(dirty||pendingSaves)){event.preventDefault();event.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(cloud&&document.hidden&&dirty&&!composing){window.clearTimeout(saveTimer);void saveCloud().catch(()=>{});}});
  window.addEventListener('online',()=>{if(cloud&&dirty)void saveCloud().catch(()=>{});});
  function scheduleSave() {
    dirty=true;
    if (saveLabel) saveLabel.textContent = '正在保存……';
    window.clearTimeout(saveTimer);
    if(!composing)saveTimer = window.setTimeout(() => {
      try {
        const next=persistDraft();
        if(cloud)void saveCloud(next).catch(()=>{});
        else if (saveLabel) saveLabel.textContent = '已保存到本地';
      } catch {
        if (saveLabel) saveLabel.textContent = '草稿过大，无法保存';
        showToast('草稿无法保存，请下载备份或选择更小的图片。');
      }
    }, cloud ? 900 : 450);
    updateDerived();
  }

  const insertAfterCurrent = (content: JSONContent) => {
    const block = currentBlock();
    const position = block ? block.offset + block.node.nodeSize : editor.state.doc.content.size;
    editor.chain().focus().insertContentAt(position, content, { updateSelection: true }).run();
  };

  const insertBlock = (blockType: Exclude<InsertBlock, 'image'>) => {
    const blocks: Record<Exclude<InsertBlock, 'image'>, JSONContent> = {
      paragraph: { type: 'paragraph' },
      heading: { type: 'heading', attrs: { level: 2 } },
      quote: { type: 'blockquote', content: [{ type: 'paragraph' }] },
      callout: { type: 'callout' },
      list: { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      code: { type: 'codeBlock' },
      divider: { type: 'horizontalRule' },
    };
    insertAfterCurrent(blocks[blockType]);
  };

  const moveCurrentBlock = (direction: -1 | 1) => {
    const block = currentBlock();
    if (!block) return;
    const targetIndex = block.index + direction;
    if (targetIndex < 0 || targetIndex >= editor.state.doc.childCount) return;
    const transaction = editor.state.tr;
    const targetNode = editor.state.doc.child(targetIndex);
    const insertPosition = direction === -1 ? block.offset - targetNode.nodeSize : block.offset + targetNode.nodeSize;
    transaction.delete(block.offset, block.offset + block.node.nodeSize);
    transaction.insert(insertPosition, block.node);
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(Math.min(insertPosition + 1, transaction.doc.content.size))));
    editor.view.dispatch(transaction.scrollIntoView());
    editor.commands.focus();
  };

  const deleteCurrentBlock = () => {
    const block = currentBlock();
    if (!block) return;
    const transaction = editor.state.tr.delete(block.offset, block.offset + block.node.nodeSize);
    if (transaction.doc.childCount === 0) transaction.insert(0, editor.schema.nodes.paragraph.create());
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(Math.min(block.offset + 1, transaction.doc.content.size))));
    editor.view.dispatch(transaction.scrollIntoView());
    editor.commands.focus();
  };

  const convertCurrentBlock = (blockType: string) => {
    const block = currentBlock();
    if (!block || !['paragraph', 'heading', 'quote', 'callout', 'code'].includes(blockType)) return;
    const node = editor.schema.nodeFromJSON(convertedBlockJson(block.node.toJSON(), blockType));
    const transaction = editor.state.tr.replaceWith(block.offset, block.offset + block.node.nodeSize, node);
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(Math.min(block.offset + 1, transaction.doc.content.size))));
    editor.view.dispatch(transaction.scrollIntoView());
    editor.commands.focus();
  };

  const dialog = editorRoot.querySelector('.image-block-dialog');
  const imageFile = editorRoot.querySelector('[data-image-file]');
  const imageUrl = editorRoot.querySelector('[data-image-url]');
  const imageAlt = editorRoot.querySelector('[data-image-alt]');
  const imageDialogTitle = editorRoot.querySelector('#image-dialog-title');
  const imageSave = editorRoot.querySelector('[data-image-save]');
  const imageError = editorRoot.querySelector('.image-dialog-error');

  const openImageDialog = (mode: 'insert' | 'edit') => {
    if (!(dialog instanceof HTMLDialogElement)) return;
    imageDialogMode = mode;
    if (imageFile instanceof HTMLInputElement) imageFile.value = '';
    if (imageError instanceof HTMLElement) imageError.hidden = true;
    const block = currentBlock();
    const attributes = mode === 'edit' && block?.node.type.name === 'image' ? block.node.attrs : {};
    setValue(imageUrl, typeof attributes.src === 'string' && !attributes.src.startsWith('data:') ? attributes.src : '');
    setValue(imageAlt, typeof attributes.alt === 'string' ? attributes.alt : '');
    if (imageDialogTitle) imageDialogTitle.textContent = mode === 'edit' ? '编辑图片' : '插入图片';
    if (imageSave) imageSave.textContent = mode === 'edit' ? '保存图片' : '插入图片';
    dialog.showModal();
  };

  const closeImageDialog = () => {
    if (dialog instanceof HTMLDialogElement) dialog.close();
  };

  dialog?.querySelector('form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!(imageFile instanceof HTMLInputElement) || !(imageUrl instanceof HTMLInputElement)) return;
    const file = imageFile.files?.[0];
    if (file && file.size > (cloud ? 8_000_000 : 900_000)) {
      if (imageError instanceof HTMLElement) {
        imageError.textContent = cloud ? '请选择小于 8 MB 的图片。' : '请选择小于 900 KB 的图片，以确保草稿可以保存到本地。';
        imageError.hidden = false;
      }
      return;
    }
    try {
      const src = file ? await fileAsDataUrl(file) : imageUrl.value.trim();
      if (!src) {
        if (imageError instanceof HTMLElement) {
          imageError.textContent = '请选择图片文件或填写图片 URL。';
          imageError.hidden = false;
        }
        return;
      }
      const alt = valueOf(imageAlt).trim();
      const attrs = { src, alt, title: alt };
      const block = currentBlock();
      if (imageDialogMode === 'edit' && block?.node.type.name === 'image') {
        editor.chain().focus().setNodeSelection(block.offset).updateAttributes('image', attrs).run();
      } else {
        insertAfterCurrent({ type: 'image', attrs });
      }
      closeImageDialog();
    } catch {
      if (imageError instanceof HTMLElement) {
        imageError.textContent = '无法读取这张图片。';
        imageError.hidden = false;
      }
    }
  });

  editorRoot.querySelectorAll('[data-image-cancel]').forEach((button) => button.addEventListener('click', closeImageDialog));

  const toggleMenu = (triggerSelector: string, menuSelector: string) => {
    const trigger = editorRoot.querySelector(triggerSelector);
    const menu = editorRoot.querySelector(menuSelector);
    if (!(trigger instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) return;
    const open = menu.hidden;
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  };

  editorRoot.querySelector('.block-insert-trigger')?.addEventListener('click', () => toggleMenu('.block-insert-trigger', '.block-insert-menu'));
  editorRoot.querySelector('.block-style-trigger')?.addEventListener('click', () => toggleMenu('.block-style-trigger', '.block-style-menu'));
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('.block-insert')) {
      const menu = editorRoot.querySelector('.block-insert-menu');
      if (menu instanceof HTMLElement) menu.hidden = true;
      editorRoot.querySelector('.block-insert-trigger')?.setAttribute('aria-expanded', 'false');
    }
    if (!event.target.closest('.format-toolbar')) {
      const menu = editorRoot.querySelector('.block-style-menu');
      if (menu instanceof HTMLElement) menu.hidden = true;
      editorRoot.querySelector('.block-style-trigger')?.setAttribute('aria-expanded', 'false');
    }
  });

  editorRoot.querySelectorAll<HTMLElement>('[data-insert-block]').forEach((button) => button.addEventListener('click', () => {
    const blockType = button.dataset.insertBlock as InsertBlock;
    const menu = editorRoot.querySelector('.block-insert-menu');
    if (menu instanceof HTMLElement) menu.hidden = true;
    editorRoot.querySelector('.block-insert-trigger')?.setAttribute('aria-expanded', 'false');
    if (blockType === 'image') openImageDialog('insert');
    else insertBlock(blockType);
  }));

  editorRoot.querySelectorAll<HTMLElement>('[data-convert-block]').forEach((button) => button.addEventListener('click', () => {
    convertCurrentBlock(button.dataset.convertBlock || 'paragraph');
    const menu = editorRoot.querySelector('.block-style-menu');
    if (menu instanceof HTMLElement) menu.hidden = true;
    editorRoot.querySelector('.block-style-trigger')?.setAttribute('aria-expanded', 'false');
  }));

  editorRoot.querySelectorAll<HTMLElement>('[data-format]').forEach((button) => button.addEventListener('click', () => {
    const format = button.dataset.format;
    if (format === 'bold') editor.chain().focus().toggleBold().run();
    if (format === 'italic') editor.chain().focus().toggleItalic().run();
    if (format === 'underline') editor.chain().focus().toggleUnderline().run();
    if (format === 'link') {
      const previous = editor.getAttributes('link').href as string | undefined;
      const href = window.prompt('链接 URL', previous || 'https://');
      if (href === null) return;
      if (!href.trim()) editor.chain().focus().extendMarkRange('link').unsetLink().run();
      else editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run();
    }
  }));

  editorRoot.querySelectorAll<HTMLElement>('[data-block-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.blockAction;
    if (action === 'up') moveCurrentBlock(-1);
    if (action === 'down') moveCurrentBlock(1);
    if (action === 'delete') deleteCurrentBlock();
    if (action === 'edit-image') openImageDialog('edit');
  }));

  [title, deck, status, type, date, homepage, featured, publishNumber, coverAlt].forEach((element) => element?.addEventListener('input', () => {
    if (element === title && !slugWasEdited) setValue(slug, slugify(valueOf(title)));
    scheduleSave();
  }));
  slug?.addEventListener('input', () => { slugWasEdited = true; scheduleSave(); });

  (['categories', 'tags'] as TaxonomyKind[]).forEach((kind) => {
    const input = editorRoot.querySelector(`[data-taxonomy="${kind}"] input`);
    const addValue = () => {
      if (!(input instanceof HTMLInputElement)) return;
      const value = input.value.trim();
      if (value && !state[kind].includes(value)) state[kind].push(value);
      input.value = '';
      renderTaxonomy(kind);
      scheduleSave();
    };
    input?.addEventListener('keydown', (event) => {
      if (!(event instanceof KeyboardEvent) || event.key !== 'Enter') return;
      event.preventDefault();
      addValue();
    });
    input?.addEventListener('change', addValue);
    renderTaxonomy(kind);
  });

  const publicationAttempt=createPublicationAttempt();
  let publicationGeneration=0;
  let lastPublication: Awaited<ReturnType<typeof publishStory>> | null = null;
  const refreshButton = editorRoot.querySelector<HTMLButtonElement>('[data-refresh-deploy]');
  const exportProposal = editorRoot.querySelector<HTMLButtonElement>('[data-export-proposal]');
  exportProposal?.addEventListener('click',()=>{const receipt=lastPublication?.proposal?.recoveryReceipt;if(typeof receipt!=='string')return;const url=URL.createObjectURL(new Blob([JSON.stringify({schema:1,receipt})],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='editorial-studio-proposal.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  const updatePublishStep = (step: string, statusValue: string) => {
    const item = editorRoot.querySelector(`[data-publish-step="${step}"]`);
    if (!(item instanceof HTMLElement)) return;
    item.dataset.status = statusValue;
    const labels: Record<string, string> = { running: '…', success: '✓', failure: '×', triggered: '↗' };
    item.dataset.marker = labels[statusValue] || '';
  };

  const refreshDeployment = async (result: Awaited<ReturnType<typeof publishStory>>, generation=publicationGeneration) => {
    try {
        let expectedSha = result.commitSha;
        if (result.proposal) {
          const proposal = await result.github.proposalStatus(result.proposal.pullRequestNumber);
          if(generation!==publicationGeneration)return true;
          if (proposal.branch !== result.proposal.branch || proposal.commitSha !== result.proposal.commitSha) throw new Error('提案身份变化。');
          if(proposal.state==='PULL_REQUEST_CLOSED'){publicationAttempt.finish();if(cloud){delete state.publication;await saveCloud(snapshot());}}
          if (proposal.state !== 'MERGED_ON_MAIN') {
            const autoLabels: Record<string,string>={WAITING:'等待CI与保护规则，内容校验通过后自动合并',MERGED:'已合并，等待部署',NEEDS_UPDATE:'main已有更新，请比较并更新提案',CONFLICT:'内容冲突，未合并',CI_FAILED:'CI失败，未合并',STOPPED:'校验或合并结果未确认，请核验恢复',SESSION_EXPIRED:'会话已结束，请重新登录并恢复发布'};
            const status = autoLabels[proposal.publication?.state] || ({PULL_REQUEST_OPEN:'内容提案待合并，尚未部署',PULL_REQUEST_CLOSED:'内容提案已关闭，未合并',PROPOSAL_CHANGED:'提案内容已变化，需重新审查'} as Record<string,string>)[proposal.state] || '提案状态尚未核验';
            editorRoot.querySelectorAll('[data-target-status]').forEach(row => { row.textContent = `${row.getAttribute('data-target-status') === 'pages' ? 'GitHub Pages' : 'VPS'}：${status}`; });
            updatePublishStep('deploy', 'triggered');
            return proposal.publication?.state !== 'WAITING';
          }
          expectedSha = proposal.mergedSha;
          state.sourcePath=result.sourcePath;state.sourceBlobSha=result.sourceBlobSha;const hadCloudProposal=cloud&&state.publication;delete state.publication;persistDraft();if(hadCloudProposal)await saveCloud(snapshot());
          publicationAttempt.finish();
        }
        const report = await result.github.deploymentStatus(expectedSha);
        if(generation!==publicationGeneration)return true;
        const labels: Record<string, string> = {CURRENT_VERSION_VERIFIED:'公开版本与 HTTP 健康核验通过', NOT_DEPLOYED:'测试分支未部署到生产', VERSION_DIFFERS:'线上版本与本次提交不同', FAILED:'公开健康检查失败', UNKNOWN:'尚未确认'};
        for (const target of report.targets) {
          const row = editorRoot.querySelector(`[data-target-status="${target.target}"]`);
          if (row) row.textContent = `${target.target === 'pages' ? 'GitHub Pages' : 'VPS'}：${labels[target.status] || '尚未确认'}${target.actualSha ? `（${target.actualSha.slice(0, 8)}）` : ''}；流水线：${({SUCCEEDED:'已成功',FAILED:'失败',PENDING:'执行中',SKIPPED:'未部署',NOT_REQUESTED:'测试分支不触发生产',UNKNOWN:'尚未确认'} as Record<string,string>)[target.pipeline?.state] || '尚未确认'}${target.pipeline?.job ? ` · ${target.pipeline.job}` : ''}${target.pipeline?.step ? ` · ${target.pipeline.step}` : ''}`;
        }
        updatePublishStep('deploy', report.targets.every((target: {status: string}) => target.status === 'CURRENT_VERSION_VERIFIED') ? 'success' : 'triggered');
        return report.targets.every((target: {pipeline?: {state: string}}) => ['SUCCEEDED','SKIPPED','FAILED'].includes(target.pipeline?.state || ''));
      } catch {
        editorRoot.querySelectorAll('[data-target-status]').forEach(row => { row.textContent = `${row.getAttribute('data-target-status') === 'pages' ? 'GitHub Pages' : 'VPS'}：本次状态查询失败，请刷新核验。`; });
        updatePublishStep('deploy', 'triggered');
      }
  };
  let publicationPoll: number | undefined;
  const pollPublication = (result: Awaited<ReturnType<typeof publishStory>>, remaining=100) => {
    window.clearTimeout(publicationPoll);
    if(remaining<=0)return;
    const generation=publicationGeneration;
    publicationPoll=window.setTimeout(async()=>{if(generation!==publicationGeneration)return;const done=await refreshDeployment(result,generation);if(!done&&generation===publicationGeneration)pollPublication(result,remaining-1);},15000);
  };
  window.addEventListener('pagehide',()=>window.clearTimeout(publicationPoll),{once:true});
  refreshButton?.addEventListener('click', async () => {
    if (!lastPublication) return;
    refreshButton.disabled = true;
    try { await refreshDeployment(lastPublication); } finally { refreshButton.disabled = false; }
  });

  document.querySelectorAll<HTMLButtonElement>('[data-phase-action]').forEach((button) => button.addEventListener('click', async () => {
    const action = button.getAttribute('data-phase-action');
    if (action === 'Preview') try {
      window.clearTimeout(saveTimer);
      const nextState = persistDraft();
      sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewPayload(nextState, nextState.body)));
      const previewUrl = new URL(`${editorRoot.dataset.base || '/'}admin/preview/`, window.location.origin);
      const previewWindow = window.open(previewUrl, '_blank');
      if (!previewWindow) showToast('请允许浏览器打开弹窗，以查看内容预览。');
      else {
        previewWindow.opener = null;
        if (saveLabel) saveLabel.textContent = cloud ? '预览已打开；云端保存状态见正文上方' : '已保存到本地';
      }
    } catch {
      showToast('无法生成预览，请尝试使用更小的本地图片。');
      return;
    }
    if (action !== 'Publish') return;
    publicationGeneration++;window.clearTimeout(publicationPoll);
    if (exportProposal) exportProposal.hidden = true;
    if (refreshButton) refreshButton.hidden = true;
    editorRoot.querySelectorAll('[data-target-status]').forEach(row => { row.textContent = `${row.getAttribute('data-target-status') === 'pages' ? 'GitHub Pages' : 'VPS'}：尚未核验`; });

    if (progress instanceof HTMLElement) progress.hidden = false;
    progress?.querySelectorAll<HTMLElement>('[data-publish-step]').forEach((item) => {
      delete item.dataset.status;
      delete item.dataset.marker;
    });
    if (publishedUrl instanceof HTMLAnchorElement) publishedUrl.hidden = true;
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = '正在发布……';

    try {
      window.clearTimeout(saveTimer);
      updatePublishStep('save', 'running');
      const nextState = persistDraft();
      if(cloud)await saveCloud(nextState);
      updatePublishStep('save', 'success');

      const session = await readAdminSession();
      if(cloud && nextState.status === 'draft')throw new Error('私有草稿已自动保存。请在发布设置中改为“已发布”，再提交发布提案。');
      const validationErrors = validateStory(nextState, { allowDraft: session.publicationMode === 'pull-request' });
      if (validationErrors.length) {
        updatePublishStep('validate', 'failure');
        throw new Error(validationErrors.join(' '));
      }

      const result = await publicationAttempt.run(async()=>{
        if(cloud&&state.publication)return continueCloudPublication({record:state.publication,session});
        const requestId=crypto.randomUUID();let submissionStarted=false;
        if(cloud){state.publication={state:'SUBMITTING',requestId};await saveCloud(snapshot());}
        try{return await publishStory({state:nextState,session,requestId,onProgress:(step,status)=>{if(step==='proposal-request')submissionStarted=true;updatePublishStep(step,status);}});}
        catch(error){if(!submissionStarted){publicationAttempt.finish();if(cloud){delete state.publication;await saveCloud(snapshot());}}throw error;}
      });
      if (result.proposal) {
        if(cloud){state.publication={...result.proposal,sourcePath:result.sourcePath,sourceBlobSha:result.sourceBlobSha};try{await saveCloud(snapshot());}catch{showToast('提案已创建，但云端恢复记录保存失败；请保留 PR 链接。');}}
        try { rememberProposal(result.proposal,localStorage); } catch { showToast('提案已创建，但恢复记录未保存；请保留PR链接并导出当前提案记录。'); }
        if (publishedUrl instanceof HTMLAnchorElement) { publishedUrl.href = result.proposal.url; publishedUrl.textContent = '查看内容提案'; publishedUrl.hidden = false; }
        lastPublication = result;
        if (exportProposal) exportProposal.hidden = typeof result.proposal.recoveryReceipt !== 'string';
        if (refreshButton) { refreshButton.disabled = false; refreshButton.hidden = false; }
        await refreshDeployment(result);
        showToast(result.proposal.publication?.state==='WAITING'?'已提交自动发布：等待CI，草稿保留。':'提案状态已核验，草稿保留；两站部署结果见下方。');
        if(result.proposal.publication?.state==='WAITING')pollPublication(result);
        return;
      }

      if (publishedUrl instanceof HTMLAnchorElement) {
        publishedUrl.href = result.publicUrl;
        publishedUrl.hidden = result.branch !== 'main';
      }
      showToast(`内容已写入 ${result.branch}：${result.commitSha.slice(0, 8)}。`);
      updatePublishStep('deploy', 'running');
      publicationAttempt.finish();
      state.sourcePath = result.sourcePath;
      state.sourceBlobSha = result.sourceBlobSha;
      persistDraft();
      lastPublication = result;
      if (refreshButton) refreshButton.hidden = false;
      await refreshDeployment(result);
      showToast(`内容已写入 ${result.branch}。两站结果见发布状态；版本核验不代表完整功能验收。`);
    } catch (error) {
      const running = progress?.querySelector<HTMLElement>('[data-status="running"]');
      if (running?.dataset.publishStep) updatePublishStep(running.dataset.publishStep, 'failure');
      showToast(error instanceof Error ? error.message : '发布失败。');
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }));

  const coverInput = editorRoot.querySelector('#cover-input');
  coverInput?.addEventListener('change', async () => {
    if (!(coverInput instanceof HTMLInputElement) || !coverInput.files?.[0]) return;
    if (!(coverPreview instanceof HTMLElement)) return;
    try {
      if(coverInput.files[0].size > (cloud ? 8_000_000 : 900_000))throw new Error('封面图片过大，请缩小图片。');
      state.cover = await fileAsDataUrl(coverInput.files[0]);
      const image = document.createElement('img');
      image.alt = valueOf(coverAlt) || '已选择的内容封面';
      image.src = state.cover;
      coverPreview.replaceChildren(image);
      scheduleSave();
    } catch {
      showToast('无法读取封面图片。');
    }
  });

  if(cloud&&state.publication){
    try{rememberProposal(state.publication,localStorage);const link=document.createElement('a');link.href='/admin/proposals/';link.textContent='查看此草稿的发布提案与双站状态';feedback.append(link);}catch{syncMessage('发布恢复记录需核对，请保留此草稿。');}
  }
  updateToolbar();
  updateDerived();
  resizeTextareas();
}

export function initializeStoryEditors() {
  document.querySelectorAll<HTMLElement>('.editor-workspace').forEach(async root => {
    const params=new URL(location.href).searchParams;
    const explicitSource = params.get('source');
    try {
      let cloud: ReturnType<typeof createCloudDraftClient> | undefined;
      const response = await fetch('/api/session', {credentials:'same-origin',cache:'no-store'}).catch(() => null);
      const session=response?.ok ? await response.json() : null;
      if (session?.authenticated) {
        const initial = JSON.parse(root.dataset.story || '{}');
        const path = explicitSource || initial.sourcePath;
        if (path) {
          const live = await fetch('/api/story?path='+encodeURIComponent(path), {credentials:'same-origin',cache:'no-store'});
          if (!live.ok) throw Error('当前分支内容读取失败；请返回内容列表后重试。');
          root.dataset.story = JSON.stringify((await live.json()).story);
        }
        if(session.privateDrafts){
          const value=JSON.parse(root.dataset.story||'{}');
          const identity=resolveDraftId(value.id,location.href);history.replaceState(null,'',identity.url);value.id=identity.id;
          const key=params.has('draft')?value.id:value.sourcePath||value.id;
          cloud=createCloudDraftClient({key,session:readAdminSession});
          const saved=await cloud.load();
          const imported=!saved&&params.has('draft')?parseStoredState(localStorage.getItem(draftStorageKey(value.id))):null;
          const restored=saved?.state||(imported?.type?{...value,...imported,id:value.id}:value);
          if(imported?.type)await cloud.save(restored);
          root.dataset.story=JSON.stringify(restored);
        }
      } else if (explicitSource) throw Error('请连接编辑服务后打开此内容。');
      initializeStoryEditor(root,cloud);root.inert=false;
    } catch (error) {
      const message = document.createElement('p'); message.textContent = error instanceof Error ? error.message : '内容载入失败。';
      root.replaceChildren(message);root.inert=false;
    }
  });
}
