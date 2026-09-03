# VDVXDV Articles Visual Exploration

本目录是 Articles 的非生产视觉探索。三套方向由 Gemini 3.1 Pro（扩展思考）在 Google Canvas 中生成，Codex 只做了独立页面拆分、离线字体回退、链接整理与浏览器检查；没有把这些页面迁移进 Astro。

## Final v1 Candidate

`final-v1/` 是人工评审 A / B / C 后形成的唯一收敛候选，不是新的第四方向。B 已停止采用；Final v1 使用 A 的信息结构与 C 的空气感、留白和正文阅读气质，并加入窄正文、宽媒体与双图并置的文章叙事系统。

- `final-v1/index.html`：Articles 列表综合版。保留 `Articles.`、单条栏目分隔线，以及 `NO. + Serif Italic Date / Title + Short Summary / Tags + Domain` 的松弛桌面秩序；Article Item 之间没有横线、卡片或背景块。
- `final-v1/article.html`：以 C Detail 为主体的长文详情页，正文宽度约 700px，包含普通宽度媒体、约 1000px Wide Media、桌面双图与移动端纵向堆叠。
- `final-v1/styles.css`：Gemini Canvas Final v1 的独立共享样式，使用系统字体回退后可离线浏览。

本轮没有添加正式 VDVXDV Micro Icon，也没有使用通用图标代替。当前无 Icon 状态本身完整；未来可在标题结构中增加小型 icon slot，而不改变现有信息网格。

## 快速入口

- `index.html`：Comparison Hub。
- `a-independent-editorial/`：方向 A「现代独立出版物」列表页与详情页。
- `b-personal-archive/`：方向 B「理性个人档案」列表页与详情页。
- `c-quiet-reading-room/`：方向 C「安静阅读空间」列表页与详情页。
- `gemini-canvas-source.html`：Gemini Canvas 下载的原始单文件原型，保留六视图切换器作为设计来源记录。
- `styles.css`：从 Canvas 原型抽出的共享样式；不依赖网络字体也可运行。
- `final-v1/`：A 的信息结构与 C 的阅读气质综合形成的 Articles v1 Candidate。

## 三个方向为什么不同

1. A 以编辑网格、期号、编号和侧栏元数据塑造“出版物”；列表承担封面目录感，详情采用非对称版面。
2. B 以索引、年份、字段表和等宽标签塑造“档案系统”；信息密度最高，适合检索与长期积累。
3. C 以窄栏、衬线字、弱元数据和大量留白塑造“阅览室”；视觉噪声最低，阅读节奏最慢。

## 可混合元素

- 推荐以 A 的列表层级为主，吸收 B 的年份/字段可检索性。
- 详情正文可采用 C 的窄栏和留白，同时保留 A 的元数据侧栏作为桌面增强。
- B 的代码块、表格与档案标识适合技术文章，但不建议把整套高密度语言带入所有文章。

## 内容与状态

真实夹具标题为《上下文正在成为个人 AI 的真正界面》，其余列表项用于版式压力测试并标注为 Layout Sample。每套详情页都覆盖标题、描述/元数据、H2/H3、段落、粗体/斜体、链接、行内代码、列表、引语、TypeScript 代码块、表格、图像占位与图注、分隔和结尾。

本目录是可直接浏览的静态 HTML/CSS 原型，不是生产组件。Header / Search / Footer 只做静态继承，不代表正式重设计。

## 浏览方式

从 `index.html` 进入，或使用任意静态服务器以本目录为根目录打开。目标检查尺寸：1440 Desktop、430 Mobile、390 Mobile。
