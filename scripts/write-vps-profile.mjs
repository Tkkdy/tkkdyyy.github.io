import { writeFileSync } from 'node:fs';
import { vpsIndexingProfile } from './vps-indexing-profile.mjs';
const profile = vpsIndexingProfile();
writeFileSync('dist/vps-build.json', JSON.stringify({schema: 1, site: new URL(process.env.SITE_URL).origin, indexingProfile: profile}), {flag: 'wx'});
