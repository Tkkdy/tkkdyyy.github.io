# VDVXDV Content Admin

## Public Site

https://tkkdy.github.io/tkkdyyy.github.io/

## CMS

https://tkkdy.github.io/tkkdyyy.github.io/admin/

## 发布 Article

`Articles` → `New` → 填写内容 → 保持 `status: draft` → `Save`。

需要正式发布时，先填写稳定的 `publishNumber`，再将 `status` 改为 `published` 并保存。

## 更新 Project

`Projects` → 选择现有项目 → 编辑 → `Save`。

第一版不能从 CMS 新建 Project，因为项目首页有针对现有项目的专用展示结构。

## 上传图片

在图片字段选择或上传文件。CMS 会保存到 `public/uploads/`，并将适用于 Project Site 的路径写入内容文件。

## Publishing Pipeline

CMS Save → GitHub commit → GitHub Actions → Astro + Pagefind → GitHub Pages

## Token

Token 只在浏览器的 `Sign In with Token` 登录窗口中使用并存于该浏览器本地；不要写入 repository、环境文件或对话。
