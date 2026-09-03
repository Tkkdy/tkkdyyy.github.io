// VDVXDV 站点级配置（全站共享信息，保持最小）
//
// ⚠️ 正式部署前必须填写：
// - url：当前为占位域名（example.com 为保留域，不会被误认为真实站点）。
//   确定正式域名后只需修改此处（astro.config.mjs 的 site 同步修改）。

export const SITE = {
  /** 公开身份（唯一允许出现的身份信息） */
  name: 'VDVXDV',
  /** 正式公开域名占位（部署前必须替换） */
  url: 'https://vdvxdv.example.com',
  /** 默认站点描述（各页面未提供 description 时使用） */
  description:
    'VDVXDV 的个人网站：项目、文章、随笔、碎片与影像的安静记录。',
  /** 默认 OG 图片路径：当前无真实素材，未设置（Deploy 前补） */
  ogImage: undefined as string | undefined,
  /** 内容作者公开身份 */
  author: 'VDVXDV',
};
