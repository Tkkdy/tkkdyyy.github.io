# Gemini Canvas Generation Notes

## Runtime

- Browser path：Playwright MCP fallback
- 原因：当前会话没有 Browser plugin / browser skill
- Gemini mode：3.1 Pro + Pro 扩展思考
- Tool：Canvas
- Image Gen：未使用

完整工程文件上传 Gemini 被安全审查拒绝，因此只使用最小化、去敏后的文字 Brief：用户已提供的 Projects 事实、VDVXDV 品牌 token、真实 Morning Radar 字段和明确标记的 Prototype fixtures。没有向 Gemini 上传源码、内部文档或设计资产。

## Direction A

- Chat：<https://gemini.google.com/app/1f95d5819eefe0ab>
- 初版问题：Header 被改成普通横向导航；栏目标题更像方向说明。
- 修订：恢复 floating glass pill 语境、使用 `Projects.`、补充 focus-visible 和移动端导航收敛。
- 保存源：`direction-a-canvas.html`

## Direction B

- Chat：<https://gemini.google.com/app/5732533ddc6e181e>
- 初版问题：后半区出现 `LIFECYCLE / PROJECT TRACE / CONTEXT & LINKS` 三列表头，接近数据库。
- 修订：移除表格式列头，保留 Current Workshop，把其余项目改为开放式 Notes & Archives。
- 保存源：`direction-b-canvas.html`

## Direction C

- Chat：<https://gemini.google.com/app/aecaf76b4858e7da>
- 初版问题：Fixture 标记不一致、部分字段缺失、局部接近 bordered card grid、Search 被替换成图标。
- 修订：统一 `PROTOTYPE ONLY`、补齐 description/tech/link 状态、打开容器边界、恢复文字搜索与移动导航。
- 保存源：`direction-c-canvas.html`

Canvas HTML 保留为生成来源；各 Direction 目录中的 `index.html` 和 `styles.css` 是用于本地 QA 的拆分版本。

