# Gemini Canvas Generation Notes — Final v1

## Runtime

- Gemini model：3.1 Pro
- Thinking mode：Pro 扩展思考
- Tool：Canvas
- Browser path：Playwright MCP fallback
- Fallback reason：当前会话没有 Browser plugin / browser skill
- Image Gen：未使用
- Chat：<https://gemini.google.com/app/026957cc5fe3fc09>

用户已明确授权把本任务中的 Final v1 设计要求和六个项目原型数据发送给 Google Gemini。未发送 Production 源码、凭证或其它私有文件。

## First pass review

第一版正确保留了：

- Direction C controlled irregularity
- 六种不同 anatomy
- 浅色 front / 深色 back
- 真实 3D flip 与 aria-pressed
- neutral cool background

发现的问题：

- 使用 cdn.tailwindcss.com，不符合 self-contained 约束。
- Intro 图形与 Morning Radar 多重波形同时进入首屏，科技视觉密度偏高。
- Morning Radar 背面 lifecycle 没有完整呈现中英文状态。

## Controlled revision 1

- 完全移除 Tailwind CDN，重写为 vanilla CSS。
- 收敛 Intro 图形透明度。
- Morning Radar 从三条波形减为一条 hairline arc。
- 恢复 Developing · 开发中。
- 保持原有构图、尺寸、错位和 540ms flip。

## Controlled revision 2

- Desktop Hover 从 4° tilt 改为完整 rotateY(180deg)。
- 为六个 front 补齐最小 metadata。
- 长中文项目的 dark back 补回项目名称。
- 文档语言改为 zh-CN。

## Local fidelity fixes

本地拆分 HTML/CSS/JS 后只做了两个明确来自用户要求的响应式修正：

1. 430/390 Header 收敛为 VDVXDV + 搜索。
2. Hover 翻面限定在 min-width: 768px，避免窄屏精细指针环境下 Hover 与 second Tap 竞争。

其它视觉、copy、DOM 与 motion 均保持 Canvas 版本。

