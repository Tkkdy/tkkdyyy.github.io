# tkkdy Content Admin

云端候选与上线边界见 [CLOUD_EDITOR.md](CLOUD_EDITOR.md)。云端网址尚未开通；Windows 本地入口保留 `http://127.0.0.1:19443/admin/`，使用现有受保护配置启动。

## Public Site

https://tkkdy.github.io/tkkdyyy.github.io/

## CMS

https://tkkdy.github.io/tkkdyyy.github.io/admin/

tkkdy Editorial Studio 位于上述地址。正文使用 TipTap 区块编辑器，支持段落、标题、引用、强调块、图片、列表、代码和分隔线。现有 Sveltia 后台保留为备用入口：

https://tkkdy.github.io/tkkdyyy.github.io/admin/sveltia.html

Editorial Studio 会为每个 New Story 草稿生成独立、稳定的浏览器本地 ID；草稿正文、封面和封面 alt 文本保存在 localStorage。Preview 使用当前标签页的 sessionStorage 数据打开 `/admin/preview/`，并通过与公开页面相同的 Markdown / StoryBody 渲染路径显示。Sveltia 继续保留为备用入口。

## 发布 Article

`Articles` → `New` → 填写内容 → 保持 `status: draft` → `Save`。

需要正式发布时，先填写稳定的 `publishNumber`，再将 `status` 改为 `published` 并保存。

`Categories` 与 `Tags` 都是多值字段：每行填写一项；优先复用已有名称。保存后，公开文章底部会显示可点击的分类与标签，并自动进入对应聚合页。

Essay 使用相同的 `Categories` / `Tags` 字段；不需要额外维护分类或标签数据库。

## 更新 Project

`Projects` → 选择现有项目 → 编辑 → `Save`。

第一版不能从 CMS 新建 Project，因为项目首页有针对现有项目的专用展示结构。

## 上传图片

在图片字段选择或上传文件。CMS 会保存到 `public/uploads/`，并将适用于 Project Site 的路径写入内容文件。

Editorial Studio 中的本地图片以 base64/data URL 形式存在，只用于编辑期草稿和预览。base64 **不得**写入内容 Markdown 或 frontmatter。Publish 必须先将这些图片写入 `public/uploads/`，再把正文和封面中的临时 URL 改写为正式公开路径。

更新既有内容时，发布层必须先读取仓库中的原文件，再仅合并 Studio 管理的字段。未由 Studio 管理的 frontmatter 键必须原样保留；禁止从 EditorState 重新生成整段 frontmatter 并覆盖原文件。

## Publishing Pipeline

Editorial Studio Validate → 私有草稿保存（云端候选）→ 显式发布时上传图片到内容分支 → 安全合并既有 frontmatter → 内容 PR → 必需 CI / 受保护合并 → GitHub Pages 与 VPS 独立构建及状态核验。VPS 正式自动发布开关仍受观察和授权门禁约束。

Studio 的 Publish 进度会显示本地保存、仓库写入、部署触发/完成和最终文章 URL。TipTap 编辑器通过已有同源发布层调用 Admin Broker；GitHub 凭据只留在服务端。

## 登录

受保护编辑器使用 GitHub App OAuth / PKCE，限定 Tkkdy 与指定仓库。浏览器仅持有 HttpOnly 会话 Cookie 和会话绑定的 CSRF 值，不保存 GitHub Token。Windows 本地 App secret 保持现有 DPAPI 加密方式；云端候选通过受保护 stdin 配置启动。不要在对话或仓库中提供凭据。
