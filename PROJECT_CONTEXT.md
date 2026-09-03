# VDVXDV Personal Website — Project Context

## 项目是什么

这是 VDVXDV 的个人网站。

网站用于承载：

* 项目
* 文章
* 随笔
* 碎片
* 影像
* 关于信息

当前产品定义、内容模型和首页前端视觉设计已经基本完成。

当前阶段已经结束“继续探索设计”。

现在正式进入网站工程开发阶段。

---

## 当前完成状态

已经完成：

* PRODUCT.md
* CONTENT_MODEL.md
* DESIGN.md
* 多轮 Gemini 首页视觉原型
* Desktop / Mobile 设计验收
* 最终认可首页设计：v0.2.6
* Stage 1：正式 Astro 工程 + v0.2.6 首页工程化迁移（已通过人工视觉验收）
* Stage 2：Content Collections 内容数据层 + 首页内容迁移到 Markdown（已通过审核）
* Stage 3A：文章列表页 /articles 与文章详情页 /articles/[slug]（已通过审核）
* Stage 3B：项目列表页 /projects 与项目详情页 /projects/[slug]（已通过审核）
* Stage 3C：随笔 /essays、碎片时间流 /fragments、影像 /images 与单张详情页（已通过审核）
* Stage 3D：关于页 /about 与 404 页，全部导航接通（已通过审核）
* Stage 4A：Pagefind 静态搜索 /search/（Pagefind Runtime 已经用户真实 Chrome 验收）
* Stage 4B：SEO 统一 head、RSS、Sitemap、robots.txt（已通过审核）
* Stage 4C：Global UI Polish — 全站 Footer 修复（根因：Footer 样式仅在 home.css，子页面裸渲染；修复：迁移至 Footer.astro 组件 scoped style）+ 顶部导航 Search Mode（原地搜索、Pagefind 按需加载、/search/ 保留为 fallback 与完整搜索页）

目前已有的 HTML 是视觉原型，不是正式网站工程。

正式 Astro 工程、内容数据层、全部栏目、关于/404、静态搜索与可发现性能力已完成。

⚠️ 正式部署前必须填写：`src/config.ts` 与 `astro.config.mjs` 中的占位域名 `https://vdvxdv.example.com`。

---

## Source of Truth

产品需求：

`PRODUCT.md`

内容模型：

`CONTENT_MODEL.md`

设计规范：

`DESIGN.md`

首页最终视觉：

**v0.2.6**

对应最终 HTML、Desktop 截图和 Mobile 截图是当前首页视觉 Source of Truth。

如果旧版本设计与 v0.2.6 冲突：

**始终以 v0.2.6 为准。**

---

## 当前开发阶段

当前待执行：

**Stage 4D — pending（等待下一阶段任务）。**

已完成 Stage 4C（Global UI Polish：Footer 修复 + Navigation Search）。

---

## 工程原则

优先：

* 长期可维护
* 简单
* 容易阅读
* 模块边界明确
* 低耦合
* 不过度抽象
* 少依赖
* 官方能力优先
* 适合初学者在 AI 协助下维护

---

## Hard Rules

不得重新设计已经批准的首页。

不得因为认为自己的方案“更现代”“更规范”而改变：

* 页面结构
* 视觉层级
* 配色
* 排版
* Section 顺序
* 内容优先级

当前 Stage 不允许：

* React
* Vue
* Svelte
* Tailwind
* 其他栏目正式页面（全部栏目、关于与 404 已完成）
* 关于 / 搜索页面（“关于”已完成，“搜索”已完成；全部页面体系闭环）
* Search（已完成 Pagefind 静态搜索；无 Search 建议/历史等扩展）
* Search
* RSS
* Sitemap
* CMS
* Analytics
* PWA
* GitHub Pages 部署
* CI/CD
* Dark Mode
* 新功能
* 大型 UI 库
* 动画框架

不要删除或整理历史设计文件。

完成 Stage 4C 后停止，等待下一阶段任务。

---

## 首页设计维护原则（Homepage Visual v1）

Homepage Visual v1 是阶段性冻结版本，不是永久禁止修改。未来可以针对 Header、Photography、Typography、Spacing、Motion 等做局部版本迭代，但不得因为临时视觉想法无边界重构整个首页，或破坏 Content / Route / Data architecture。
