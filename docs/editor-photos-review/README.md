# 私人编辑台：照片与近况（2026-11-03）

基于 main `559cc4ff9cafb7846fd3de3380f08d8c6ca8db08` 的独立分支。生产私人编辑台尚未更新，本轮没有上传 Owner 照片、填写 Owner 近况或实际发布内容。

## 行为

- 导航「照片」→ 上传新照片：预览、标题、读屏说明、短句、可选拍摄日期/公开地点；更多信息包含网址标识、标签、系列。上传限制 8 MB；复用浏览器 WebP 转换，最大边 4096，去除原始 EXIF/GPS/设备元数据（照片像素中的信息仍需自己确认）。
- 自动保存到原有服务器 SQLite 私有草稿，跨设备恢复和版本冲突保护。默认不参加首页「一扇窗」，手动勾选后可选时段、季节、窗边短句；不推断地点或拍摄日期。
- 「发布照片」才创建既有 GitHub 提案，提交图片与 Image Collection Markdown；等待既有 CI/合并/发布流程。点击后相关图片和文字会进入公开仓库，不能视为继续私有。私有草稿本身不写入仓库。
- 导航「近况」：独立维护「在做什么 / 在听什么 / 在想什么」，每项可留空，保留现有音乐配置；支持私有自动保存、文字预览、备份、发布。
- 请求前保存发布意图；成功或结果未知后禁止重复点击/刷新重发。已确认合并的内容可从仓库条目重新编辑；未知结果先查提案与历史，必要时下载备份后在草稿管理中处理。
- 修正照片/近况草稿恢复入口，并保留原有文章编辑与现在线上文章末尾提醒。

## 验证

- `npm run check`：191 项，189 通过、2 个原有外部 OIDC 检查跳过；Astro 无错误。
- `ADMIN_SITE_URL=http://127.0.0.1:19544 npm run build:admin`：通过。
- `npm run build`：公开 Pages 构建通过。
- `node tests/editor-photos.browser.mjs`：5 组通过。真实本地 Edge、Broker、SQLite；1440/390px 截图，照片编辑补验 320px 无横向溢出；匿名访问拒绝、草稿无 GitHub 写入、跨会话恢复、409 冲突、EXIF 去除、显式发布、异常请求后刷新不重发、近况保留音乐、恢复入口。
- `EDITOR_EVIDENCE_DIR=.flavor-builds/editor-regression node tests/flavor-editor.browser.mjs`：原有编辑台 4 组浏览器回归通过。
- OAuth/GitHub API 上游全部为明确标识的合成测试响应，图片为测试生成的纯色图，不是 Owner 摄影。截图出现的「已连接」是本地合成登录；不代表生产 OAuth 或公开发布已验收。
- 尚未执行：真实登录私人编辑台、生产 Broker 更新、真实照片/近况发布、真实手机 Safari。公开两站本轮未更新。

## 截图

[桌面照片编辑](screenshots/photo-editor-desktop.webp) · [手机照片编辑](screenshots/photo-editor-mobile.webp) · [手机照片列表](screenshots/photo-library-mobile.webp) · [手机近况](screenshots/recent-mobile.webp)

当前生产编辑台是较早的独立发布版本，不能只替换 HTML 就宣称功能已上线。获准部署时需一起更新现有 Broker 中 Collection/设置支持，保留认证配置、SQLite 草稿、文章末尾提醒与可回退发布目录，不修改公网站点配置。
