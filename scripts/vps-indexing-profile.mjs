// Explicit build intent. Missing values retain the existing preview behavior.
export function vpsIndexingProfile(env = process.env) {
  const profile = env.VPS_INDEXING_PROFILE ?? 'preview';
  if (!['preview', 'production'].includes(profile)) throw Error('Invalid VPS_INDEXING_PROFILE');
  if (profile === 'production') {
    const site = new URL(env.SITE_URL);
    if (site.protocol !== 'https:' || site.username || site.password || site.pathname !== '/' || site.search || site.hash) {
      throw Error('Production requires an HTTPS root SITE_URL');
    }
  }
  return profile;
}
