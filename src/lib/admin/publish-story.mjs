import { mergeStudioFrontmatter } from './frontmatter.mjs';
import { createGitHubClient, textToBase64 } from './github-content.mjs';
import { findLocalImageSources, rewriteImageSources, serializeTipTap } from './serialize-tiptap.mjs';
import { assertValidStory } from './validate-story.mjs';

export const GITHUB_REPOSITORY = { owner: 'Tkkdy', repo: 'tkkdyyy.github.io', branch: 'main' };
export const GITHUB_TOKEN_KEY = 'vdvxdv-editorial:github-token';

const TYPE_DIRECTORY = { Article: 'articles', Essay: 'essays', Fragment: 'fragments' };
const MIME_EXTENSIONS = {
  'image/avif': 'avif', 'image/gif': 'gif', 'image/jpeg': 'jpg', 'image/png': 'png',
  'image/svg+xml': 'svg', 'image/webp': 'webp',
};

async function dataUrlFile(dataUrl, basename) {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match || !MIME_EXTENSIONS[match[1]]) throw new Error('Only base64 PNG, JPEG, GIF, WebP, AVIF, or SVG images can be published.');
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const shortHash = Array.from(new Uint8Array(digest).slice(0, 6), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const filename = `${basename}-${shortHash}.${MIME_EXTENSIONS[match[1]]}`;
  return {
    gitPath: `public/uploads/${filename}`,
    publicPath: `/tkkdyyy.github.io/uploads/${filename}`,
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
    throw new Error(`A content file already exists at ${destinationPath}. Choose a different slug.`);
  }
}

/** @param {{ state: Record<string, any>, token: string, onProgress?: (step: string, status: string) => void }} options */
export async function publishStory({ state, token, onProgress = () => {} }) {
  onProgress('validate', 'running');
  assertValidStory(state);
  onProgress('validate', 'success');

  const github = createGitHubClient({ ...GITHUB_REPOSITORY, token });
  onProgress('git', 'running');
  await github.authenticate();

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
  if (/data:image\//.test(markdown) || cover.startsWith('data:')) throw new Error('Local images must be uploaded before content is written.');

  const directory = TYPE_DIRECTORY[state.type];
  const destinationPath = `src/content/${directory}/${state.slug}.md`;
  const sourcePath = state.sourcePath || '';
  const existing = sourcePath ? await github.readFile(sourcePath) : await github.readFile(destinationPath);
  if (!sourcePath && existing) throw new Error(`A content file already exists at ${destinationPath}. Open that story to edit it.`);
  if (sourcePath && !existing) throw new Error(`The original content file ${sourcePath} no longer exists on main. Refresh before publishing.`);
  if (sourcePath && sourcePath !== destinationPath) {
    const destination = await github.readFile(destinationPath);
    assertNoDestinationCollision({
      sourcePath,
      destinationPath,
      destinationExists: Boolean(destination),
    });
  }

  const content = mergeStudioFrontmatter(existing?.content ?? '', state.type, studioFields(state, cover), markdown);
  const commit = await github.commitFiles({
    branch: GITHUB_REPOSITORY.branch,
    message: `${state.status === 'published' ? 'Publish' : 'Save'} ${state.type.toLowerCase()}: ${state.slug}`,
    files: [...uploadFiles, { path: destinationPath, contentBase64: textToBase64(content) }],
    deletePaths: sourcePath && sourcePath !== destinationPath ? [sourcePath] : [],
  });
  onProgress('git', 'success');

  const route = state.type === 'Fragment' ? `fragments/#${state.slug}` : `${directory}/${state.slug}/`;
  const publicUrl = `https://tkkdy.github.io/tkkdyyy.github.io/${route}`;
  return { commitSha: commit.sha, publicUrl, github };
}

/**
 * @param {ReturnType<typeof createGitHubClient>} github
 * @param {string} commitSha
 * @param {(step: string, status: string) => void} [onProgress]
 * @param {number} [timeoutMs]
 */
export async function waitForDeploy(github, commitSha, onProgress = () => {}, timeoutMs = 180_000) {
  onProgress('deploy', 'running');
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const run = await github.findWorkflowRun(commitSha);
    if (run) {
      if (run.status !== 'completed') {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      if (run.conclusion !== 'success') throw new Error(`Deploy finished with status: ${run.conclusion}.`);
      onProgress('deploy', 'success');
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  onProgress('deploy', 'triggered');
  return null;
}
