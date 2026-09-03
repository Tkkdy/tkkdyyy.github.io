// VDVXDV 站点级配置（全站共享信息，保持最小）
//
// GitHub Pages Project Site 的公开地址。未来改用自定义域名时，与 astro.config.mjs 同步更新。

export const SITE = {
  /** 公开身份（唯一允许出现的身份信息） */
  name: 'VDVXDV',
  /** 正式公开地址（含 GitHub Pages Project Site base path） */
  url: 'https://tkkdy.github.io/tkkdyyy.github.io',
  /** 默认站点描述（各页面未提供 description 时使用） */
  description:
    'VDVXDV 的个人网站：项目、文章、随笔、碎片与影像的安静记录。',
  /** 默认 OG 图片路径：当前无真实素材，未设置（Deploy 前补） */
  ogImage: undefined as string | undefined,
  /** 内容作者公开身份 */
  author: 'VDVXDV',
};
