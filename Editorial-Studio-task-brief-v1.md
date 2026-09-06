# 《个人网站 Editorial Studio（编辑工作台）后台改造任务书 v1.0》

## 1. 项目目标

在现有个人网站基础上，将当前偏传统 CMS（内容管理系统）的后台逐步升级为一个：

> **以写作为核心的个人 Editorial Studio（编辑工作台 / 出版后台）。**

后台主要服务于用户本人，不追求企业级 CMS 的复杂能力。

最终体验应接近：

> **Notion 的写作自由度 + Medium 的内容编辑体验 + 个人杂志的发布管理能力。**

核心流程应尽可能简单：

```text
进入后台
↓
New Story（新建内容）
↓
直接写作
↓
添加分类 / 标签 / 封面等发布信息
↓
Preview（预览）
↓
Publish（发布）
↓
GitHub Actions 自动部署
↓
网站上线
```

用户日常不应需要手动处理：

```text
git add
git commit
git push
Astro build
GitHub Actions
```

这些属于基础设施，应隐藏在正常发布体验之后。

---

# 2. 项目原则

所有后续设计和实现必须遵守以下原则。

## 2.1 低耦合

编辑器、分类、标签、媒体、首页展示、发布流程之间保持清晰边界。

例如：

```text
Editor（编辑器）
```

不应该知道 GitHub Actions 如何部署。

它只负责：

> 编辑内容。

而：

```text
Publishing（发布流程）
```

负责把内容保存并触发部署。

同样：

```text
Tags（标签）
```

不应该与页面模板硬编码绑定。

---

# 2.2 可维护

代码结构应优先：

> **容易理解 > 看起来“工程化”。**

半年以后重新打开项目时，应能较快理解：

```text
这是文章列表
这是编辑器
这是标签
这是发布
```

避免出现：

```text
StoryManager
StoryService
StoryRepository
StoryFactory
StoryProvider
StoryAdapter
StoryEventBus
```

这种实际上没有必要的层级。

---

# 2.3 可拓展

当前实现应允许以后自然增加：

* `Gallery（图库）`
* `Embed（嵌入内容）`
* `Related Stories（相关文章）`
* AI 编辑辅助
* Personal Agent（个人 Agent）写入草稿
* Homepage Composer（首页编排器）
* 更丰富的 Media Library（媒体库）

但：

> **不能为了这些未来功能，现在就提前实现它们。**

只需要避免把今天的代码写死。

---

# 2.4 如无必要，勿增实体

核心原则：

> **能一个字段解决的问题，不建立一套系统。**

例如标签：

第一版只需要：

```text
tags:
- AI
- Context
- Experience
```

没有必要一开始设计：

```text
TagGroup
TagAlias
TagRelationship
TagOntology
TagPermission
```

除非未来真正出现相应需求。

---

# 2.5 不为了工程化而工程化

第一版明确不引入：

* 微服务
* Event Bus（事件总线）
* 消息队列
* 独立数据库服务
* Repository Pattern（仓储模式）
* 复杂状态机
* 权限系统
* 多用户协作
* 自研富文本框架底层

除非未来实际需求要求。

---

# 3. 当前技术基础

现有网站继续保留：

```text
Astro
+
GitHub Repository
+
GitHub Actions
+
GitHub Pages
```

目前 Sveltia CMS 已经能够完成：

```text
后台编辑
↓
GitHub commit
↓
Actions build
↓
网站部署
```

因此：

> **不重写整个网站。**

本项目重点是：

> **逐步替换后台编辑体验，而不是重做发布基础设施。**

在新的后台稳定之前，Sveltia CMS 可以暂时作为 fallback（备用后台）。

---

# 4. 后台整体布局

后台主要采用三栏结构。

```text
┌────────────┬────────────────────────────┬──────────────────┐
│ Sidebar    │ Editor                     │ Publishing       │
│ 左侧导航   │ 中央写作区域                │ 右侧发布设置      │
│            │                            │                  │
│ Stories    │ 标题                        │ Status           │
│ Media      │ 副标题                      │ Type             │
│ Projects   │                            │ Categories       │
│ Homepage   │ 正文                        │ Tags             │
│ Taxonomy   │                            │ Date             │
│ Site       │                            │ Homepage         │
│            │                            │ Featured         │
│ Settings   │                            │ Cover            │
└────────────┴────────────────────────────┴──────────────────┘
```

后台设计必须：

* 简洁
* 安静
* 留白充足
* 内容优先
* 尽量避免“企业管理后台”的视觉感受

关键词：

> `calm（平静）`
> `editorial（编辑感）`
> `writing-first（写作优先）`

---

# 5. 后台左侧导航

第一版采用：

```text
VDVXDV Editorial

+ New Story

Stories
Media
Projects

Homepage
Taxonomy
Site

Settings
```

---

## 5.1 New Story（新建内容）

点击后：

> 直接进入空白编辑器。

不要求用户先选择：

```text
Article
Essay
Note
Fragment
```

应该：

```text
有东西想写
↓
New Story
↓
开始写
↓
发布前再决定 Type / Categories / Tags
```

---

# 6. Stories（内容管理）

`Stories（内容）` 页面统一展示主要文字内容。

例如：

```text
Stories

[ All ] [ Draft ] [ Published ]

经历
Essay · 随笔
Edited 2 min ago

为什么我越来越在意 Context
Essay · 思考
Edited yesterday

Morning Radar 为什么不是一个新闻聚合器
Article · 技术
Published Sep 4
```

至少支持：

* 查看内容
* 新建
* 编辑
* 草稿 / 已发布筛选
* 删除
* 搜索

第一版不做复杂筛选系统。

---

# 7. 内容模型

为了保持简单，不额外引入复杂数据库实体。

逻辑上，一篇可发布内容可以称为：

> `Story（内容 / 文章对象）`

但这是统一概念，不要求因此设计额外的一整套后端模型体系。

核心字段：

```text
title
deck

body / blocks

type
categories
tags

status
publishDate
updatedDate

showOnHomepage
featured

coverImage

slug
description
```

---

# 8. Title 和 Deck

每篇内容至少有：

## Title（标题）

例如：

```text
经历
```

---

## Deck（副标题 / 导语）

例如：

```text
AI 时代真正稀缺的，也许不是知识，
而是一个人真正活过的东西。
```

Deck 可为空。

---

# 9. 编辑器设计

中央区域是整个后台最重要的部分。

原则：

> **正文优先，管理字段退到右侧。**

不采用：

```text
Title:
[        ]

Description:
[        ]

Body:
[一大块 textarea]
```

这种传统 CMS 风格。

---

# 10. Block Editor（块式编辑器）

第一版只实现真正必要的 Block（内容块）。

建议支持：

```text
Paragraph（正文）
Heading（标题）
Quote（引用）
Callout（强调块）
Image（图片）
Code（代码）
List（列表）
Divider（分割线）
```

暂时不做：

* 表格编辑器
* Column Layout（多栏布局）
* 数据库 Block
* Mermaid
* 复杂 Widget
* 任意 HTML 可视化编辑器

除非以后实际需要。

---

# 11. Callout（强调块）

需要允许文章中插入类似：

```text
┌─────────────────────────────────┐
│                                 │
│ 经历，是 AI 时代最难复制的      │
│ context。                       │
│                                 │
└─────────────────────────────────┘
```

第一版不必提供十几种 Callout 类型。

可以只有少量：

```text
Normal
Key Idea
Note
```

甚至第一版只实现一种也可以。

---

# 12. Publishing Panel（发布设置）

右侧固定为发布相关信息。

结构：

```text
Publishing

Status
Draft

Type
Essay

Categories
[ 随笔 × ]
[ 生活 × ]
+ Add category

Tags
[ AI × ]
[ Context × ]
[ 经历 × ]
[ Personal Agent × ]
+ Add tag

Date
Sep 6, 2026

Homepage
● Show on homepage

Featured
○

URL
/essays/experience

Cover Image
[ image ]
```

---

# 13. Type（内容形式）

Type 只描述：

> **这篇内容是什么形式。**

第一版建议：

```text
Essay（随笔）
Article（文章）
Note（笔记）
Fragment（片段）
Visual（视觉内容）
```

不要无限增加 Type。

Project 是否作为 Type，可以根据当前项目结构决定。

如果现有 `Projects` 已经是一套独立内容结构：

> **暂时保留，不强行合并。**

遵守：

> 如无必要，勿增实体，也勿强行统一实体。

---

# 14. Categories（分类）

这是正式必做功能。

一篇文章：

> **可以属于一个或多个分类。**

例如：

```text
分类：
随笔
```

也可以：

```text
分类：
随笔
生活
摄影
```

后台编辑器采用多选方式：

```text
Categories

[ 随笔 × ]
[ 生活 × ]

+ Add category
```

---

# 15. Tags（标签）

一篇文章可以拥有多个标签。

例如：

```text
AI
Context
Experience
Personal Agent
```

或者：

```text
深圳
城市
旅行
摄影
2026
```

分类和标签必须明确区分。

## Categories（分类）

代表较大的内容组织。

例如：

```text
随笔
生活
技术
摄影
```

## Tags（标签）

代表更细的主题。

例如：

```text
AI
五月天
深圳
Context
C++
旅行
生日
```

---

# 16. 分类和标签输入体验

添加分类或标签时：

优先：

> **搜索已有内容。**

例如：

```text
Add tag

AI
Agent
Context
Experience
Morning Radar
Robotics
```

如果搜索不到：

```text
Create "Memory"
```

这样可以减少重复标签。

第一版不需要复杂自动纠错。

---

# 17. Taxonomy（分类与标签管理）

后台增加：

```text
Taxonomy
```

内部两个页签：

```text
Categories
Tags
```

---

## Categories 页面

例如：

```text
Categories

随笔           18
生活           11
技术            9
摄影            6
```

数字为：

> 使用该分类的文章数量。

---

## Tags 页面

例如：

```text
Tags

AI                   16
Agent                 9
Context               7
深圳                   6
Photography           5
Morning Radar         5
```

---

# 18. 分类 / 标签管理能力

第一版建议支持：

* 新建
* 重命名
* 删除
* 修改 slug

如果实现成本不高，再增加：

* `Merge（合并）`

例如：

```text
AI Agent
↓
Merge into
Agent
```

如果 Merge 会明显增加实现复杂度：

> 可以放到第二阶段。

---

# 19. 前台分类显示

参考李新野网站。

文章正文底部显示：

```text
分类： 随笔   生活

标签： AI   Context   经历   Personal Agent
```

或者视觉优化后：

```text
────────────────────────

分类
随笔    生活

标签
AI    Context    经历    Personal Agent
```

核心要求不是样式完全复制，而是：

> **简单、明确、可点击。**

---

# 20. Category Page（分类聚合页）

点击：

```text
随笔
```

进入：

```text
/categories/essay/
```

页面展示所有属于该分类的内容：

```text
随笔

18 篇

经历
2026.09.06

为什么我越来越在意 Context
2026.08.31

在深圳乱走的一天
2026.08.20
```

若一篇文章同时属于：

```text
随笔
生活
```

那么它应同时出现在两个分类页面。

---

# 21. Tag Page（标签聚合页）

点击：

```text
AI
```

进入：

```text
/tags/ai/
```

展示所有包含 `AI` 标签的内容。

例如：

```text
AI

12 篇

经历
2026.09.06

Morning Radar 为什么不是新闻聚合器
2026.08.28

个人 Agent 真正应该记住什么
2026.08.12
```

---

# 22. Tags 总览页

前台增加：

```text
/tags/
```

可以简单展示：

```text
Topics

AI                 16
Agent               9
Context             7
深圳                 6
Photography         5
```

第一版不做传统“字体大小不一样”的标签云。

采用干净列表即可。

---

# 23. Categories 总览页

建议同时有：

```text
/categories/
```

展示：

```text
随笔
18 篇

生活
11 篇

技术
9 篇
```

---

# 24. Related Stories（相关文章）

这属于：

> **建议实现，但不是第一阶段 blocker（阻塞项）。**

第一版如果实现，只需非常简单：

```text
共同标签数
```

进行排序。

例如：

```text
经历

Related Stories

为什么长期记忆不等于 Context
AI · Context

个人 Agent 真正应该记住什么
AI · Personal Agent
```

不要第一版引入：

* Embedding（向量）
* Vector DB（向量数据库）
* AI 推荐系统

以后真需要再加。

---

# 25. Media（媒体库）

第一版主要服务：

* 上传图片
* 插入图片
* 封面图片

基本页面：

```text
Media

[ Upload ]

┌──────┐ ┌──────┐ ┌──────┐
│ IMG  │ │ IMG  │ │ IMG  │
└──────┘ └──────┘ └──────┘
```

图片至少记录：

```text
file
caption
alt
```

暂时不设计复杂 DAM（数字资产管理系统）。

---

# 26. Homepage（首页展示）

文章有：

```text
showOnHomepage
```

字段。

这样：

> Published（已发布）

和：

> Show on homepage（展示在首页）

不是一回事。

例如一篇内容可以：

```text
Published = true
Homepage = false
```

依然可以通过分类、标签、Archive（归档）找到。

---

# 27. Featured（精选）

增加简单布尔值：

```text
featured: true / false
```

供前台未来做：

* 首页重点内容
* 精选页面
* 大卡片

第一版不要增加复杂 Featured ranking（精选排序算法）。

---

# 28. Homepage Composer（首页编排器）

这是后续功能。

未来可以支持：

```text
Homepage

Hero
经历

Selected
Morning Radar
AI Duck
深圳
```

甚至拖动排序。

但：

> **第一版不实现。**

当前只需要：

```text
showOnHomepage
featured
```

即可。

---

# 29. Preview（预览）

编辑页面顶部必须有：

```text
Preview
```

理想状态：

> 调用网站真正的 Astro 页面样式进行预览。

而不是后台自己做一个近似版本。

预览应该尽可能做到：

```text
Preview ≈ Published Page
```

后续可增加：

```text
Desktop
Mobile
```

第一版 Desktop 即可。

---

# 30. Publish（发布）

点击：

```text
Publish
```

应完成：

```text
保存内容
↓
生成 / 更新正式内容文件
↓
Commit
↓
Push
↓
GitHub Actions
↓
Astro build
↓
GitHub Pages
```

用户界面可以显示：

```text
Publishing...

Saving content        ✓
Updating repository   ✓
Deploying             ...
```

完成：

```text
Published

View Story →
```

---

# 31. Draft（草稿）

第一阶段不要为了 Draft 专门搭数据库。

如果当前 Git-based CMS（基于 Git 的内容管理）方式仍然稳定：

> 可以暂时沿用。

长期可以再优化成：

```text
Draft autosave
↓
不产生大量 Git commit

Publish
↓
正式 commit
```

但：

> **这不是第一阶段必须解决的问题。**

尤其不要为了避免几个 draft commit 就引入数据库服务器。

---

# 32. URL / Slug

每篇内容保存：

```text
slug
```

例如：

```text
experience
```

对应：

```text
/essays/experience/
```

后台默认自动根据标题生成。

但用户可以手动修改。

---

# 33. SEO

第一版只保留真正需要的字段：

```text
title
description
cover image
```

大部分 SEO metadata（搜索引擎元信息）可以自动生成。

不要给后台增加：

```text
15 个 SEO 输入框
```

---

# 34. 后台路由建议

建议：

```text
/admin/

/admin/stories/
/admin/stories/new/
/admin/stories/[id]/

/admin/media/

/admin/projects/

/admin/homepage/

/admin/taxonomy/
/admin/taxonomy/categories/
/admin/taxonomy/tags/

/admin/site/

/admin/settings/
```

不要求为了“RESTful（REST 风格）”做过度复杂 URL。

---

# 35. 前台路由建议

至少：

```text
/categories/
/categories/[slug]/

/tags/
/tags/[slug]/
```

文章原有 URL：

> 尽量保持兼容。

不要为了新的后台设计大规模改变已有 URL。

---

# 36. 推荐组件划分

组件只拆到自然边界。

## Layout

```text
AdminLayout
Sidebar
TopBar
```

## Stories

```text
StoryList
StoryEditor
```

## Editor

```text
BlockEditor
BlockMenu
```

## Publishing

```text
PublishingPanel
CategoryPicker
TagPicker
CoverImagePicker
```

## Taxonomy

```text
CategoryManager
TagManager
```

## Media

```text
MediaLibrary
```

原则：

> 一个组件有明确责任即可。

不要把每个 button、label 都抽成自己的业务组件。

---

# 37. 第一阶段范围

## Phase 1 — 内容结构与分类标签

目标：

> 先把内容组织能力做正确。

必须完成：

* Categories 多分类
* Tags 多标签
* 编辑后台支持选择
* 前台文章显示分类与标签
* 分类可点击
* 标签可点击
* 分类聚合页
* 标签聚合页
* Categories 总览
* Tags 总览

这一阶段不要求新编辑器。

---

# 38. 第二阶段范围

## Phase 2 — Editorial UI（编辑后台界面）

按照已经确定的示意图实现后台基本壳子。

完成：

* Sidebar
* Story list
* Editor 页面布局
* Publishing Panel
* Category picker
* Tag picker
* Preview / Publish 按钮 UI

先保证界面和基本数据流。

---

# 39. 第三阶段范围

## Phase 3 — Block Editor

完成：

* Paragraph
* Heading
* Quote
* Callout
* Image
* List
* Code
* Divider

支持：

* 新增
* 删除
* 编辑
* 调整顺序

---

# 40. 第四阶段范围

## Phase 4 — Publishing integration（发布集成）

把新后台真正接到现有：

```text
GitHub
↓
GitHub Actions
↓
Astro
↓
GitHub Pages
```

完成：

* Save
* Preview
* Publish
* 发布状态
* 成功 / 失败反馈

完成后，新后台才正式替代 Sveltia 的日常使用。

---

# 41. 明确暂不实现

为了避免项目无限膨胀，以下不属于当前版本：

* 多用户
* 用户权限
* 评论后台
* 工作流审批
* 实时多人协作
* 数据库 CMS
* AI 自动写作
* AI Agent 自动发布
* Vector DB
* 复杂推荐算法
* 内容版本树
* 实时协同
* 完整 Homepage drag-and-drop
* 媒体 AI 分类
* 内容审核系统
* 国际化后台
* 企业级 SEO Dashboard

以后真的需要再讨论。

---

# 42. UI 验收标准

后台视觉效果应接近已经确定的示意图。

核心必须表现出：

```text
左：
导航 / Draft

中：
真正的写作空间

右：
Publishing
```

而不是：

> 大量卡片 + 表格 + Dashboard 图表。

---

# 43. 功能验收标准

一个完整验收案例：

用户创建：

```text
标题：
经历

Type:
Essay

Categories:
随笔
思考

Tags:
AI
Context
Experience
Personal Agent
```

发布后必须满足：

### 文章本身

文章正常打开。

---

### 分类

页面底部：

```text
分类：
随笔
思考
```

点击：

```text
随笔
```

能够看到《经历》。

点击：

```text
思考
```

也能看到《经历》。

---

### 标签

页面底部：

```text
标签：
AI
Context
Experience
Personal Agent
```

点击：

```text
AI
```

进入 AI 标签页。

里面能够看到《经历》。

---

### 后台

再次进入编辑器：

分类、标签等信息完整恢复。

---

### Preview

预览页面与正式网站布局基本一致。

---

### Publish

发布后：

```text
GitHub Actions PASS
```

线上页面正常出现。

---

# 44. 非功能验收标准

## 可维护

开发完成后：

* 没有明显重复逻辑
* 文件职责基本清晰
* 没有为了抽象而抽象

---

## 低耦合

分类 / 标签逻辑：

> 不依赖具体文章页面组件。

编辑器：

> 不直接耦合 GitHub API 细节。

发布：

> 不负责编辑器内部状态管理。

---

## 可拓展

未来增加：

```text
Gallery
```

不需要重写整个 Editor。

未来增加：

```text
新 Type
```

不需要重写分类系统。

---

# 45. Stop Condition（停止条件）

这是本项目的重要要求。

每个 Phase（阶段）完成：

1. 功能通过；
2. UI 达到可用标准；
3. 测试通过；
4. 没有明显阻塞 bug；

就：

> **停止这一阶段。**

不要因为：

```text
这里还能抽象
那里还能重构
这个函数还能漂亮一点
以后可能要支持 XXX
```

继续无限优化。

只有以下情况允许继续修改：

* 明确 bug
* 明显影响日常使用
* 明显技术债已经阻塞下一阶段
* 用户提出新的实际需求

---

# 46. 最终产品定义

最终目标不是：

> 做一个功能很多的 CMS。

而是：

> **做一个用户愿意真的打开、真的写东西、真的长期使用的个人编辑后台。**

前台是：

> **个人网站 / 个人杂志。**

后台是：

> **个人编辑部。**

技术只负责让这个过程可靠、简单、可持续。

整个项目始终遵守一句话：

> **低耦合、可维护、可拓展；但如无必要，勿增实体。**

以及：

> **不为了未来可能永远不会出现的问题，把今天能简单解决的事情复杂化。**
