/** Shared by the build, editor and broker; one exact JSON document, no executable config. */
export const SETTINGS_PATH = 'src/content/site/settings.json';
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) throw Error('站点设置包含未知字段。');
}
function text(value, max = 240) {
  if (typeof value !== 'string' || value.length > max) throw Error('站点设置文本缺失或超长。');
  return value.trim();
}
export function validMusicSource(value) {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
export function validateSiteSettings(value) {
  object(value, ['recent', 'music']); object(value.recent, ['doing', 'listening', 'thinking']);
  object(value.music, ['title', 'artist', 'note', 'source']);
  const recent = Object.fromEntries(['doing', 'listening', 'thinking'].map(k => [k, text(value.recent[k])]));
  const music = Object.fromEntries(['title', 'artist', 'note', 'source'].map(k => [k, text(value.music[k], k === 'source' ? 2048 : 240)]));
  if (!validMusicSource(music.source)) throw Error('音乐来源须为合法 HTTPS 平台链接或已授权的直接音频链接。');
  if (music.source && !music.title) throw Error('音乐来源需要歌曲名。');
  return { recent, music };
}
