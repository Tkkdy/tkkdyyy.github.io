import { Editor, Node, mergeAttributes, type JSONContent } from '@tiptap/core';
import DragHandle from '@tiptap/extension-drag-handle';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { TextSelection } from '@tiptap/pm/state';
import { marked } from 'marked';
import { convertedBlockJson } from './convert-block.mjs';
import { draftStorageKey, resolveDraftId } from './draft-storage.mjs';
import { createPreviewPayload, PREVIEW_STORAGE_KEY } from './preview-data.mjs';
import { serializeTipTap } from './serialize-tiptap.mjs';
import { GITHUB_TOKEN_KEY, publishStory, waitForDeploy } from './publish-story.mjs';
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
  return typeof result === 'string' && result.trim() ? result : '<p></p>';
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
    reader.addEventListener('load', () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unable to read image.')));
    reader.addEventListener('error', () => reject(new Error('Unable to read image.')));
    reader.readAsDataURL(file);
  });
}

function initializeStoryEditor(editorRoot: HTMLElement) {
  const initial = JSON.parse(editorRoot.dataset.story || '{}') as EditorState;
  const identity = resolveDraftId(initial.id, window.location.href);
  if (identity.url !== window.location.href) window.history.replaceState(null, '', identity.url);
  initial.id = identity.id;
  const storageKey = draftStorageKey(initial.id);
  const state: EditorState = { ...initial, ...parseStoredState(localStorage.getItem(storageKey)), id: initial.id };
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
    image.alt = state.coverAlt || 'Current story cover';
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
      remove.setAttribute('aria-label', `Remove ${value}`);
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
  dragHandle.setAttribute('aria-label', 'Drag to reorder block');
  dragHandle.innerHTML = '<span></span><span></span><span></span><span></span><span></span><span></span>';

  const editor = new Editor({
    element: editorElement,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false }, trailingNode: false }),
      Image.configure({ allowBase64: true, HTMLAttributes: { class: 'editor-image' } }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
      Callout,
      DragHandle.configure({ render: () => dragHandle, nested: false }),
    ],
    content: isJsonDocument(state.bodyBlocks) ? state.bodyBlocks : markdownToHtml(state.body || initial.body || ''),
    editorProps: {
      attributes: { class: 'story-prose', 'aria-label': 'Story blocks' },
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
      paragraph: 'Paragraph', heading: 'Heading', blockquote: 'Quote', callout: 'Callout',
      image: 'Image', bulletList: 'List', orderedList: 'List', codeBlock: 'Code', horizontalRule: 'Divider',
    };
    if (currentBlockLabel) currentBlockLabel.textContent = block ? labels[block.node.type.name] ?? 'Paragraph' : 'Paragraph';
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
    if (url) url.textContent = `/${route}/${valueOf(slug) || 'untitled'}/`;
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
    localStorage.setItem(storageKey, JSON.stringify(nextState));
    Object.assign(state, nextState);
    return nextState;
  };

  function scheduleSave() {
    if (saveLabel) saveLabel.textContent = 'Saving…';
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      try {
        persistDraft();
        if (saveLabel) saveLabel.textContent = 'Saved locally';
      } catch {
        if (saveLabel) saveLabel.textContent = 'Draft too large';
        showToast('This draft is too large for local storage. Choose a smaller image.');
      }
    }, 450);
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
    if (imageDialogTitle) imageDialogTitle.textContent = mode === 'edit' ? 'Edit image' : 'Insert image';
    if (imageSave) imageSave.textContent = mode === 'edit' ? 'Save image' : 'Insert image';
    dialog.showModal();
  };

  const closeImageDialog = () => {
    if (dialog instanceof HTMLDialogElement) dialog.close();
  };

  dialog?.querySelector('form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!(imageFile instanceof HTMLInputElement) || !(imageUrl instanceof HTMLInputElement)) return;
    const file = imageFile.files?.[0];
    if (file && file.size > 900_000) {
      if (imageError instanceof HTMLElement) {
        imageError.textContent = 'Choose an image smaller than 900 KB for reliable local saving.';
        imageError.hidden = false;
      }
      return;
    }
    try {
      const src = file ? await fileAsDataUrl(file) : imageUrl.value.trim();
      if (!src) {
        if (imageError instanceof HTMLElement) {
          imageError.textContent = 'Choose a file or enter an image URL.';
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
        imageError.textContent = 'The image could not be read.';
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
      const href = window.prompt('Link URL', previous || 'https://');
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

  const updatePublishStep = (step: string, statusValue: string) => {
    const item = editorRoot.querySelector(`[data-publish-step="${step}"]`);
    if (!(item instanceof HTMLElement)) return;
    item.dataset.status = statusValue;
    const labels: Record<string, string> = { running: '…', success: '✓', failure: '×', triggered: '↗' };
    item.dataset.marker = labels[statusValue] || '';
  };

  document.querySelectorAll<HTMLButtonElement>('[data-phase-action]').forEach((button) => button.addEventListener('click', async () => {
    const action = button.getAttribute('data-phase-action');
    if (action === 'Preview') try {
      window.clearTimeout(saveTimer);
      const nextState = persistDraft();
      sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(createPreviewPayload(nextState, nextState.body)));
      const previewUrl = new URL(`${editorRoot.dataset.base || '/'}admin/preview/`, window.location.origin);
      const previewWindow = window.open(previewUrl, '_blank');
      if (!previewWindow) showToast('Allow pop-ups to open the story preview.');
      else {
        previewWindow.opener = null;
        if (saveLabel) saveLabel.textContent = 'Saved locally';
      }
    } catch {
      showToast('The preview could not be prepared. Try a smaller local image.');
      return;
    }
    if (action !== 'Publish') return;

    if (progress instanceof HTMLElement) progress.hidden = false;
    progress?.querySelectorAll<HTMLElement>('[data-publish-step]').forEach((item) => {
      delete item.dataset.status;
      delete item.dataset.marker;
    });
    if (publishedUrl instanceof HTMLAnchorElement) publishedUrl.hidden = true;
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = 'Publishing…';

    try {
      window.clearTimeout(saveTimer);
      updatePublishStep('save', 'running');
      const nextState = persistDraft();
      updatePublishStep('save', 'success');

      const validationErrors = validateStory(nextState);
      if (validationErrors.length) {
        updatePublishStep('validate', 'failure');
        throw new Error(validationErrors.join(' '));
      }

      let token = localStorage.getItem(GITHUB_TOKEN_KEY) || '';
      if (!token) {
        token = window.prompt('GitHub personal access token with Contents: write and Actions: read access')?.trim() || '';
        if (!token) throw new Error('A GitHub token is required to publish.');
        localStorage.setItem(GITHUB_TOKEN_KEY, token);
      }

      const result = await publishStory({ state: nextState, token, onProgress: updatePublishStep });
      if (publishedUrl instanceof HTMLAnchorElement) {
        publishedUrl.href = result.publicUrl;
        publishedUrl.hidden = false;
      }
      showToast('Repository updated. Deployment has been triggered.');
      const run = await waitForDeploy(result.github, result.commitSha, updatePublishStep);
      showToast(run ? `Published successfully: ${result.publicUrl}` : `Repository updated and deploy triggered: ${result.publicUrl}`);
    } catch (error) {
      if ((error as { status?: number }).status === 401) localStorage.removeItem(GITHUB_TOKEN_KEY);
      const running = progress?.querySelector<HTMLElement>('[data-status="running"]');
      if (running?.dataset.publishStep) updatePublishStep(running.dataset.publishStep, 'failure');
      showToast(error instanceof Error ? error.message : 'Publish failed.');
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
      state.cover = await fileAsDataUrl(coverInput.files[0]);
      const image = document.createElement('img');
      image.alt = valueOf(coverAlt) || 'Selected story cover';
      image.src = state.cover;
      coverPreview.replaceChildren(image);
      scheduleSave();
    } catch {
      showToast('The cover image could not be read.');
    }
  });

  updateToolbar();
  updateDerived();
  resizeTextareas();
}

export function initializeStoryEditors() {
  document.querySelectorAll<HTMLElement>('.editor-workspace').forEach(initializeStoryEditor);
}
