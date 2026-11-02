import raw from '../../content/site/settings.json';
import { validateSiteSettings } from '../site-settings.mjs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
export const siteSettings = validateSiteSettings(raw);
export const musicSourceAvailable = !!siteSettings.music.source && (!siteSettings.music.source.startsWith('/') || existsSync(resolve('public', '.' + siteSettings.music.source)));
