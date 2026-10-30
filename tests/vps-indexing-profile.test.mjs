import test from 'node:test';
import assert from 'node:assert/strict';
import { vpsIndexingProfile } from '../scripts/vps-indexing-profile.mjs';
import { rssGuidData } from '../src/lib/rss-guid.mjs';
test('VPS preview remains the default; malformed profiles fail closed', () => {
  assert.equal(vpsIndexingProfile({}), 'preview');
  for (const value of ['', 'false', ' production', 'prod']) assert.throws(() => vpsIndexingProfile({VPS_INDEXING_PROFILE: value}));
});
test('VPS production must be explicit and use a clean HTTPS root', () => {
  assert.equal(vpsIndexingProfile({VPS_INDEXING_PROFILE:'production',SITE_URL:'https://tkkdy.me'}),'production');
  for (const site of ['http://tkkdy.me','https://tkkdy.me/path','https://u:p@tkkdy.me','https://tkkdy.me/?x=1']) {
    assert.throws(() => vpsIndexingProfile({VPS_INDEXING_PROFILE:'production',SITE_URL:site}));
  }
});
test('existing VPS RSS GUIDs survive while Pages and new item identities stay independent', () => {
  const baseline={'/essays/old/':'https://preview.boenbot.top/essays/old/'};
  assert.match(rssGuidData('/essays/old/',false,'https://tkkdy.me',baseline),/https:\/\/preview.boenbot.top\/essays\/old\//);
  assert.equal(rssGuidData('/essays/old/',true,'https://preview.boenbot.top',baseline),undefined);
  assert.equal(rssGuidData('/essays/old/',false,'https://tkkdy.github.io/tkkdyyy.github.io',baseline),undefined);
  assert.equal(rssGuidData('/essays/new/',false,'https://tkkdy.me',baseline),undefined);
});
