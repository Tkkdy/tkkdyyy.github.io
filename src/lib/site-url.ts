/** Project Site 内部 URL：统一附加 Astro 的部署 base path。 */
export function withBase(path = ''): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
