import raw from '../../content/site/settings.json';
import { validateSiteSettings } from '../site-settings.mjs';
export const siteSettings = validateSiteSettings(raw);
export const musicSourceAvailable = !!siteSettings.music.source;
