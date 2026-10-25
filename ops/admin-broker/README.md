# Admin broker：本地安全迁移实现，未上线

本目录实现 Editorial Studio / Sveltia 共用的受限服务端认证与内容写入。当前仅在独立开发副本及合成身份环境验证；未注册 GitHub App、未修改生产权限、未连接生产写入。

## 已实现边界

- GitHub App 用户 OAuth：PKCE、一次性 state、绑定浏览器的 HttpOnly Cookie；核对所有者 ID 144055705 与仓库 ID 1355866312。令牌只留服务内存，最多 30 分钟，不保存 refresh token。进程重启须重新登录。
- 固定仓库与配置分支；main 默认拒绝。GraphQL AST 校验仅允许读取指定仓库、向指定分支 createCommitOnBranch，且必须传入 expectedHeadOid。
- 写入仅限五个内容集合 Markdown 与经过类型检查的上传图片；拒绝工作流、代码、隐藏文件、活动 SVG、明显凭证及越界路径。普通 Git REST 写接口没有开放。
- CSRF 与精确 Origin 校验。Sveltia 的 token / Bearer 认证头只承载会话绑定的 CSRF，不能脱离 HttpOnly Cookie 使用；不会获得 GitHub 凭证。
- server.mjs 验证 Host、原始路径、文件类型和每级符号链接；限制请求体；不提供目录列表；所有静态 Admin 文件需登录。CSP 仅允许本地脚本及构建生成的内联脚本哈希。
- Sveltia 0.164.2 从 npm 官方完整包 SHA512 校验后提取，脚本 SRI 和许可证见 public/admin/vendor。运行时不下载第三方脚本。
- Studio 读写绑定相同基准 SHA，分支变化使提交失败，不自动覆盖。提交成功后分别读取两站版本标记与 HEAD 健康，不把仓库写入等同于完整部署/功能验收。

## 本地验证

`npm run check` 运行 Astro 与 Node 测试。`ADMIN_SITE_URL=http://127.0.0.1:19443 npm run build:admin` 生成私有 dist-admin（Windows 用 PowerShell 环境变量语法）。该目录不得上传到公共静态站。HTTP 适配器必须由调用者绑定 127.0.0.1，公共访问应走经批准的 HTTPS 反向代理。

createBroker(config, dependencies) 与 createAdminServer(...) 是可测试模块，尚无生产安装器。测试采用注入的合成上游，不代表真实 GitHub App OAuth 验收。测试服务器脚本位于仓库外，不会进入产物。

## 待完成，不得据此宣布上线

1. 完成运行入口、密钥安全读取及本地独立备用服务打包。Windows 备用凭证须 DPAPI/凭证管理器保护；不能改用明文长期 PAT。
2. 处理 CMS 本地字体/图标和更新检查：当前外部请求被 CSP 拒绝，保留证据，不放宽脚本或任意网络权限。
3. 使用短期凭证在独立测试分支执行真实内容写入、重新获取与双构建。不得实验性写 main。
4. 所有者审查后注册/配置 GitHub App：仅指定仓库，Contents read/write、Actions read、Metadata read；短期用户令牌保持启用，禁止不需要的权限和 webhook。回调只列出实际批准的编辑站与回环地址。
5. 真实 OAuth、历史内容加载、项目/影像编辑、图片和发布状态完整验收尚未完成。
6. 公共内容与带认证 Admin 必须使用不同 origin。VPS 新编辑域名、DNS/TLS/Nginx、服务用户、文件权限和生产自动发布启用均须集中审查批准。不得因已有 HTTPS 恢复授权直接部署此模块。

线上仍使用已验收旧 release，GitHub Pages 原工作流继续生产，生产凭证和服务未被本目录改动。
