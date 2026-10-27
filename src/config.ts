// tkkdy 站点级配置（全站共享信息，保持最小）
//
// 公开地址随 Astro 构建配置生成，兼容项目子路径与 VPS 根路径。

export const SITE = {
  /** 公开身份（唯一允许出现的身份信息） */
  name: 'tkkdy',
  /** 当前构建目标的公开地址（含配置的 base path） */
  url: new URL(import.meta.env.BASE_URL, import.meta.env.SITE).toString().replace(/\/$/, ''),
  /** 默认站点描述（各页面未提供 description 时使用） */
  description:
    'tkkdy 的个人网站：项目、文章、随笔、碎片与影像的安静记录。',
  /** 默认 OG 图片路径：当前无真实素材，未设置（Deploy 前补） */
  ogImage: undefined as string | undefined,
  /** 内容作者公开身份 */
  author: 'tkkdy',
};
