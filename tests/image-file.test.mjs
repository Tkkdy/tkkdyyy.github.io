import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { localImageFile, validateImageFile } from '../src/lib/content/image-file.mjs';

test('photo validation decodes real supported files and rejects missing, corrupt, disguised and external media', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'photo-validation-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'photos'));
  for (const [format, extension] of [['jpeg', 'jpg'], ['png', 'png'], ['webp', 'webp'], ['avif', 'avif'], ['gif', 'gif']]) {
    await sharp({ create: { width: 40, height: 60, channels: 3, background: '#aaa' } }).toFormat(format).toFile(join(root, 'photos', `real.${extension}`));
    const metadata = await validateImageFile(`/photos/real.${extension}`, root);
    assert.equal(metadata.width, 40); assert.equal(metadata.height, 60);
  }
  assert.ok(localImageFile('/tkkdyyy.github.io/photos/real.png', root));
  assert.ok(localImageFile('https://tkkdy.github.io/tkkdyyy.github.io/photos/real.png', root));
  await writeFile(join(root, 'photos/broken.jpg'), 'not image data');
  await copyFile(join(root, 'photos/real.png'), join(root, 'photos/disguised.jpg'));
  for (const src of ['/photos/missing.jpg', '/photos/broken.jpg', '/photos/disguised.jpg', 'https://example.com/a.jpg', '/photos/../photos/real.png', '/photos/%2e%2e/real.png', '/photos/real.svg']) {
    await assert.rejects(validateImageFile(src, root));
  }
});
