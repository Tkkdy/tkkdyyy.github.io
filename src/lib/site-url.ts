import { toDeploymentUrl } from './content-url.mjs';
/** Target-aware public URL, including legacy uploaded paths and external links. */
export function withBase(path = ''): string {
  return toDeploymentUrl(path, { base: import.meta.env.BASE_URL });
}
