# VDVXDV Content Admin

## Public Site

https://tkkdy.github.io/tkkdyyy.github.io/

## CMS

https://tkkdy.github.io/tkkdyyy.github.io/admin/

Phase 3 的 Editorial Studio 位于上述地址。正文使用 TipTap 区块编辑器，支持段落、标题、引用、Callout、图片、列表、代码和分隔线。现有 Sveltia 后台在新发布流程接通前保留为备用入口：

https://tkkdy.github.io/tkkdyyy.github.io/admin/sveltia.html

Editorial Studio 当前只在浏览器本地保存完整的区块结构；Preview 与 Publish 是 Phase 4 的界面占位，不会写入仓库。正式保存与发布仍使用 Sveltia。

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

## Publishing Pipeline

CMS Save → GitHub commit → GitHub Actions → Astro + Pagefind → GitHub Pages

## Token

Token 只在浏览器的 `Sign In with Token` 登录窗口中使用并存于该浏览器本地；不要写入 repository、环境文件或对话。
