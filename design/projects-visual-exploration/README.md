# VDVXDV Projects Visual Exploration

本目录只包含 `/projects/` 栏目首页的视觉探索原型。它不是 Production，不修改 Astro、Content Collection、Header、Footer、Homepage 或 Project Detail。

三套方案均由 Gemini 3.1 Pro 的 Pro 扩展思考模式与 Canvas 生成初稿，再经过 Codex 审查、定向修订、文件拆分和浏览器 QA。

## 快速入口

- [Comparison Hub](compare/index.html)
- [Direction A — Editorial Project Archive](direction-a/index.html)
- [Direction B — Living Workshop](direction-b/index.html)
- [Direction C — Digital Artifacts](direction-c/index.html)

## 共同事实边界

### Real production data

只有 Morning Radar 是真实 Production Project：

- Name：Morning Radar
- Tagline：为个人筛选每天真正值得关注的变化。
- Description：一个自动收集、筛选和整理过去二十四小时重要信息的个人晨报系统。将碎片化的信息流转化为高质量、可阅读的结构化上下文。
- Lifecycle：Developing · 开发中
- Tech：Python / LLM
- Updated：2026-08-05
- 当前没有 cover、logo、liveUrl、githubUrl、startedAt、screenshots 或 changelog

### Prototype-only fixtures

其余五个项目只用于测试多项目、长标题、不同 lifecycle、不同 tech 长度和外链组合。每一项在页面中都明确标记为 `PROTOTYPE ONLY`：

- Repository Atlas
- 一套面向长期个人知识工作的上下文编排实验
- Quiet Relay
- Local Index
- Signal Cabinet

这些 fixture 不得迁移到 Production Content。

## Direction A — Editorial Project Archive

### 核心概念

把 Projects 理解为一本持续增加的个人项目档案册。项目以编号和更新时间自然展开，强调 Record、Index 与长期积累。

### 信息组织

- 左侧：编号、更新时间、Prototype 标记
- 右侧：Name、Tagline、Description
- 底部 trace：Lifecycle、Tech、可选外链
- 所有项目基本平等，按时间形成阅读节奏

### Featured 处理

不建立 Featured Hero。Morning Radar 只因排序与真实数据位于第一项。

### Status 处理

Lifecycle 是低强度的 Mono trace，不使用彩色大 Badge。

### Tech 处理

Tech 是第三层信息，与 Lifecycle 位于同一条轻量 trace 中。

### 最大优点

结构稳定、扩展到更多项目时仍清楚，最接近“长期个人项目档案”的定位。

### 最大风险

如果 typography 与间距控制不当，可能退化成接近 Articles 的普通条目列表。

## Direction B — Living Workshop

### 核心概念

把 Projects 理解为仍在工作的个人工作室。重点不是完成品，而是项目处于怎样的生命阶段。

### 信息组织

- Morning Radar 独立成为 Current Workshop
- 左侧是克制的 process grid / marginalia
- 右侧是主项目的 Name、Tagline、Description
- 后续项目进入开放式 Notes & Archives 记录流
- 不使用 Dashboard、进度条、筛选器或状态表

### Featured 处理

Morning Radar 明显突出，但不复制 Homepage 的深色项目带，也不依赖 cover。

### Status 处理

Lifecycle 为中等强度：Ruby dot、文字与边缘批注共同表达当前状态。

### Tech 处理

Tech 留在 process metadata 和各条 note 的尾部，不成为视觉主体。

### 最大优点

最直接表达“这个人在持续做东西”，Current Work 与历史记录的关系清楚。

### 最大风险

如果 process trace 继续增加，容易滑向项目管理 UI 或数据库。

## Direction C — Digital Artifacts

### 核心概念

把每个 Project 视为一个被制作出来的数字物件。不同项目拥有不同的排版 anatomy 和空间身份。

### 信息组织

- Morning Radar 是跨栏主 Artifact
- 后续项目使用不同宽度、局部规则、编号和抽象 CSS identity
- Name、Tagline、Description、Lifecycle、Tech、Updated 和 Links 仍保持完整
- 视觉差异来自 typography composition，不来自虚构截图或营销 mockup

### Featured 处理

Morning Radar 是较强主 Artifact，其余项目保持不同但受控的身份。

### Status 处理

Lifecycle 可以比 A 更可见，但仍限制在小型文字与 dot 中。

### Tech 处理

Tech 与不同 Artifact anatomy 结合，仍是辅助层。

### 最大优点

Project identity 最强，与 Articles 的书页式阅读差异最明显。

### 最大风险

如果容器或视觉块继续增加，可能接近 Portfolio Card Grid、Bento 或 Behance 展示墙。

## Possible Synthesis

这些只是未来可能组合的观察，不是 Final v1 决策：

- A 的稳定档案骨架可以承载更多真实项目。
- B 的 Current Workshop 适合表达当前正在生长的项目。
- C 的局部 Artifact identity 可以用于少量重点项目，而不必覆盖全部列表。
- 三套共同保留：真实 Header 语境、暖象牙白、细线、Ruby accent、近直角、Mono metadata 与克制交互。

是否组合、组合多少，以及哪套成为基础，等待用户人工审美选择。

## Interaction boundary

- Project 主入口均指向 `#detail-deferred`
- 本目录没有 Project Detail Prototype
- Hover / focus 只使用轻微颜色、下划线、透明度或 1–3px 位移
- 没有外部图片、AI screenshot 或不存在的 Production asset path

## Local review

在项目根目录启动任意静态服务器，并把根目录指向：

```text
design/projects-visual-exploration
```

优先从 `/compare/` 进入，再依次查看 A、B、C。正式 QA 视口为 1440px、430px 和 390px。

