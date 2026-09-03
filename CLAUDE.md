# VDVXDV Personal Website

## Project

这是 VDVXDV 个人网站。

当前已经完成产品定义、内容模型和前端视觉设计。

当前阶段不是重新设计网站，而是把已经批准的视觉原型迁移成正式、长期可维护的网站工程。

## Source of Truth

项目规范：

* `PRODUCT.md`：产品目标与范围
* `CONTENT_MODEL.md`：未来内容模型
* `DESIGN.md`：视觉与交互规范

当前首页最终批准版本是 **v0.2.6**。

最终 v0.2.6 HTML 和对应桌面/移动截图是 Stage 1 的视觉参考。

如果历史设计版本与 v0.2.6 冲突，以 v0.2.6 为准。

## Current Stage

已完成：

* Stage 1 — 建立正式 Astro 工程，并把 v0.2.6 首页工程化迁移进去。
* Stage 2 — 建立 Content Collections 内容数据层，首页内容迁移到 Markdown。
* Stage 3A — 文章列表页与详情页（/articles、/articles/[slug]），首页文章入口接通。
* Stage 3B — 项目列表页与详情页（/projects、/projects/[slug]），首页项目入口接通。
* Stage 3C — 随笔 / 碎片 / 影像栏目（/essays、/fragments、/images 与影像单张详情）。
* Stage 3D — 关于页 /about 与 404 页，全部导航接通。
* Stage 4A — Pagefind 静态搜索（/search/，Pagefind Runtime 已经用户真实 Chrome 验收）。
* Stage 4B — SEO 统一 head、RSS、Sitemap、robots.txt。
* Stage 4C — Global UI Polish：全站 Footer 修复（样式迁移到 Footer.astro 组件 scoped style）+ 顶部导航 Search Mode（原地搜索，Pagefind 按需加载；/search/ 保留为 fallback）。

当前待执行：

**Stage 4D — pending（等待下一阶段任务）。**

## Hard Rules

* 不重新设计网站。
* 不擅自修改已经批准的布局、配色、排版和信息层级。
* 不安装 React、Vue、Svelte 或 Tailwind。
* 优先 Astro + TypeScript + 原生 CSS。
* 不过度组件化。
* 不创建不必要的抽象层。
* 不删除或整理历史设计文件。
* 搜索页是唯一允许完整搜索 UI 的页面；顶部导航 Search Mode 是唯一允许的导航交互 JS，且 Pagefind 必须按需加载（用户点击搜索后才请求）。
* 站点配置（域名等）统一在 src/config.ts，部署前必须替换占位域名。
* 不做搜索、RSS、Sitemap、部署、CMS、PWA、Analytics。
* 不增加没有明确要求的新功能。
* 小功能优先使用浏览器标准能力或少量自有代码。
* 代码必须容易阅读，适合初学者在 AI 协助下维护。

## Working Style

执行任务前先阅读相关文件并理解现状。

不要因为认为某种实现“更漂亮”而扩大任务范围。

发现问题时优先选择最简单、最小范围的解决方案。

完成当前 Stage 后停止并汇报，不自行进入下一 Stage。
