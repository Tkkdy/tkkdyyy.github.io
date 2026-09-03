# VDVXDV Personal Website — CONTENT_MODEL.md

- Version: v0.1
- Status: Draft for review
- Depends on: `PRODUCT.md`
- Scope: Articles, Essays, Fragments, Projects, Images and Home curation

---

## 1. 这份文件解决什么问题

`CONTENT_MODEL.md` 用来规定网站中的每一种内容：

- 是什么；
- 与其他内容有什么区别；
- 发布时需要填写哪些信息；
- 哪些字段必须填写；
- 哪些字段可以省略；
- 首页如何选择和排序内容；
- 网站如何在不修改页面代码的情况下增加内容。

目标是让以后新增内容时，主要工作变成：

1. 新建一个内容文件；
2. 填写顶部信息；
3. 编写正文或添加图片；
4. 提交到 GitHub；
5. 网站自动构建并发布。

不应该为了发布一篇文章、一条碎片或一张照片而修改页面组件代码。

---

## 2. 内容类型总览

网站包含五种主要内容类型：

| 内容类型 | 中文名称 | 完整程度 | 是否需要标题 | 典型内容 |
|---|---|---:|---:|---|
| `article` | 文章 | 高 | 是 | 技术博客、完整长文、教程、项目复盘 |
| `essay` | 随笔 | 中 | 是 | 较短但相对完整的小段文字，可穿插照片 |
| `fragment` | 碎片 | 低 | 否 | 即时想法、短记录、未完成观点、链接 |
| `project` | 项目 | 高 | 是 | 产品、工具、实验、作品及其开发过程 |
| `image` | 影像 | 单张内容 | 可选 | 一张照片及其拍摄信息、说明和展示状态 |

### 2.1 三种文字内容的区别

#### 文章 Article

文章是完整、结构化的长内容。

它可以包含：

- 多级标题；
- 长正文；
- 代码块；
- 表格；
- 图片；
- 引用；
- 技术图示；
- 目录；
- 参考链接。

#### 随笔 Essay

随笔是较短但相对完整的一段文字。

它可以包含：

- 标题；
- 几段正文；
- 一张或数张看起来“不一定直接解释正文”的照片；
- 情绪、观察、回忆或一个小观点。

随笔不要求像文章一样有完整论证，也不是缩短版技术博客。

#### 碎片 Fragment

碎片是即时、短小、可以保持未完成状态的内容。

它可以是：

- 一句话；
- 几句话；
- 一个突然想到的问题；
- 一条链接加简短评价；
- 一张图片加说明；
- 一个以后可能扩写成随笔或文章的想法。

碎片可以没有标题。

---

## 3. 所有内容共用的基础规则

### 3.1 稳定标识

每条内容必须拥有稳定且唯一的 `slug`。

`slug` 是内容网址中的名字，例如：

```text
/articles/context-is-the-new-interface/
```

其中：

```text
context-is-the-new-interface
```

就是 `slug`。

要求：

- 只使用小写英文字母、数字和连字符；
- 发布后尽量不要修改；
- 不包含真实姓名或隐私信息；
- 同一内容类型中不能重复。

### 3.2 发布状态

所有内容支持以下状态：

| 状态 | 含义 |
|---|---|
| `draft` | 草稿，不出现在公开网站 |
| `published` | 已发布，公开可见 |
| `archived` | 已归档，默认不在主要列表中展示，但链接可保留 |

V0.1 不需要复杂审核流程。

### 3.3 日期格式

日期统一使用：

```text
YYYY-MM-DD
```

需要具体时间时使用：

```text
YYYY-MM-DDTHH:mm:ss+08:00
```

例如：

```text
2026-08-05T02:30:00+08:00
```

### 3.4 标签

标签用于内容归类和搜索。

规则：

- 标签不是栏目；
- 标签数量应克制；
- 同一概念不要同时使用多个近义标签；
- 中文标签优先保持简短；
- 后续可以增加标签别名，不影响原有内容。

示例：

```yaml
tags:
  - AI
  - 个人网站
  - 技术思考
```

### 3.5 首页展示信息

可被首页选中的内容统一使用：

```yaml
homepage:
  show: true
  order: 1
```

含义：

- `show`：是否允许显示在首页；
- `order`：在同类首页内容中的顺序，数字越小越靠前。

后续可以加入：

```yaml
homepage:
  show: true
  order: 1
  title: "首页专用标题"
  summary: "首页专用摘要"
  image: "/images/home/example.jpg"
```

这些覆盖字段都是可选的，用于首页需要不同标题、摘要或图片时使用。

### 3.6 栏目精选和首页展示互相独立

`featured` 表示是否在所属栏目中精选。

`homepage.show` 表示是否显示在首页。

两者互不等同。

例如，一篇随笔可以：

```yaml
featured: true
homepage:
  show: false
```

这表示它会在“随笔”栏目中进入精选区，但不会出现在首页。

### 3.7 系统自动生成的信息

以下信息原则上由系统自动生成，不要求用户手动填写：

- 阅读时间；
- 正文字数；
- 图片宽高；
- 图片横竖方向；
- 页面永久链接；
- Open Graph 默认图片；
- 搜索索引文本；
- 发布后的构建时间；
- 内容列表中的排序索引。

用户可以在特殊情况下覆盖部分自动值，但默认不需要处理。

---

# 4. Article 文章模型

## 4.1 用途

用于：

- 技术博客；
- 完整长文；
- 教程；
- 项目复盘；
- 系统性观点；
- 带有代码、表格或技术图示的内容。

## 4.2 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `title` | string | 是 | 文章标题 |
| `slug` | string | 是 | 稳定网址标识 |
| `description` | string | 是 | 列表、搜索和分享时使用的摘要 |
| `publishedAt` | date | 是 | 首次发布日期 |
| `updatedAt` | date | 否 | 有实质更新时填写 |
| `status` | enum | 是 | `draft` / `published` / `archived` |
| `tags` | string[] | 否 | 内容标签 |
| `category` | string | 否 | 如“技术”“观察”“项目复盘” |
| `cover` | image path | 否 | 封面图或插画 |
| `coverAlt` | string | 条件必填 | 有封面时填写图片说明 |
| `featured` | boolean | 否 | 是否在文章栏目精选 |
| `homepage` | object | 否 | 首页展示设置 |
| `toc` | boolean | 否 | 是否显示文章目录，默认由文章长度决定 |
| `readingTime` | number | 否 | 默认自动计算，仅在需要时覆盖 |
| `body` | MD/MDX | 是 | 文章正文 |

## 4.3 示例

```yaml
---
title: "上下文正在成为个人 AI 的真正界面"
slug: "context-is-the-new-interface"
description: "当 AI 长期理解一个人的项目、文件、偏好和决定，它才开始成为真正的能力延伸。"
publishedAt: 2026-08-05
status: published
tags:
  - AI
  - 上下文
  - 个人助理
category: 技术思考
cover: "/images/articles/context-interface-cover.jpg"
coverAlt: "抽象的信息层与个人空间"
featured: true
homepage:
  show: true
  order: 1
toc: true
---

正文从这里开始。
```

## 4.4 无封面规则

文章没有 `cover` 时：

- 列表使用纯排版版本；
- 不显示空白图片框；
- 标题和摘要自动获得更宽的版面；
- 首页仍然可以正常展示。

---

# 5. Essay 随笔模型

## 5.1 用途

随笔是较短、相对完整、带有个人感觉的小段文字。

正文中允许穿插：

- 一张照片；
- 多张不规则照片；
- 插画；
- 与文字气氛有关但不承担解释责任的影像。

## 5.2 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `title` | string | 是 | 随笔标题 |
| `slug` | string | 是 | 稳定网址标识 |
| `publishedAt` | date | 是 | 发布日期 |
| `status` | enum | 是 | `draft` / `published` / `archived` |
| `tags` | string[] | 否 | 内容标签 |
| `cover` | image path | 否 | 列表或首页使用的封面/插画 |
| `coverAlt` | string | 条件必填 | 有封面时填写 |
| `readingTime` | number | 否 | 默认自动计算，可不显示 |
| `featured` | boolean | 否 | 是否在随笔栏目精选 |
| `homepage` | object | 否 | 是否显示在首页及排序 |
| `body` | MD/MDX | 是 | 正文及正文中的图片 |

## 5.3 示例

```yaml
---
title: "初中时，我只是想看 YouTube"
slug: "i-only-wanted-to-watch-youtube"
publishedAt: 2026-08-01
status: published
tags:
  - 互联网
  - 回忆
cover: "/images/essays/old-internet-room.jpg"
coverAlt: "昏暗房间里的旧电脑屏幕"
featured: true
homepage:
  show: true
  order: 1
---

我最初只是想看一些游戏实况。

![旧电脑桌上的灯光](/images/essays/old-desk-light.jpg)

后来却莫名其妙地搭建起了自己的整个互联网世界。
```

## 5.4 照片规则

随笔正文中的照片：

- 数量不固定；
- 可以大小不同；
- 可以横图、竖图混合；
- 可以带图注，也可以只提供无障碍替代文字；
- 不要求每张照片都与正文形成字面解释关系；
- 页面布局必须在没有任何照片时仍然成立。

---

# 6. Fragment 碎片模型

## 6.1 用途

用于短小、即时、未必完整的内容。

## 6.2 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `slug` | string | 是 | 可由日期和短标识生成 |
| `publishedAt` | datetime | 是 | 发布时间 |
| `status` | enum | 是 | `draft` / `published` / `archived` |
| `body` | string/MD | 是 | 短正文 |
| `tags` | string[] | 否 | 标签 |
| `image` | image path | 否 | 可选图片 |
| `imageAlt` | string | 条件必填 | 有图片时填写 |
| `link` | URL | 否 | 可选外部链接 |
| `linkTitle` | string | 否 | 外部链接的显示标题 |
| `homepage` | object | 否 | 是否在首页展示及排序 |

碎片不要求标题。

## 6.3 示例

```yaml
---
slug: "2026-08-05-context-compounds"
publishedAt: 2026-08-05T02:20:00+08:00
status: published
tags:
  - AI
homepage:
  show: false
---

上下文也许是这个时代最容易被低估的个人资产。模型会更新，工具会消失，但积累过的判断和经历仍然可以继续复用。
```

## 6.4 长度建议

V0.1 不做严格字数限制，但建议：

- 通常为一句到数段；
- 如果出现复杂章节结构，应考虑升级为随笔或文章；
- 碎片即使较长，也不强制改类型，最终由作者判断。

---

# 7. Project 项目模型

## 7.1 用途

项目可以是：

- 软件产品；
- 自动化工具；
- 技术实验；
- 视觉作品；
- 长期研究；
- 尚在构思中的公开计划。

## 7.2 项目状态

建议使用固定状态：

| 值 | 中文显示 |
|---|---|
| `concept` | 构思中 |
| `designing` | 设计中 |
| `developing` | 开发中 |
| `usable` | 可使用 |
| `maintaining` | 维护中 |
| `paused` | 暂停 |
| `completed` | 已完成 |
| `archived` | 已归档 |

## 7.3 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `name` | string | 是 | 项目名称 |
| `slug` | string | 是 | 稳定网址标识 |
| `tagline` | string | 是 | 一句话简介 |
| `description` | string | 是 | 列表和分享使用的完整摘要 |
| `status` | enum | 是 | 项目状态 |
| `cover` | image path | 否 | 项目封面 |
| `coverAlt` | string | 条件必填 | 有封面时填写 |
| `logo` | image path | 否 | 项目标志 |
| `techStack` | string[] | 否 | 技术栈 |
| `liveUrl` | URL | 否 | 在线体验地址 |
| `githubUrl` | URL | 否 | GitHub 地址 |
| `startedAt` | date | 否 | 项目开始时间 |
| `updatedAt` | date | 是 | 最近实质更新时间 |
| `featured` | boolean | 否 | 是否作为重点项目展示 |
| `homepage` | object | 否 | 首页展示设置 |
| `screenshots` | image[] | 否 | 项目截图 |
| `changelog` | entries[] | 否 | 更新日志 |
| `body` | MD/MDX | 是 | 完整项目介绍 |

## 7.4 项目截图结构

每张截图建议包含：

```yaml
screenshots:
  - src: "/images/projects/morning-radar/home.jpg"
    alt: "Morning Radar 首页晨报界面"
    caption: "每日晨报的主要阅读页面"
```

## 7.5 更新日志结构

```yaml
changelog:
  - version: "0.2"
    date: 2026-08-01
    summary: "扩展信息源并改进历史晨报展示"
  - version: "0.1"
    date: 2026-07-28
    summary: "完成可自动运行的基础版本"
```

当更新日志变得很长时，可以拆成单独内容文件，而不需要修改项目主模型。

## 7.6 示例

```yaml
---
name: "Morning Radar"
slug: "morning-radar"
tagline: "为个人筛选每天真正值得关注的变化。"
description: "一个自动收集、筛选和整理过去二十四小时重要信息的个人晨报系统。"
status: developing
cover: "/images/projects/morning-radar/cover.jpg"
coverAlt: "Morning Radar 晨报界面"
techStack:
  - Python
  - GitHub Actions
  - DeepSeek
  - GitHub Pages
liveUrl: "https://example.github.io/morning-radar/"
githubUrl: "https://github.com/example/morning-radar"
startedAt: 2026-07-20
updatedAt: 2026-08-05
featured: true
homepage:
  show: true
  order: 1
---

完整项目介绍从这里开始。
```

## 7.7 链接缺失规则

项目没有在线地址或 GitHub 地址时：

- 不显示空按钮；
- 页面仍然可以作为项目记录存在；
- 可以根据状态显示“构思中”“开发中”或“暂未公开”。

---

# 8. Image 影像模型

## 8.1 基本原则

影像采用单张照片流。

不是：

- 一个条目对应一本相册；
- 一个页面先列出相册封面；
- 必须凑齐一组照片才能发布。

而是：

> 每发布一条影像内容，核心就是一张照片。

后续可以通过标签、地点、年份或系列字段把相关照片聚合，但底层仍然是一张一张的照片。

## 8.2 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `slug` | string | 是 | 稳定网址标识 |
| `image` | image path | 是 | 原始展示照片 |
| `alt` | string | 是 | 图片替代文字 |
| `title` | string | 否 | 可选照片标题 |
| `caption` | string | 否 | 可选说明或短文字 |
| `capturedAt` | date/datetime | 否 | 拍摄时间，不确定时可省略 |
| `publishedAt` | date/datetime | 是 | 网站发布时间 |
| `location` | string | 否 | 拍摄地点 |
| `tags` | string[] | 否 | 主题、设备、场景等标签 |
| `series` | string | 否 | 可选系列名称，但不改变单张照片模型 |
| `featured` | boolean | 否 | 是否在影像栏目精选 |
| `homepage` | object | 否 | 首页展示设置 |
| `status` | enum | 是 | `draft` / `published` / `archived` |

## 8.3 示例

```yaml
---
slug: "light-before-rain"
image: "/images/photos/light-before-rain.jpg"
alt: "下雨前，窗外偏灰蓝色的天空与远处建筑"
title: "雨落下来以前"
caption: "空气突然安静了一会。"
capturedAt: 2026-07-30T18:42:00+08:00
publishedAt: 2026-08-02T21:10:00+08:00
location: "汕头"
tags:
  - 城市
  - 傍晚
series: "日常光线"
featured: true
homepage:
  show: true
  order: 1
status: published
---
```

## 8.4 图片自动信息

构建阶段可自动读取或生成：

- 宽度；
- 高度；
- 横图/竖图/方图；
- 响应式尺寸；
- 缩略图；
- 低清占位图；
- 文件体积优化版本。

GPS、相机序列号等可能涉及隐私的信息不应直接公开。

照片上传前或构建时应清理不必要的 EXIF 信息。

---

# 9. Home 首页策展模型

## 9.1 V0.1原则

首页策展以内容文件中的：

```yaml
homepage:
  show: true
  order: 1
```

作为主要控制方式。

不同内容类型可以拥有各自的展示位，例如：

- 精选文章；
- 重点项目；
- 一篇随笔或一条碎片；
- 精选影像。

首页不是按全站发布时间自动排序。

## 9.2 排序规则

同一内容类型中：

1. 先按 `homepage.order` 从小到大；
2. 若顺序相同，再按发布日期从新到旧；
3. 若仍相同，按 `slug` 稳定排序。

## 9.3 数量限制

第一版建议：

- 代表文章：1–2 篇；
- 重点项目：1–3 个；
- 随笔或碎片：1–3 条；
- 影像：1–4 张。

超过数量时，页面只读取排序靠前的内容。

这样可以防止首页逐渐变成信息流。

## 9.4 AI建议机制（未来）

未来 AI 可以：

- 检查首页内容是否长期未更新；
- 判断是否有更具代表性的新内容；
- 给出替换建议；
- 提供推荐理由和预览。

AI 不可以：

- 自动发布内容；
- 自动删除首页项目；
- 自动改变展示顺序；
- 在没有用户确认时修改正式配置。

建议结果应与正式内容分开保存，例如：

```text
.ai/home-suggestions.json
```

该文件不直接控制线上首页。

---

# 10. 文件组织建议

基于 Astro Content Collections，建议目录为：

```text
src/
├── content/
│   ├── articles/
│   │   └── context-is-the-new-interface.mdx
│   ├── essays/
│   │   └── i-only-wanted-to-watch-youtube.mdx
│   ├── fragments/
│   │   └── 2026-08-05-context-compounds.md
│   ├── projects/
│   │   └── morning-radar.mdx
│   └── images/
│       └── light-before-rain.md
├── assets/
│   └── images/
└── content.config.ts
```

说明：

- `content.config.ts` 用来验证字段；
- 内容文件主要保存文字和元数据；
- 图片放在统一资源目录；
- 页面组件从内容集合中读取数据；
- 新增内容不需要修改页面代码。

最终目录可以由 Codex根据 Astro 版本和部署方式调整，但内容类型边界不能改变。

---

# 11. 校验规则

构建网站时，应自动检查：

## 11.1 通用检查

- `slug` 唯一；
- 必填字段存在；
- 日期格式正确；
- `status` 值合法；
- 图片路径存在；
- 外部链接格式正确；
- `homepage.order` 是数字；
- 草稿不会进入正式构建；
- 不公开包含真实姓名或隐私信息的元数据。

## 11.2 文字内容检查

- 中文长标题不会导致页面溢出；
- 无封面内容仍有合法布局；
- 正文为空时构建失败；
- 图片存在时必须有替代文字；
- 超长摘要可以截断，但原始内容不被修改。

## 11.3 影像检查

- 每条影像只要求一张核心图片；
- 图片必须有 `alt`；
- 地点和拍摄时间可以缺失；
- 不依赖相册字段；
- 页面根据图片比例自动适配，不强制裁成同一种比例。

## 11.4 项目检查

- `name`、`tagline`、`description` 和 `status` 必须存在；
- 在线地址和 GitHub 地址可以缺失；
- 截图列表为空时仍可显示；
- 技术栈为空时不显示空栏目；
- 更新日志可以以后再添加。

---

# 12. 页面空状态和异常内容

网站必须正确处理：

- 当前没有任何文章；
- 随笔没有封面；
- 碎片没有图片；
- 项目没有在线地址；
- 项目没有 GitHub 地址；
- 照片没有标题；
- 照片没有拍摄地点；
- 文章标题非常长；
- 标签很多；
- 中文和英文混合标题；
- 首页暂时只选择了一种内容；
- 某个栏目还没有发布内容。

空状态应使用简单、诚实的文字，不使用虚构示例内容冒充正式内容。

---

# 13. 可扩展性原则

以后增加字段时必须满足：

- 新字段默认可选；
- 旧内容无需立即补全；
- 缺少新字段时页面仍可构建；
- 不修改已有 `slug`；
- 不把随笔、文章和碎片重新合并为同一内容类型；
- 不把单张影像模型强制改为相册模型；
- 新功能优先通过附加字段实现，而不是推翻已有结构。

可能的未来字段包括：

- 评论标识；
- 点赞数量缓存；
- 多语言；
-相关文章；
- 内容系列；
-音频；
-发布平台同步状态；
- AI生成摘要；
- 首页AI推荐理由。

---

# 14. V0.1验收标准

`CONTENT_MODEL.md` 通过验收时，需要满足：

1. 新增内容不需要修改页面代码。
2. 首页精选内容可以手动控制。
3. AI只能建议首页更新，不能自动修改。
4. 中文长标题不会破坏布局。
5. 没有封面图时仍能正常显示。
6. 文章、随笔、碎片、项目和影像有明确区别。
7. 随笔栏目精选与首页展示是两个不同状态。
8. 影像以单张照片为基本单位，而不是相册。
9. 缺少地点、链接、技术栈等可选信息时页面仍然成立。
10. 以后增加可选字段不会推翻已有内容。
11. 草稿不会出现在公开网站。
12. 内容文件不包含真实姓名和不必要的隐私元数据。
13. Gemini和Codex能够依据同一字段定义生成一致页面。
