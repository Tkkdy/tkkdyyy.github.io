# Admin broker：本地安全迁移实现，未上线

本目录实现 Editorial Studio / Sveltia 共用的受限服务端认证与内容写入。当前已在独立开发副本和真实测试分支验证内容读写，但 OAuth 身份仍为合成；未注册 GitHub App、未修改生产权限、未连接生产写入。

## 已实现边界

- GitHub App 用户 OAuth：PKCE、一次性 state、绑定浏览器的 HttpOnly Cookie；核对所有者 ID 144055705 与仓库 ID 1355866312。令牌只留服务内存，最多 30 分钟，不保存 refresh token。进程重启须重新登录。
- 固定仓库与配置分支；main 默认拒绝。GraphQL AST 校验仅允许读取指定仓库、向指定分支 createCommitOnBranch，且必须传入 expectedHeadOid。
- 写入仅限五个内容集合 Markdown 与经过类型检查的上传图片；拒绝工作流、代码、隐藏文件、活动 SVG、明显凭证及越界路径。普通 Git REST 写接口没有开放。
- CSRF 与精确 Origin 校验。Sveltia 的 token / Bearer 认证头只承载会话绑定的 CSRF，不能脱离 HttpOnly Cookie 使用；不会获得 GitHub 凭证。
- server.mjs 验证 Host、原始路径、文件类型和每级符号链接；限制请求体；不提供目录列表；所有静态 Admin 文件需登录。CSP 仅允许本地脚本及构建生成的内联脚本哈希。
- Sveltia 0.164.2 从 npm 官方完整包 SHA512 校验后提取，脚本 SRI 和许可证见 public/admin/vendor。运行时不下载第三方脚本。
- Studio 实时列表和通用编辑页从固定 Git head 读取内容，无需每次内容发布后重建后台；提交以 expectedHeadOid 防提交窗口竞争，以 sourceBlobSha 防编辑期间正文变化，不自动覆盖。提交成功后分别读取两站版本标记与 HEAD 健康，不把仓库写入等同于完整部署/功能验收。

## 本地验证

`npm run check` 运行 Astro 与 Node 测试。`ADMIN_SITE_URL=http://127.0.0.1:19443 npm run build:admin` 生成私有 dist-admin（Windows 用 PowerShell 环境变量语法）。该目录不得上传到公共静态站。HTTP 适配器必须由调用者绑定 127.0.0.1，公共访问应走经批准的 HTTPS 反向代理。

createBroker(config, dependencies) 与 createAdminServer(...) 是可测试模块，已有run.mjs stdin配置入口，但尚无生产安装器。测试采用注入的合成上游，不代表真实 GitHub App OAuth 验收。测试服务器脚本位于仓库外，不会进入产物。

## 待完成，不得据此宣布上线

1. run.mjs仅绑定回环，stdin接收秘密配置；Setup-LocalAdmin.ps1/Start-LocalAdmin.ps1使用Windows用户DPAPI。已用合成秘密通过真实Windows加解密与Node服务测试；真实App凭证尚未配置。
2. Material Symbols图标字体已固定为Google官方WOFF2并记录哈希/Apache许可证；文本字体使用系统回退。原CMS外部字体及unpkg更新检查仍被CSP拒绝，未放宽脚本或任意网络权限。
3. Actions 40218051834 已用短期凭证在独立测试分支完成真实草稿、实时 Studio 列表/编辑保存、CMS 项目与影像浏览器提交/回读，以及双构建一致性。真实 GitHub 凭证只在服务端；认证为合成上游，真实 GitHub App OAuth 仍待验收。后续专项证据见仓库外 M3-local-progress.md。
4. 所有者审查后注册/配置 GitHub App：仅指定仓库，Contents read/write、Actions read、Metadata read；短期用户令牌保持启用，禁止不需要的权限和 webhook。回调只列出实际批准的编辑站与回环地址。
5. 真实 OAuth 尚未完成；历史内容、项目/影像编辑已通过真实测试分支浏览器验收，不能用它代替真实账号授权验证。生产部署状态及主/备用入口最终验收尚未完成。
6. 公共内容与带认证 Admin 必须使用不同 origin。VPS 新编辑域名、DNS/TLS/Nginx、服务用户、文件权限和生产自动发布启用均须集中审查批准。不得因已有 HTTPS 恢复授权直接部署此模块。

线上仍使用已验收旧 release，GitHub Pages 原工作流继续生产，生产凭证和服务未被本目录改动。

## 独立 Windows 备用路径（真实 App 审查配置后才能登录）

使用 PowerShell 7、Node 24。在独立副本生成私有构建后，所有者运行 Setup-LocalAdmin.ps1 -ClientId <经批准的AppClientId> -Branch <已有测试分支>，在隐藏提示输入 client secret。配置默认保存到用户 LOCALAPPDATA/EditorialStudio，密文只适用于当前Windows账号，拒绝覆盖旧配置。随后运行 Start-LocalAdmin.ps1，访问 http://127.0.0.1:19443/admin/。不依赖VPS在线，但仍依赖GitHub；草稿通过导出/导入跨站迁移。需要迁移电脑时重新授权配置，不能复制DPAPI密文当作可跨设备恢复的备份。

VPS服务将用同一run.mjs及单独受保护配置；服务账户、专用Admin origin和反向代理必须另行审查。尚未在真实VPS安装。

## PR 兼容准备（2026-10-26，未启用）

`publicationMode: "pull-request"` 是显式选择的开发模式，要求 `branch: "main"`、`allowMain: false`。默认仍是原测试分支 direct 模式；本次没有改变任何已保存配置、真实 App 或生产权限。

Studio 从 main 的准确 SHA 读取内容；发布改为受会话/Origin/CSRF 保护的 `/api/proposals`。服务只创建 `codex/editorial-proposal-<UUID>` 内容分支、单提交和 PR，复核真实 diff 只能包含本次批准的内容/图片路径。main 漂移、其他代码差异、未知写入结果都停止；同会话同请求并发只创建一次。不会写 main、合并 PR、删除分支、自动重试或声明两站部署成功。本地草稿保持，界面显示提案链接及尚未确认合并/部署。

当前权限不足/尚未验证：真实 GitHub App 授权仍暂缓；PR 模式需要另行审查 Pull requests:write（以及既有 Contents:write）。未调用真实 PR API、未进行浏览器闭环、未验证 branch protection 拒绝。没有自动合并或合并后状态追踪；当前“刷新”不会假装知道 PR 已合并。Sveltia 在此模式的直接写 mutation 会被拒绝，其原生 editorial workflow 适配尚缺，不能据此启用生产 main 保护或宣称完整编辑体验已兼容。不得以允许 main mutation 作为补救。

定向测试：`node --test tests/admin-content-proposals.test.mjs tests/admin-github-client.test.mjs tests/admin-broker-auth.test.mjs`。上游使用合成 GitHub 响应；测试通过不证明真实 OAuth、权限或线上内容发布。
