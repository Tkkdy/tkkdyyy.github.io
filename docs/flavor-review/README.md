# tkkdy「调味」开发与验收记录

1. **结果：PASS_WITH_LIMITATIONS，未部署。** 已实现一扇窗、最近、关于页音乐和影像联动，以及现有编辑台的设置/照片元数据入口。真实公开配置没有可用且明确参与窗口的照片，“最近”全部为空，因此真实构建隐藏这两个模块；有图效果仅在明确标注的隔离测试素材中演示。Draft PR 供 Owner 视觉审查，不代表上线批准。

2. **基线**

- 仓库：Tkkdy/tkkdyyy.github.io；最新 main 基线 `033eda7d83b8bcf408d8d4a0b48a6e912f8f783f`。
- 原目录在 main `85d41fd`，落后 56 提交，存在已有未跟踪文件；本轮未改动该目录的源文件和用户文件。
- 独立分支：`codex/website-flavor-20261102`；worktree：`C:/Users/PsyDuck/.codex/worktrees/tkkdy-flavor-20261102`。
- PR [#31](https://github.com/Tkkdy/tkkdyyy.github.io/pull/31) 仍为 OPEN/Draft，head `4ad00fe908f31fb470864ea2ddc1d46b0147a544`。本轮从 main 开发，不合并/重放 #31 的首页内容更换。`src/lib/content/image-file.mjs` 逐字节复用 #31 的已实现文件校验器，其余 #31 摄影修复没有擅自整合。两 PR 都改动 index.astro 等文件，合入顺序需在 Owner 批准后重新比较；本轮没有承诺未来无冲突。
- 编辑台源码就在本仓库：`src/pages/admin/`、`src/lib/admin/`、`ops/admin-broker/`；`astro.config.admin.mjs` 生成独立私有静态产物，由既有 Broker 服务提供。`ops/admin-broker/content-reader.mjs` 原本只读取五种内容的 Markdown，本轮只增加精确 JSON 文件。
- 匿名真实浏览器确认 editor.boenbot.top 跳转 Google 登录；没有登录、读取私人草稿或核对线上正在运行的编辑台 SHA。命令行曾返回 403，此结果已被真实浏览器能进入认证入口的证据补充，不能称编辑台故障。
- 双站 `deployment.json` 的 sourceSha 均真实读到 `033eda7...`，见 [live-baseline.json](live-baseline.json)。旧 `.ai/handoff.md` 仍为先前 #29 的历史记录，本轮以独立任务 handoff 为准，不以历史记录推断生产状态。

3. **改动与取舍**

| 路径 | 行为 |
| --- | --- |
| `src/content.config.ts` / `public/admin/config.yml` | images 增加可选 window 对象，enabled 默认 false；时段必须明确标注，未知标签忽略；没有从拍摄日期推断拍摄时刻。 |
| `src/lib/content/window.ts` / `image-file.mjs` / `src/pages/window/[asset].webp.ts` | 只接受 published、显式允许、可完整解码的本地栅格照片。缺失/损坏/外链排除并警告；使用现有 images slug/详情。生成 640/1200/1800px WebP，去除 EXIF，不需要服务器端运行服务。 |
| `src/lib/flavor-selection.mjs` / `window-client.ts` | 浏览器设备本地时间，北半球气象四季仅为展示约定；时间+季节权重 6，单项 3，其他 1。手动换图排除上一张，会话存储失败正常退化；定时器仅刷新问候，不轮播。 |
| `src/components/WindowPhoto.astro` / `RecentNotes.astro` / `src/styles/flavor.css` | 顶部增量插入；固定照片框 + contain 完整展示主体；无候选无巨幅空槽。最近独立省略空行，全空隐藏。保留原首页所有区块与顺序。 |
| `src/pages/index.astro` / `src/pages/images/index.astro` | 首页和既有影像流复用同一候选池、同一详情路径；无新相册/顶级导航。 |
| `src/content/site/settings.json` / `src/lib/site-settings.mjs` | 单一、严格校验的内容 JSON：recent 仅 doing/listening/thinking；music 仅标题、歌手、说明、来源。没有自动伪造更新时间或近况。 |
| `src/pages/admin/settings.astro` / `src/lib/admin/site-settings-client.ts` / `AdminSidebar.astro` | 设置入口读取精确 Git blob；沿用云端私有草稿/CAS、IME 保护、备份、文字内容预览和现有 PR 提案流程。无前端管理员令牌；未知写入结果不自动重试。没有增加数据库或认证体系。 |
| `ops/admin-broker/content-reader.mjs` / `policy.mjs` | 仅增加 `src/content/site/settings.json` 精确读写路径；拒绝任意 JSON、无效 URL、超长/未知字段和删除设置文件。没有修改线上权限、自动合并配置或发布工作流。 |
| `src/lib/admin/resource-editor-client.ts` / `photo-upload.ts` | 在现有影像编辑页增加 window 的选择/短句字段。新上传照片通过浏览器像素缓冲区移除 EXIF/GPS、最长边 4096px WebP；其他项目上传流程不改。若直接通过 Git 添加原图，仍应先清除原图元数据；窗口衍生图的去元数据不能替代原文件处理。 |
| `src/components/MusicCard.astro` / `src/pages/about.astro` / `public/music/*.mp3` | 仅关于页，原生 audio controls、preload=none、无 autoplay；点击后播放/暂停，离页停止；失效来源显示失败，无来源保留文字并隐藏操作。Artist 按 Owner 提供文件名 Angelika Vee，不另行指定录音版本/封面。 |
| `package.json` / lock | 将 Astro 已带有的 sharp 0.35.5 声明为直接依赖，供图片解码/去元数据/多尺寸构建；没有引入轮播库、后台或额外运行服务。 |

4. **验收证据**

| 检查 | 结果 / 证据 |
| --- | --- |
| 基线 `npm run check` | 类型 0 error；182 pass / 2 skip，[baseline-check.txt](baseline-check.txt) |
| 最终 `npm run check` | 类型 0 error / 0 warning；188 pass / 2 skip，[check.txt](check.txt)。2 个跳过项是已有真实 OAuth2/OIDC 网关环境验收，本轮不伪称通过。 |
| `npm run build` | Pages 本地构建和 Pagefind 成功，[build-pages.txt](build-pages.txt) |
| `VPS_INDEXING_PROFILE=production SITE_URL=https://tkkdy.me npm run build:vps` | 本地 VPS 正式配置构建成功，未执行部署，[build-vps.txt](build-vps.txt) |
| `ADMIN_SITE_URL=http://127.0.0.1:19544 npm run build:admin` | 私有编辑台本地构建成功，[build-admin.txt](build-admin.txt) |
| `node scripts/build-flavor-fixtures.mjs` | 临时创建带醒目标注的测试像素/文案，构建 fixture-pages/fixture-vps/no-source，finally 恢复真实配置并删除临时内容。日志 `build-fixture-*.txt`。 |
| `node tests/flavor.browser.mjs` | 双站 1440/1024/390/320、原模块顺序、0/1/多图、手动不立即重复/会话保持、无 JS、键盘/减少动效、缺图和音源 404、合法附件 MP3 点击播放/暂停/离页、无源卡、独立留空字段均通过。67 张公开页面截图（另含 4 张编辑台、3 张线上只读截图），[browser-results.json](browser-results.json)。测试播放时音量设为 0，证明解码/播放行为，未声称真人听感验收。 |
| 凌晨边界 | 上海和洛杉矶本地 23:59/00:00/04:59/05:00 全通过；准确文字“这么晚还不睡，早点睡觉哦。”。同一页面跨 05:00 只收起问候，不切照片。 |
| `node tests/flavor-season.browser.mjs` | 两个浏览器时区 8/31→9/1 的季节/加权选择实际通过，[season-browser-results.json](season-browser-results.json)。 |
| `node tests/flavor-editor.browser.mjs` | 真 Chromium + 真本地 Broker + 真 SQLite：匿名拒绝、读取、草稿保存、独立 Cookie 会话恢复、冲突保护、预览 XSS 拒绝、下载备份、只写精确 JSON 的提案；320px 照片元数据编辑和去除测试 GPS/设备信息通过。[editor-browser-results.json](editor-browser-results.json)。GitHub OAuth/API 为模拟，未向线上提交这些测试内容。 |
| `PAGEFIND_TEST_SITE=.flavor-builds/pages PAGEFIND_TEST_BASE=/tkkdyyy.github.io/ PAGEFIND_TEST_BROWSER=chrome node tests/pagefind-chinese.browser.mjs` | 现有真实搜索 UI / 索引回归通过，[search-pages.json](search-pages.json)。 |
| `git diff --check` | 提交前通过。生产发布配置和既有内容 Markdown 未更改。 |

文本日志仅去除行尾空格，原始输出字节保留于 [raw-logs.zip](raw-logs.zip)。

[全部截图索引](SCREENSHOTS.md)，含真实配置/隔离测试/线上只读/本地编辑台的证据范围；[素材哈希与测试清理](media-evidence.json)。截图使用 Chromium 视口模拟，非实体手机。无 JS 时显示构建期安全首图，随机与本地时间问候降级；原内容仍可读。没有向外发送访客时间、时区或位置。

5. **问题和止损**

- 当前没有满足条件的真实照片，不能验收“真实生活瞬间”的内容效果。测试像素/日期/地点/近况均标注为测试，未进入正式内容配置。没有替 Owner 勾选任何照片。
- 原摄影占位问题在线上仍真实存在：匿名首页 6 个 CSS 占位（包含其他区块），影像页 3 个图片占位。本轮保留并明确记录，不把新窗口当作摄影问题已经修好。#31 的摄影修复仍需单独复审/整合。
- 线上编辑台尚未部署新设置页/Broker 代码，也未真实登录、保存/发起线上设置 PR。这里交付代码和本地闭环证据，不能写成“editor 已接通上线”。需要 Owner 批准后再做受控编辑台发布和真实账户验收。
- MP3 按 Owner 本轮明确授权使用，未抓取第三方素材；哈希与附件一致。未做外部版权/平台审核，也未在生产替换任何音源。
- 浏览器测试发现过音源 404 后 pause 事件覆盖错误提示的问题，已经修复并复验；[修复前失败记录](audio-404-before-fix.json) 保留。另修复了视觉检查发现的窗口/最近之间多余留白。验收脚本早期的 CLI 路径、隐藏文字和选择器问题已修正，不当作产品通过证据。

6. **Owner 需要决定**

- 选择哪些原创照片允许用于窗口、哪些日期/地点可公开。没有照片时保持隐藏是预期行为。
- 填写/确认三项真实近况，或继续留空。
- 复审桌面/手机视觉、当前音源卡展示，以及 #31 与本 PR 的后续整合顺序。
- 本轮没有请求或取得最终上线批准。编辑台发布/真实账号验收以及正式站合并/上线留待明确批准后执行；不需要重新批准已经授权的本地开发、提交和 Draft PR。

7. **交付与回滚**

- 分支：`codex/website-flavor-20261102`；提交和 Draft PR 以 GitHub/最终交付消息为准，禁止自动合并。
- 证据包目录：`docs/flavor-review/`；当前任务 handoff：`.ai/handoffs/website-flavor-20261102.md`。
- 未合并前关闭 Draft PR 即可放弃候选，生产无须回退。将来如已批准合入，需要独立生成 revert PR 并验证；不直接重写 main。音乐可将 source 清空退回纯文字卡；窗口可关闭全部 enabled。编辑台若将来发布，应继续沿用其不可变版本回退机制，禁止改动生产私有草稿数据库。

复现：先安装锁定依赖，执行 check / build / build:vps / build:admin；将各正常构建保留于 `.flavor-builds/pages` 与 `.flavor-builds/vps`，然后运行 fixture 构建器及三个 `flavor*.browser.mjs`。fixture 构建器只生成在本地，不应向生产发布 fixture 产物。所有测试服务器只监听回环地址，脚本结束自动停止。
