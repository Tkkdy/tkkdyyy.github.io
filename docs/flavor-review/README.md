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

Owner 后续明确要求“打开关于页面就直接淡入音乐”，覆盖原任务书的点击后播放约束。最终卡片以 Owner 提供的紧凑两行参考图为准：左侧圆形播放键与歌名同排，下方进度/音量，颜色明确继续淡蓝纯色；这覆盖此前“播放键放左下角”的中间方案。当前实现按此新要求自动请求有声播放，遵守浏览器策略；不修改生产浏览器权限。

| 路径 | 行为 |
| --- | --- |
| `src/content.config.ts` / `public/admin/config.yml` | images 增加可选 window 对象，enabled 默认 false；时段必须明确标注，未知标签忽略；没有从拍摄日期推断拍摄时刻。 |
| `src/lib/content/window.ts` / `image-file.mjs` / `src/pages/window/[asset].webp.ts` | 只接受 published、显式允许、可完整解码的本地栅格照片。缺失/损坏/外链排除并警告；使用现有 images slug/详情。生成 640/1200/1800px WebP，去除 EXIF，不需要服务器端运行服务。 |
| `src/lib/flavor-selection.mjs` / `window-client.ts` | 浏览器设备本地时间，北半球气象四季仅为展示约定；时间+季节权重 6，单项 3，其他 1。手动换图排除上一张，会话存储失败正常退化；定时器仅刷新问候，不轮播。 |
| `src/components/WindowPhoto.astro` / `RecentNotes.astro` / `src/styles/flavor.css` | 顶部增量插入；固定照片框 + contain 完整展示主体；无候选无巨幅空槽。最近独立省略空行，全空隐藏。保留原首页所有区块与顺序。 |
| `src/pages/index.astro` / `src/pages/images/index.astro` | 首页和既有影像流复用同一候选池、同一详情路径；无新相册/顶级导航。 |
| `src/content/site/settings.json` / `src/lib/site-settings.mjs` | 单一、严格校验的内容 JSON：recent 仅 doing/listening/thinking；music 仅标题、歌手、说明、HTTPS 来源。没有自动伪造更新时间或近况。 |
| `src/pages/admin/settings.astro` / `src/lib/admin/site-settings-client.ts` / `AdminSidebar.astro` | 设置入口读取精确 Git blob；沿用云端私有草稿/CAS、IME 保护、备份、文字内容预览和现有 PR 提案流程。无前端管理员令牌；未知写入结果不自动重试。没有增加数据库或认证体系。 |
| `ops/admin-broker/content-reader.mjs` / `policy.mjs` | 仅增加 `src/content/site/settings.json` 精确读写路径；拒绝任意 JSON、无效 URL、超长/未知字段和删除设置文件。没有修改线上权限、自动合并配置或发布工作流。 |
| `src/lib/admin/resource-editor-client.ts` / `photo-upload.ts` | 在现有影像编辑页增加 window 的选择/短句字段。新上传照片通过浏览器像素缓冲区移除 EXIF/GPS、最长边 4096px WebP；其他项目上传流程不改。若直接通过 Git 添加原图，仍应先清除原图元数据；窗口衍生图的去元数据不能替代原文件处理。 |
| `src/components/MusicCard.astro` / `src/lib/music-client.ts` / `src/styles/flavor.css` | Owner 最终参考图布局：淡蓝纯色 `#eaf2f8`、Georgia 经典衬线，浅色圆形播放键在歌名左侧，下方为进度/实际时长及静音/音量滑杆；常态只显示歌名和控件。打开即从屏幕左侧进入，1 秒；减少动态效果时静态展示。仅关于页，自动请求播放、2.4 秒淡入到默认 35%，遵守浏览器策略；支持键盘、拖动进度、暂停、静音、保留访客调整音量，离页停止。无 JS 回退原生控件；无源只保留歌名，404 显示错误。音源仍为已授权附件的固定 HTTPS Raw URL；MP3 留在 media/，不进入静态发布包。 |
| `package.json` / lock | 将 Astro 已带有的 sharp 0.35.5 声明为直接依赖，供图片解码/去元数据/多尺寸构建；没有引入轮播库、后台或额外运行服务。 |

4. **验收证据**

| 检查 | 结果 / 证据 |
| --- | --- |
| 基线 `npm run check` | 类型 0 error；182 pass / 2 skip，[baseline-check.txt](baseline-check.txt) |
| 调味初版 `npm run check` | 类型 0 error / 0 warning；188 pass / 2 skip，[check.txt](check.txt)。2 个跳过项是已有真实 OAuth2/OIDC 网关环境验收，本轮不伪称通过。 |
| `npm run build` | Pages 本地构建和 Pagefind 成功，[build-pages.txt](build-pages.txt) |
| `VPS_INDEXING_PROFILE=production SITE_URL=https://tkkdy.me npm run build:vps` | 本地 VPS 正式配置构建成功，未执行部署，[build-vps.txt](build-vps.txt) |
| `ADMIN_SITE_URL=http://127.0.0.1:19544 npm run build:admin` | 私有编辑台本地构建成功，[build-admin.txt](build-admin.txt) |
| `node scripts/build-flavor-fixtures.mjs` | 临时创建带醒目标注的测试像素/文案，构建 fixture-pages/fixture-vps/no-source，finally 恢复真实配置并删除临时内容。日志 `build-fixture-*.txt`。 |
| `node tests/flavor.browser.mjs`（前轮回归；最新卡片以音乐专项为准） | 双站 1440/1024/390/320、原模块顺序、0/1/多图、手动不立即重复/会话保持、无 JS、键盘/减少动效、缺图和音源 404、合法附件 MP3 点击播放/暂停/离页、无源卡、独立留空字段均通过。67 张公开页面截图（另含 4 张编辑台、3 张线上只读、1 张实际 HTTPS 音源截图），[browser-results.json](browser-results.json)。本地 UI 测试以附件原始字节模拟 CDN 响应；实际 HTTPS 音源另行真实验证（下行）。证明解码/播放行为，未声称真人听感验收。 |
| `node tests/flavor-music.browser.mjs`（最新卡片） | Pages / VPS、1440/390/320px 真 Chromium：淡蓝/Georgia/左侧按钮与标题排列；1 秒动效从视口左外进入；播放/暂停、实际跳转到约 50% 进度、键盘进度/音量、静音及恢复所选音量；减少动态效果、无 JS 原生回退、首次访问拦截、允许播放时 35% 淡入、真实 pagehide 和 404 均通过。CDN 以附件原始字节、本地 206 Range 响应；见 [Pages](music-autofade-pages.json)、[VPS](music-autofade-vps.json)。未验收实体手机、Safari 或真人听感。 |
| `node tests/flavor-music-source.browser.mjs` | 无音源模拟，实际点击播放及跳转到约 62 秒成功；时长约 124.233 秒，见 [music-card-https-seek.json](music-card-https-seek.json)；[真实入场/播放录像](music-card-entry.webm)。脚本要求本地预览运行，默认 4321，使用当前环境代理；录制依赖 Playwright ffmpeg。 |
| 音乐卡最终检查 | `music-card-types.txt` 类型检查通过；`music-card-node-recheck.txt` 188 pass / 2 skip；Pages / VPS 构建见 `music-card-build*.txt`。最初全测有一次既有 Windows Broker 启动就绪失败，单项和一次全量复验均通过，保留 `music-card-first-check.txt` 与 `music-card-launcher-recheck.txt`；未修改该启动器/测试。 |
| `node tests/flavor-audio-source.browser.mjs` | 实际固定 HTTPS 音源 200、5,105,577 字节/附件 SHA256 一致；真实 Chromium 不预加载、点击后播放/暂停通过，时长 124.233 秒。见 [audio-https-results.json](audio-https-results.json)。 |
| 凌晨边界 | 上海和洛杉矶本地 23:59/00:00/04:59/05:00 全通过；准确文字“这么晚还不睡，早点睡觉哦。”。同一页面跨 05:00 只收起问候，不切照片。 |
| `node tests/flavor-season.browser.mjs` | 两个浏览器时区 8/31→9/1 的季节/加权选择实际通过，[season-browser-results.json](season-browser-results.json)。 |
| `node tests/flavor-editor.browser.mjs` | 真 Chromium + 真本地 Broker + 真 SQLite：匿名拒绝、读取、草稿保存、独立 Cookie 会话恢复、冲突保护、预览 XSS 拒绝、下载备份、只写精确 JSON 的提案；320px 照片元数据编辑和去除测试 GPS/设备信息通过。[editor-browser-results.json](editor-browser-results.json)。GitHub OAuth/API 为模拟，未向线上提交这些测试内容。 |
| `PAGEFIND_TEST_SITE=.flavor-builds/pages PAGEFIND_TEST_BASE=/tkkdyyy.github.io/ PAGEFIND_TEST_BROWSER=chrome node tests/pagefind-chinese.browser.mjs` | 现有真实搜索 UI / 索引回归通过，[search-pages.json](search-pages.json)。 |
| 既有 `release_bundle.validate_site` | 最终本地 VPS 产物通过原样发布校验器，未携带 MP3、校验器未改动，见 [vps-static-validation.json](vps-static-validation.json)。 |
| `git diff --check` | 提交前通过。生产发布配置和既有内容 Markdown 未更改。 |

公开页面浏览器回归已按新要求复验；独立 HTTPS 音源脚本仍验证原生点击播放与传输字节，最新自动淡入行为以上述新增音乐专项验收为准。初版音乐日志为 `music-check.txt` / `music-build*.txt`；最终卡片检查和构建见 `music-card-types.txt`、`music-card-node-recheck.txt`、`music-card-build*.txt`。

文本日志仅去除行尾空格，原始输出字节保留于 [raw-logs.zip](raw-logs.zip)。

[全部截图索引](SCREENSHOTS.md)，含真实配置/隔离测试/线上只读/本地编辑台的证据范围；[素材哈希与测试清理](media-evidence.json)。截图使用 Chromium 视口模拟，非实体手机。无 JS 时显示构建期安全首图，随机与本地时间问候降级；原内容仍可读。没有向外发送访客时间、时区或位置。

5. **问题和止损**

- 当前没有满足条件的真实照片，不能验收“真实生活瞬间”的内容效果。测试像素/日期/地点/近况均标注为测试，未进入正式内容配置。没有替 Owner 勾选任何照片。
- 原摄影占位问题在线上仍真实存在：匿名首页 6 个 CSS 占位（包含其他区块），影像页 3 个图片占位。本轮保留并明确记录，不把新窗口当作摄影问题已经修好。#31 的摄影修复仍需单独复审/整合。
- 线上编辑台尚未部署新设置页/Broker 代码，也未真实登录、保存/发起线上设置 PR。这里交付代码和本地闭环证据，不能写成“editor 已接通上线”。需要 Owner 批准后再做受控编辑台发布和真实账户验收。
- MP3 按 Owner 本轮明确授权使用，未抓取第三方素材；哈希与附件一致。首轮 [CI 41420084445](https://github.com/Tkkdy/tkkdyyy.github.io/actions/runs/41420084445) 暴露现有 VPS 包白名单不接受 MP3；[失败日志](ci-mp3-packaging-failure.txt) 保留。本轮未改白名单/生产配置，而将素材移到非构建目录 media/，卡片采用已授权文件固定 Git 版本的 HTTPS Raw 来源。实际 URL 播放已验证，新增限制是依赖 GitHub Raw 的可用性/网络；将来仍可编辑为 Owner 确认的平台链接。未在生产替换任何音源。
- 新控件的最初 seek 失败来自本地 CDN 模拟缺少 HTTP Range 响应；[失败记录](music-card-seek-fixture-before-fix.json) 保留。补全 206/Content-Range 后，键盘/鼠标跳转与独立真实 HTTPS 音源跳转均通过；没有以模拟成功替代真实音源证据。
- 新增淡入实测发现过音量滑块与动画竞争，已在每一帧写音量前检查用户改动，修复并通过双站桌面/手机视口复验；[修复前记录](music-volume-before-fix.json) 保留。首次直接访问是否能响由浏览器策略决定，不能保证所有浏览器无点击即播放。
- 浏览器测试发现过音源 404 后 pause 事件覆盖错误提示的问题，已经修复并复验；[修复前失败记录](audio-404-before-fix.json) 保留。另修复了视觉检查发现的窗口/最近之间多余留白。验收脚本早期的 CLI 路径、隐藏文字和选择器问题已修正，不当作产品通过证据。

6. **Owner 需要决定**

- 选择哪些原创照片允许用于窗口、哪些日期/地点可公开。没有照片时保持隐藏是预期行为。
- 填写/确认三项真实近况，或继续留空。
- 复审桌面/手机视觉、音乐淡入速度/音量与实体手机听感，以及 #31 与本 PR 的后续整合顺序。
- 本轮没有请求或取得最终上线批准。编辑台发布/真实账号验收以及正式站合并/上线留待明确批准后执行；不需要重新批准已经授权的本地开发、提交和 Draft PR。

7. **交付与回滚**

- 分支：`codex/website-flavor-20261102`；提交和 Draft PR 以 GitHub/最终交付消息为准，禁止自动合并。
- 证据包目录：`docs/flavor-review/`；当前任务 handoff：`.ai/handoffs/website-flavor-20261102.md`。
- 未合并前关闭 Draft PR 即可放弃候选，生产无须回退。将来如已批准合入，需要独立生成 revert PR 并验证；不直接重写 main。音乐可将 source 清空退回纯文字卡；窗口可关闭全部 enabled。编辑台若将来发布，应继续沿用其不可变版本回退机制，禁止改动生产私有草稿数据库。

复现：先安装锁定依赖，执行 check / build / build:vps / build:admin；将各正常构建保留于 `.flavor-builds/pages` 与 `.flavor-builds/vps`，然后运行 fixture 构建器及相关 `flavor*.browser.mjs`。新增音乐专项默认使用 `dist` 的 Pages 构建；VPS 复现设置 `FLAVOR_MUSIC_ROOT=.flavor-builds/vps FLAVOR_MUSIC_BASE=/`。fixture 构建器只生成在本地，不应向生产发布 fixture 产物。所有测试服务器只监听回环地址，脚本结束自动停止。实际 HTTPS 音源测试使用当前环境代理；源本身是本轮已授权素材的固定版本。

最新位置调整：桌面宽度 >=1280px 时音乐卡固定于左上侧（left 24px / top 128px），正文居中、最大 624px；窄屏播放器移至正文上方正常文档流。仅调整 about 模板和样式，播放逻辑不变；Pages 构建通过，1920/1440/1280/1024/390/320 六视口无重叠或横向溢出，见 `music-rail-layout.json` 和 `music-rail-*.webp`。此记录覆盖先前嵌在正文中的位置截图；未新增动效，待 Owner 讨论。

最新动效覆盖前轮整卡滑入：卡片底色立即显示；歌名在卡片中央从左向右显现（0–0.9 秒），短暂停留后，1.2–2 秒歌名与控件一起上移，控件同时淡入。桌面卡片宽 340–440px、高 260px，>=1440px 固定左上；窄屏进入正文前正常文档流。减少动态效果直接展示最终状态，键盘聚焦立即结束动画以便操作。Pages 构建、类型检查、五种视口阶段状态检查通过；证据 `music-stage-results.json` / `music-stage-*.webp`，录像 `music-stage-entry.webm`。

比例与速度微调：宽屏 440×200px，手机示例 342×190px；减少底部空白。保留前 0.9 秒文字显现和 0.3 秒停留，最后上移从 0.8 秒缩短到 0.4 秒，总长 1.6 秒。Pages 构建、1920/390 视口比例/时序检查通过，见 music-proportion-results.json / music-proportion-*.webp；播放逻辑未改。

最新视觉候选（2026-11-02，暖色组合）：按 Owner 选图采用斜体随笔字体、B 浅色内嵌圆形播放键、C 细线 T 形进度滑块和 A 双线音量/竖胶囊滑块。纯色燕麦卡底 #EEE7DA、暖棕 #5C4A38，与页面底色协调；圆角 28px，桌面 440×250，390px 视口卡片 342×230。布局位置、1.6 秒分阶段入场及 35% 默认淡入保持。修复指针聚焦提前结束动画导致首次点击落空的问题，仅键盘聚焦提前显示控件。

本轮 Pages 构建、Astro 检查（0 errors / 0 warnings）及真实 Edge 音乐专项通过：1440/390/320px、播放/暂停、进度点击及键盘、音量/静音/恢复、首次自动播放拦截、站内导航允许播放、404、无 JS 和减少动态效果。手机为视口模拟；音源在专项中使用附件原字节响应，真实 HTTPS 的既有证据继续有效。本轮未重跑无关首页/编辑台全套检查。最新视觉以 music-oatmeal-1920.webp、music-oatmeal-390.webp 和 pages-music-card-design-*.webp 为准，旧蓝色截图与旧尺寸仅为历史。未合并、未部署，CI 以最新提交 Checks 为准。

2026-11-03 同站音源修订：Owner 要求将音频直接放入网站。已将同一份 5,105,577 字节授权 MP3 移至 public/music/，设置改为 /music/angelika-vee-you-are-my-sunshine.mp3，经 withBase 适配 Pages 子路径与 VPS 根路径；页面不再请求 GitHub Raw。音频在关于页 preload=auto，显示缓冲/浏览器自动播放拦截提示，允许播放时保持 2.4 秒淡入到 35%。首次直接访问仍可能被浏览器禁止有声自动播放，保留播放键，不伪装静音为有声成功。

发布包校验候选仅增加该 MP3 精确路径 + SHA256 的例外，未全局放开媒体类型；其他 MP3、改动字节仍拒绝，18 个发布包测试通过。没有修改生产配置、线上校验器或已批准的流水线 SHA；实际发布前仍需审查采用更新后的校验器，旧流水线会拒绝该文件。

本轮验证：npm run check 188 pass / 2 个已有 skip，类型 0 errors / 0 warnings；Pages/VPS 构建、双 base 真实静态 MP3 音乐专项通过，包含 404/键盘/进度/音量/无 JS/减少动态效果。实际预览同站字节哈希与原文件一致，进度跳转通过；预缓冲后点击到播放本次实测 397ms，仅代表本地 Edge。本地原 4321 Python 预览未支持音频 Range，所以保留原服务并新增支持 Range 的 Vite 静态预览 http://127.0.0.1:4323/tkkdyyy.github.io/about/ 。真实素材无模拟的播放/跳转录像和 JSON 已更新（历史文件名仍包含 HTTPS）。未部署，未合并。
