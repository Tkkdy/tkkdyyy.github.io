import { mergeStudioFrontmatter } from './frontmatter.mjs';
import { createGitHubClient, textToBase64, readAdminSession, gitBlobSha } from './github-content.mjs';
import { findLocalImageSources, rewriteImageSources, serializeTipTap } from './serialize-tiptap.mjs';
import { assertValidStory } from './validate-story.mjs';

export const GITHUB_REPOSITORY = { owner: 'Tkkdy', repo: 'tkkdyyy.github.io', branch: 'main' };

const TYPE_DIRECTORY = { Article: 'articles', Essay: 'essays', Fragment: 'fragments' };
const MIME_EXTENSIONS = {
  'image/avif': 'avif', 'image/gif': 'gif', 'image/jpeg': 'jpg', 'image/png': 'png',
  'image/svg+xml': 'svg', 'image/webp': 'webp',
};

export async function dataUrlFile(dataUrl, basename) {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match || !MIME_EXTENSIONS[match[1]]) throw new Error('只能发布 base64 格式的 PNG、JPEG、GIF、WebP、AVIF 或 SVG 图片。');
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const shortHash = Array.from(new Uint8Array(digest).slice(0, 6), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const filename = `${basename}-${shortHash}.${MIME_EXTENSIONS[match[1]]}`;
  return {
    gitPath: `public/uploads/${filename}`,
    publicPath: `/uploads/${filename}`,
    contentBase64: match[2],
  };
}

function studioFields(state, cover) {
  const shared = {
    slug: state.slug,
    publishedAt: state.publishedAt,
    status: state.status,
    tags: state.tags?.length ? state.tags : undefined,
    homepage: { show: Boolean(state.showOnHomepage) },
  };
  if (state.type === 'Article') return {
    ...shared, title: state.title, description: state.deck, updatedAt: new Date().toISOString().slice(0, 10),
    categories: state.categories?.length ? state.categories : undefined, cover: cover || undefined,
    coverAlt: cover ? state.coverAlt : undefined, featured: state.featured || undefined,
    publishNumber: state.publishNumber,
  };
  if (state.type === 'Essay') return {
    ...shared, title: state.title, summary: state.deck || undefined,
    categories: state.categories?.length ? state.categories : undefined, cover: cover || undefined,
    coverAlt: cover ? state.coverAlt : undefined, featured: state.featured || undefined,
  };
  return { ...shared, image: cover || undefined, imageAlt: cover ? state.coverAlt : undefined };
}

/** Reject renames that would overwrite an existing destination path. */
export function assertNoDestinationCollision({ sourcePath, destinationPath, destinationExists }) {
  if (sourcePath && destinationPath !== sourcePath && destinationExists) {
    throw new Error(`地址 ${destinationPath} 已经存在其他内容，请更换 URL Slug。`);
  }
}

/** @param {{ state: Record<string, any>, session?: Record<string, any>, onProgress?: (step: string, status: string) => void }} options */
export async function publishStory({ state, session, onProgress = () => {} }) {
  onProgress('validate', 'running');
  session ??= await readAdminSession();
  assertValidStory(state, { allowDraft: session.publicationMode === 'pull-request' });
  onProgress('validate', 'success');

  if (session.repository !== `${GITHUB_REPOSITORY.owner}/${GITHUB_REPOSITORY.repo}`) throw new Error('认证仓库不匹配。');
  const github = createGitHubClient({ ...GITHUB_REPOSITORY, branch: session.branch, csrf: session.csrf });
  onProgress('git', 'running');
  await github.authenticate();
  const expectedHeadOid = await github.getHead();

  const uploadFiles = [];
  const replacements = {};
  const localBodyImages = findLocalImageSources(state.bodyBlocks);
  for (let index = 0; index < localBodyImages.length; index += 1) {
    const upload = await dataUrlFile(localBodyImages[index], `${state.slug}-${index + 1}`);
    replacements[localBodyImages[index]] = upload.publicPath;
    uploadFiles.push({ path: upload.gitPath, contentBase64: upload.contentBase64 });
  }

  let cover = state.cover || '';
  if (cover.startsWith('data:')) {
    const upload = await dataUrlFile(cover, `${state.slug}-cover`);
    cover = upload.publicPath;
    if (!uploadFiles.some((file) => file.path === upload.gitPath)) uploadFiles.push({ path: upload.gitPath, contentBase64: upload.contentBase64 });
  }

  const bodyDocument = rewriteImageSources(state.bodyBlocks, replacements);
  const markdown = serializeTipTap(bodyDocument);
  if (/data:image\//.test(markdown) || cover.startsWith('data:')) throw new Error('写入内容前必须先上传本地图片。');

  const directory = TYPE_DIRECTORY[state.type];
  const destinationPath = `src/content/${directory}/${state.slug}.md`;
  const sourcePath = state.sourcePath || '';
  const existing = sourcePath ? await github.readFile(sourcePath, expectedHeadOid) : await github.readFile(destinationPath, expectedHeadOid);
  if (state.sourceBlobSha && existing?.sha !== state.sourceBlobSha) throw new Error('内容在开始编辑后已变化，请保留本地草稿并重新打开比较；未覆盖仓库。');
  if (!sourcePath && existing) throw new Error(`地址 ${destinationPath} 已经存在其他内容，请打开该内容进行编辑。`);
  if (sourcePath && !existing) throw new Error(`原内容文件 ${sourcePath} 已不在当前编辑分支上，请刷新后再发布。`);
  if (sourcePath && sourcePath !== destinationPath) {
    const destination = await github.readFile(destinationPath, expectedHeadOid);
    assertNoDestinationCollision({
      sourcePath,
      destinationPath,
      destinationExists: Boolean(destination),
    });
  }

  const content = mergeStudioFrontmatter(existing?.content ?? '', state.type, studioFields(state, cover), markdown);
  const changes = {
    expectedHeadOid,
    message: `${state.status === 'published' ? 'Publish' : 'Save'} ${state.type.toLowerCase()}: ${state.slug}`,
    files: [...uploadFiles, { path: destinationPath, contentBase64: textToBase64(content) }],
    deletePaths: sourcePath && sourcePath !== destinationPath ? [sourcePath] : [],
  };
  const commit = session.publicationMode==='pull-request' ? await github.proposeFiles(changes) : await github.commitFiles({...changes,branch:session.branch});
  onProgress('git', 'success');

  const route = state.type === 'Fragment' ? `fragments/#${state.slug}` : `${directory}/${state.slug}/`;
  const publicUrl = `https://tkkdy.github.io/tkkdyyy.github.io/${route}`;
  const savedBlobSha = await gitBlobSha(content);
  return { commitSha: commit.sha, publicUrl, github, branch: commit.proposal?.branch??session.branch, proposal:commit.proposal, sourcePath: destinationPath, sourceBlobSha: savedBlobSha };
}
