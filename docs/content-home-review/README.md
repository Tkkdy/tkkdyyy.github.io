# 第一批内容与首页修复｜本地验收

结论：**PASS（本地工程验收），READY_FOR_REVIEW。Owner 视觉审核与合并审批尚未完成。**

基线为执行前从远端重新取得、交付前再次核对的 `main`：`033eda7d83b8bcf408d8d4a0b48a6e912f8f783f`。工作分支为 `codex/content-home-first-batch`，使用独立克隆，原工作区未改动。按 Owner 补充指令，Wonderland 已确定，不再保留候选选择配置。

## 实际完成

- 两篇测试文字设为 `draft` / `homepage.show: false`。保留正文与其余元数据；其余公开文章和随笔的正文、发布状态不变。
- 首屏精选使用 `wonderland` 原标题《开源 Wonderland》、原摘要和原日期；无封面时采用完整文字排版，链接按部署 base 生成。
- 第三屏保留真实碎片，随笔暂用已公开《生活的主语》（`agency`）作为审核预览，不重复 Wonderland；未修改它的正文或发布状态。最终选文仍待 Owner 决定。
- Attention Router 成为首页主项目，项目列表新增真实记录，详情复用既有通用组件。真机图为主，详情先真机后 Console。说明区分已实现、实验集成、未来计划；注明源码 Release、迁移失败、公开固件真机验收及离线中文限制。
- Morning Radar 只关闭首页策展开关，原项目、正文、生命周期状态和详情页保留。
- 移除首页开发假图与空槽。网站项目既有桌面/手机截图也更新为本轮真实本地截图，避免其旧图片继续露出 Article Visual。
- 三条摄影 fixture 转草稿。首页支持 1/2/3 张本地真实文件与自然比例；当前无公开作品，首页及 `/images/` 显示正常文字空状态。
- 图片路径、格式与实际解码校验统一使用 sharp；将 Astro 原有的 sharp 版本声明为直接依赖，锁定版本未升级。公开影像缺失或损坏会使构建失败，避免发布坏图或假图。
- 补齐 Pages 的草稿隔离：原静态 `/admin/` 会嵌入草稿正文；公共构建的后台查询现在只取已发布文字。私有编辑器保留草稿能力，未修改部署或生产配置。

## 真实验证

| 检查 | 结果与边界 |
| --- | --- |
| `npm run check` | exit 0；Astro 0 errors / 0 warnings（2 个原有弃用提示）；185 测试，183 pass、0 fail、2 skip。skip 为既有真实 OAuth/OIDC 环境集成测试，非本轮伪装通过。 |
| `npm run build` | exit 0；Pages 子路径完整构建和 Pagefind 索引。 |
| `SITE_URL=https://preview.boenbot.top VPS_INDEXING_PROFILE=preview npm run build:vps` | exit 0；根路径的本地预览构建，不访问/发布该主机。未设置 SITE_URL 的第一次执行按既有约束失败；补齐参数后成功，未削弱约束。 |
| `node tests/content-home.browser.mjs` | PASS；33 张全页截图：before 首页 3 张 + Pages/VPS 各 5 个页面 × 3 种宽度。首页、项目列表、Attention Router 详情、摄影列表、搜索结果均 200、无横向溢出、无坏图、无页面 JS 错误。另有 18 张指定局部截图。 |
| 摄影 1/2/3 数量矩阵 | 9/9：每种数量在 1440/390/320px 下实际构建和渲染，数量及原比例检查通过。仅使用临时平色测试栅格；已自动移除，不是摄影作品，未提交、未公开。后续首页文字/项目图片变更复用未受影响的这项证据。 |
| 两种部署路径 `npm run test:search` | 两套 PASS；保留原隔离中文分词复现与修复测试，验证真实项目/Wonderland/随笔/碎片的搜索页和导航搜索及结果点击，同时验证草稿不返回。 |
| 草稿排除 | 两篇测试文字和 3 条摄影 fixture 的原公开路由均 404；Pages 中两篇文字及已有 P1 草稿的静态后台编辑路由也 404。 |
| 产物扫描 | 所有 HTML/XML（含 Pages 后台）不含开发占位文本与退休的公开 URL；涵盖首页、栏目、分类、标签、RSS、sitemap。真实 Pagefind 返回 URL 中无退休内容。 |
| 正文保留 | 19 个原有 Article/Essay/Image 文件逐一比对基线；5 个授权条目只改 status/show，其余正文与元数据不变。 |
| 私有编辑器回归 | `ADMIN_SITE_URL=http://127.0.0.1:19443 npm run build:admin` exit 0；验证两篇草稿编辑器及原正文存在。未启动服务、未上传私有产物。 |
| `git diff --check` | PASS。 |

320px 项目详情长 SHA 曾造成横向溢出，已补充正文/code 自然换行，保留溢出断言后重验通过。测试没有被删除来掩盖该缺陷。

本地浏览器为 Chrome/Playwright。33 张全页及指定局部均来自本地真实构建；Agent 已查看桌面、小屏、第三屏、照片、Console、摄影空状态与搜索结果。**这些证据不替代 Owner 视觉审核，也不证明生产或硬件验收成功。**

证据：[验收 JSON](acceptance.json)、[完整 check 输出](check.txt)、[Pages 构建输出](build-pages.txt)、[VPS 构建输出](build-vps.txt)、[Pages 搜索](search-pages.json)、[VPS 搜索](search-vps.json)、[全部截图](SCREENSHOTS.md)。截图转无损 WebP 时逐一比对解码 RGBA，像素完全一致。提交的命令日志仅清理行尾空白，原始日志保留在本地证据中。

## 项目素材来源

来源固定到公开提交 `837a67d6730e9daf01eebaa5b10f1cab0780e747`，原始字节与复制后的静态文件逐一比较一致，两张均实际解码成功。

| 原始路径 | 本站位置与使用 | 许可/授权与说明 |
| --- | --- | --- |
| `assets/hardware-overview.jpg`（4000 × 3000） | `public/projects/attention-router/hardware-overview.jpg`；首页主项目、项目列表、详情第一张 | Owner 在本轮补充中明确授权复用的公开原型照片；不推断照片为 MIT。整图保留，不抹除/裁切状态标记；不证明精确公开固件验收。 |
| `assets/console-demo.png`（1280 × 2024） | `public/projects/attention-router/console-demo.png`；详情第二张 | 素材索引明确原创 UI/截图 Copyright © 2026 Tkkdy、MIT；原许可随图片保存在 `public/projects/attention-router/LICENSE.txt`。真实运行界面、隔离合成数据，不是个人用户数据。 |

来源：[素材索引](https://github.com/Tkkdy/attention-router/blob/837a67d6730e9daf01eebaa5b10f1cab0780e747/assets/ASSET_INDEX.md)、[公开 Release](https://github.com/Tkkdy/attention-router/releases/tag/v0.1.0)、[验证记录](https://github.com/Tkkdy/attention-router/blob/837a67d6730e9daf01eebaa5b10f1cab0780e747/docs/VALIDATION.md)。哈希见验收 JSON。未使用概念图、网络摄影替代图或私人照片目录。

## 变更文件与理由

| 文件 | 理由 |
| --- | --- |
| `src/content/articles/context-is-the-new-interface.md` | 测试文章转草稿并退出首页。 |
| `src/content/essays/i-only-wanted-to-watch-youtube.md` | 测试随笔转草稿并退出首页。 |
| `src/content/images/photo-main-landscape.md` | 横图 fixture 转草稿。 |
| `src/content/images/photo-portrait.md` | 竖图 fixture 转草稿。 |
| `src/content/images/photo-square.md` | 方图 fixture 转草稿。 |
| `src/content/projects/attention-router.md` | 新项目事实、状态、限制、来源与双图记录。 |
| `src/content/projects/morning-radar.md` | 仅关闭首页显示，保留原内容。 |
| `src/pages/index.astro` | Wonderland、第三屏预览及 0–3 张影像入口。 |
| `src/components/FeaturedSection.astro` | 支持 Essay、真实封面和文字精选。 |
| `src/components/ProjectsSection.astro` | 真机主图、准确状态与图注，移除空槽。 |
| `src/components/EssaysFragmentsSection.astro` | 去掉假图/空槽，保留文字型文学区。 |
| `src/components/PhotographySection.astro` | 按实际文件数量渲染、保留自然比例及空状态。 |
| `src/components/projects/ProjectsHomepage.astro` | 复用既有 stage 展示新增真实项目。 |
| `src/lib/content/homepage.ts` | 首页影像复用公开文件验证查询。 |
| `src/lib/content/images.ts` | 公开图片完整解码、拒绝缺失文件。 |
| `src/lib/content/image-file.mjs` | 路径边界、受支持格式及像素解码。 |
| `src/lib/admin/stories.ts` | 防止公共 Pages 后台静态 HTML 泄露草稿。 |
| `src/styles/home-refinements.css` | 文字精选、真实图片及不同照片数量的必要样式。 |
| `src/styles/projects.css` | 新项目列表行、小屏长文本换行。 |
| `public/projects/attention-router/hardware-overview.jpg` | 授权原图，首页/列表/详情主视觉。 |
| `public/projects/attention-router/console-demo.png` | 详情次级演示截图。 |
| `public/projects/attention-router/LICENSE.txt` | 保留截图 MIT 通知。 |
| `public/projects/tkkdy-home-desktop.png` | 真实新桌面截图替换旧占位截图。 |
| `public/projects/tkkdy-home-mobile.png` | 真实新手机截图替换旧占位截图。 |
| `package.json` / `package-lock.json` | 显式声明既有 sharp 版本。 |
| `tests/image-file.test.mjs` | 缺失/损坏/伪扩展名/外部/遍历拒绝，实际格式解码。 |
| `tests/content-home.browser.mjs` | 双路径、三宽度、草稿泄露、素材保留、摄影矩阵及截图验收。 |
| `tests/pagefind-chinese.browser.mjs` | 保留中文回归，改用真实内容并验证草稿排除。 |
| `.ai/handoff.md` | 更新当前交接，历史交接原文保留。 |
| `docs/content-home-review/**` | 本任务验证报告、原始命令输出、结构化结果与截图。 |

## 双站影响与停止边界

- 页面继续使用既有 `withBase`，Pages 保持 `/tkkdyyy.github.io/`，VPS 为 `/`；未改工作流、DNS、Nginx、Secrets/Variables、VPS、发布策略或回滚机制。
- Owner 已说明双站自动发布启用，**合并 main 可能同时上线两站**；本轮只推任务分支并创建 Draft PR。
- 创建前只读核对：GitHub 原生 `allow_auto_merge=false`；现有内容发布器要求 `codex/(editorial|cms)-proposal-UUID` 且 `draft=false`，当前任务分支不匹配且 PR 保持 Draft。工作流的生产发布入口限 main / 手动分发。本任务不配置 auto-merge、不转 Ready、不合并、不手动分发工作流。
- 真实 3.1 MB 照片按原字节复用，移动端下载体积高于压缩衍生图；本轮优先来源及状态完整，未另建图片处理系统。
- 未在生产站、真实设备或外部 Agent 上重新验收。Attention Router 的既有限制如实引用，不因网站构建通过而消失。

## Owner 待审与后续摄影交付

仍需审核：第三屏《生活的主语》的最终选文、Wonderland 文字精选及真机/Console 的视觉效果。Wonderland 的首屏选择已确定，无需再次选择。

摄影正文不是工程阻塞。后续请提供：已批准公开的原始图片文件（支持 JPG/JPEG、PNG、WebP、AVIF、GIF）、每张的 alt，以及可选标题/图注/拍摄日期/地点/系列；明确允许公开的位置或人物信息、首页精选 1–3 张及顺序。目录内缺失的旧 fixture 文件不会被当成公开作品。新照片应在另一次明确授权后再发布。

本轮停止于 Owner 视觉审核和合并审批之前。正式摄影素材仍待 Owner 提供；没有上传、生成或公开新的摄影作品。
