# VDVXDV Projects Homepage Final v1

本目录是 /projects/ 栏目首页的唯一 Final v1 视觉原型。它仍属于设计验收阶段，不是 Production，不包含 Astro Migration，也没有设计 Project Detail。

直接入口：打开 [index.html](index.html)，或把本目录作为静态服务器根目录后访问 /。

## DESIGN DEFINITION

Create a controlled-irregular editorial archive of digital projects: human in typography, precise in structure, restrained in technology, with each project behaving like a distinct physical surface—light on the front, dark and richer on the back—while preserving the playful, fused composition of Direction C.

## SOURCE

- Direction C：页面骨架、受控不规则、不同 project anatomy、融合式 editorial composition。
- Direction A：顶部 English lead + Chinese explanation + small technical marker。
- Direction B：独立的 serif ending。
- User feedback：覆盖所有历史视觉决策。
- Gemini：3.1 Pro、Pro 扩展思考、Canvas。
- Gemini chat：<https://gemini.google.com/app/026957cc5fe3fc09>
- Browser path：Browser plugin 不可用，因此使用 Playwright MCP 专用 Chrome。
- Image Gen：未使用。

## LAYOUT

桌面端通过不等宽、不等高、左右错位和局部负 margin 保留 Direction C 的 controlled irregularity：

- Morning Radar：85% 宽的主要当前项目。
- Repository Atlas：65% 宽并向右错位，与主项目局部融合。
- 长标题项目：70% 宽、偏左、以 typography 为主。
- Quiet Relay：横向全宽 surface。
- Local Index / Signal Cabinet：48% / 45% 的不对称并列，后者向下错位。

它不是相同尺寸的 Card Grid，也没有整理成 Bento。

## PROJECT SURFACES

每个项目都有轻微不同的 cool surface、局部细边或 2–4px identity accent。差异只用于识别项目，不表达生命周期。

项目之间保持融合式页面节奏，但通过下面的手段维持清楚边界：

- pale gray / blue-gray / lavender-gray / green-gray 的低差异底色
- 1px hairline 与局部 top / left / bottom strip
- 不同宽高与 typography anatomy
- 无大阴影，圆角仅 2px

Header 是唯一明显圆润的 Floating Pill。

## FLIP

- Front：浅色 surface、深色文字，包含编号、名称、tagline 和最小 metadata。
- Back：near-black surface、warm-white 文字，包含项目说明、status、tech、updated 和可选 link indicator。
- Desktop Hover：完整 rotateY(180deg) 预览背面。
- Click：切换并保持 .flipped 状态，再次点击恢复。
- Keyboard：Tab focus；Enter / Space 切换；aria-pressed 同步更新。
- Mobile：小于 768px 时不使用 Hover 规则，Tap / second Tap 完整切换。
- Duration：540ms，标准 cubic-bezier，无 bounce、elastic、glow 或 360° spin。
- Reduced Motion：移除 3D transform，以 opacity 状态切换保证内容仍然可访问。

## TECHNOLOGY

Technology is punctuation, not the paragraph.

- Intro 只保留极淡的 grid + circle + one point。
- Morning Radar 只有一条细 signal arc。
- Repository Atlas 只有 24px node trace。
- Quiet Relay 只有三个 tiny dots。
- Local Index 的 code fragment 本身就是视觉。
- 长标题项目和 Signal Cabinet 不使用 illustration。

项目名称和 project identity 始终比科技装饰更先被注意到。

## MOTION READY

DOM 保持 project-container → project-surface → front / back 结构。未来可以在不改写内容结构的情况下增加：

- reveal 与 opacity sequencing
- 极轻量 tilt
- local accent transition
- visual scale / grid fade
- transform-based text movement

必要信息不依赖未来 motion。

## MOBILE

430px 与 390px 使用单列 editorial rhythm：

- Header 只保留 VDVXDV 与搜索。
- 六个 surface 宽度一致以避免溢出，但保留六种不同高度、局部边界和内容 anatomy。
- Intro tech visual 在移动端隐藏。
- 长中文项目名和深色背面都在容器内正常换行。
- Tap 不锁定滚动，第二次 Tap 恢复正面。

## PROTOTYPE DATA

- Morning Radar = **REAL PRODUCTION DATA**
- Repository Atlas = **PROTOTYPE-ONLY**
- 一套面向长期个人知识工作的上下文编排实验 = **PROTOTYPE-ONLY**
- Quiet Relay = **PROTOTYPE-ONLY**
- Local Index = **PROTOTYPE-ONLY**
- Signal Cabinet = **PROTOTYPE-ONLY**

页面上不显示抢眼的 PROTOTYPE ONLY QA badge；fixture 边界只在本 README 中声明。不得把这些 fixture 迁移到 Production Content。

## QA

已验证：

- 1440 × 1000
- 430 × 932
- 390 × 844
- Gemini Canvas native preview：1135 × 755
- Hover / Click / second Click
- Tap / second Tap
- Tab / focus-visible / Enter / Space
- prefers-reduced-motion: reduce
- 0 horizontal overflow
- Local console：0 errors / 0 warnings
- 仅加载本地 HTML、CSS、JS；无 CDN、网络图片或远程字体

详细证据见 [qa/FIDELITY_LEDGER.md](qa/FIDELITY_LEDGER.md)。

## BOUNDARY

- NO PRODUCTION CHANGES
- NO ASTRO MIGRATION
- PROJECT DETAIL NOT DESIGNED

