# P1 日常编辑入口（2026-10-27）

Pages `/tkkdyyy.github.io/admin/` 保留写作、本地草稿、预览及草稿导出，不接收 GitHub Token。展开“编辑连接”打开 `http://127.0.0.1:19443/admin/`，本机 OAuth 编辑器负责图片与文章提交、创建 PR。GitHub CI 通过后，维护者在 GitHub 合并；Pages 由唯一正式工作流发布，VPS 自动发布仍禁用。

现有本机配置已为 pull-request/main-read、allowMain=false；启动仓库的 `ops/admin-broker/Start-LocalAdmin.ps1` 即可复用受保护配置。新安装必须先构建私有 Admin，使用 Setup-LocalAdmin.ps1 的 `-PublicationMode pull-request`；不得把真实secret写进命令参数或源码。配置默认拒绝覆盖，历史草稿先在原浏览器/原域名导出后在本机导入，未导出的浏览器草稿不会自动跨域迁移。主站故障不影响本机服务读取 GitHub；电脑需开机运行，未部署公网VPS后台。

真实App5482888、仓库限定与PR6/7/8、CI和跨会话恢复证据已在独立交接验收；下方“未注册/合成”内容为历史阶段记录。保护采用单人PR+必需CI、零独立批准，禁止强推和删除；不承诺防御维护者本人恶意更改代码。不得为编辑器扩大App权限或旁路保护。

---

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

使用 PowerShell 7、Node 24。在独立副本生成私有构建后，所有者运行 Setup-LocalAdmin.ps1 -ClientId <经批准的AppClientId> -Branch <已有测试分支>，在隐藏提示输入 client secret。配置默认保存到用户 LOCALAPPDATA/EditorialStudio，密文只适用于当前Windows账号，拒绝覆盖旧配置。随后运行 Start-LocalAdmin.ps1，访问 http://127.0.0.1:19443/admin/。本地启动器现支持显式 `-PublicationMode pull-request`：默认读取 main，强制 allowMain=false，内容写入走既有专用分支/PR服务。此模式仍需真实App与Pull requests权限另批，不会因配置而注册App或改变GitHub保护。不依赖VPS在线，但仍依赖GitHub；草稿通过导出/导入跨站迁移。需要迁移电脑时重新授权配置，不能复制DPAPI密文当作可跨设备恢复的备份。

VPS服务将用同一run.mjs及单独受保护配置；服务账户、专用Admin origin和反向代理必须另行审查。尚未在真实VPS安装。

## PR 兼容准备（2026-10-26，未启用）

`publicationMode: "pull-request"` 是显式选择的开发模式，要求 `branch: "main"`、`allowMain: false`。默认仍是原测试分支 direct 模式；本次没有改变任何已保存配置、真实 App 或生产权限。

Studio 从 main 的准确 SHA 读取内容；发布改为受会话/Origin/CSRF 保护的 `/api/proposals`。服务只创建 `codex/editorial-proposal-<UUID>` 内容分支、单提交和 PR，复核真实 diff 只能包含本次批准的内容/图片路径。main 漂移、其他代码差异、未知写入结果都停止；同会话同请求并发只创建一次。不会写 main、合并 PR、删除分支、自动重试或声明两站部署成功。本地草稿保持，界面显示提案链接及尚未确认合并/部署。

当前权限不足/尚未验证：真实 GitHub App 授权仍暂缓；PR 模式需要另行审查 Pull requests:write（以及既有 Contents:write）。未调用真实 PR API、未验证 branch protection 拒绝。已通过本地真实浏览器/合成GitHub上游闭环；刷新可只读核对明确merged与main祖先关系，并按最终合并SHA追踪双站版本，但没有自动合并功能。固定 Sveltia 0.164.2 不支持原生 editorial workflow；本地适配使用下面的真实内容分支流程，仍禁止 main mutation。真实权限和生产集成未完成；CMS签名恢复本地增量见末节，不能据此启用生产 main 保护或宣称完整迁移已验收。

定向测试：`node --test tests/admin-content-proposals.test.mjs tests/admin-github-client.test.mjs tests/admin-broker-auth.test.mjs`。上游使用合成 GitHub 响应；测试通过不证明真实 OAuth、权限或线上内容发布。

PR状态增量：当前会话创建或经签名核验恢复的提案可以只读刷新。仅在GitHub明确merged=true、最终merge_commit_sha有效且为当前main祖先时，才用该最终SHA分别查询两站版本和流水线；不把PR head或未合并测试merge SHA用于上线判断。提案改动、关闭、未知身份均停止或明确显示未合并。没有自动合并功能。合并后追踪已通过定向测试和本地真实Edge/合成上游验证；真实App/PR未完成；Sveltia 本地分支保存增量见下文。


### 固定版本 Sveltia 的内容分支流程（本地准备，未启用生产）

PR 模式下打开 `/admin/sveltia.html` 会转到 `/admin/sveltia-proposal.html`。所有者明确点击创建后，服务器核对固定仓库及所有者 ID，从当时 main SHA 创建 `codex/cms-proposal-<server UUID>`。CMS 配置实际指向此分支；没有 main 保存成功的伪装。Studio 自身仍读取 main，其已有内容提案接口不变。

Sveltia Save 只在此会话的分支提交，保留现有五类集合、图片与 frontmatter 校验。每次保存要求准确 head SHA，未知写入结果或外部分支改动进入 STOPPED，不能自动重放。一个工作区最多30次保存、累计64条路径；提交 PR 前核对全部已记录 commit、净差异路径、main 与分支 SHA。无新增权限绕过，既不合并也不部署，PR 创建后冻结保存。文件/提交限制是工作区操作边界，不是 GitHub Contents 权限的目录隔离。

外层页面明确提示 Save 不等于上线，显示服务端确认保存次数，提交前要求用户先完成保存。CMS 使用独立 `sveltia-workspace.html`，避免内部路由清除查询参数后刷新失效。仅此页面在已登录 PR 模式允许 `frame-ancestors 'self'`；其他 Admin HTML 继续禁止嵌入，脚本、OAuth bridge、网络限制和凭据保护不变。

当前仍不具备生产资格：真实 App/PR 及 branch protection enforcement 未测；CMS PR 已接入下面的当前会话合并后双站追踪，但仍非真实权限验收；未保存编辑不包含在 PR 中；工作区运行状态在内存，过期/重启后须重新登录并显式选择签名记录恢复，详见末节。不能自动删除分支或在新会话盲目重试未知写入。

验证：9项工作区测试和7项HTTP配置测试，加既有权限/PR/客户端定向检查共51项通过；私有构建60页、Astro80文件0错。本地真实 Edge 已完成固定 Sveltia 项目表单保存→返回列表→服务端1次保存→PR链接；读取公开 GitHub 内容，但所有 OAuth、分支、commit、PR 写入均为合成响应，未在真实仓库写入。证据在仓库外 `evidence/cms-workspace-browser-20261026T093620368Z`。现有字体及更新检查被 CSP 阻止仍保留，没有放宽外网策略。


### CMS 提案的合并后只读追踪（未启用生产）

`GET /api/cms-workspace/status` 仅核对当前已登录会话创建的CMS提案，不接受外部PR编号或任意分支。Studio和CMS共用proposal-status.mjs核对PR身份、固定head、明确merged及最终merge_commit_sha在当前main的祖先关系。未合并的测试merge SHA或PR head不能触发上线判断。此接口不修改提案、分支、合并状态或工作区写权限。

CMS页面在明确合并后，用最终SHA调用既有独立目标/流水线只读检查。Pages与VPS各自显示公开版本、HTTP健康与流水线状态，一站异常不抹掉另一站结果；UI明确这不是完整文件/功能验收。刷新开始先清除旧状态，关闭/改动/异常提案、会话失效及版本不一致的伪成功响应不能保留之前的成功声明。重复刷新使用序号丢弃过期状态响应。工作区提交PR后仍冻结，不能因状态读取重新启用写入。

本轮定向测试53项及既有独立状态检查6项通过。实际固定Sveltia/本地Edge完整操作并以合成上游模拟待合并、最终SHA、两站不同版本、一站失败、关闭、错误成功响应和会话失效，浏览器7项检查通过；真实GitHub写入、App OAuth和生产部署均未测试。证据位于仓库外evidence/cms-merged-status-browser-20261026T105129068Z。真实权限与生产恢复演练仍未完成；工作区签名恢复本地验证见下节，因此生产启用仍须P0-P3及观察/批准关卡。


### CMS 跨会话与重启恢复（仅本地验证，未启用生产）

固定 CMS 的 postSave 事件只触发外层只读刷新。服务端确认完整保存后签名工作区元数据，浏览器按分支分别保存最多50项，可导出、导入JSON。记录含分支、base/head、提交和路径清单、PR身份；不含正文、GitHub token、App secret、Cookie或CSRF，不恢复未保存表单草稿（草稿仍走既有迁移入口）。签名不是登录凭据。

恢复步骤：重启原本地broker（生产启动/配置仍需另批）→重新登录→选择本地记录或导入导出文件→点击“核验并恢复”。服务端要求当前会话未开始、精确Origin与新CSRF；用现有App secret经独立HKDF域派生签名密钥，不生成新GitHub凭证。签名绑定固定App/仓库/所有者，改动App ID或secret会使旧记录失效；不得通过降级签名或创建账户解决。

编辑态核对当前main、branch head、完整提交顺序与内容路径，确认没有任何状态PR；冻结态核对固定PR/head及明确合并关系。恢复只读GitHub，不创建分支、保存、PR或部署。未知写入、漂移、旧编辑记录已有PR、损坏签名均拒绝，保留现场。恢复后继续保存仍需显式操作和expectedHeadOid；跨broker/外部所有者并发存在核验与写入间竞态，PR前置检查不是GitHub原子的跨进程锁，后续漂移仍会停止，不能宣称不可变保护。

浏览器不覆盖较新、冻结或损坏的同分支记录，存储不可用时允许手动导出。崩溃发生在GitHub成功与签名刷新之间时，旧记录将因head变化被拒绝；此时人工核对远端，不盲目重试。跨设备需自行安全传递仅含元数据的导出文件，并在相同已批准App配置下重新登录。没有后台自动续传或新系统服务。

验证：66项相关测试、60页私有构建、真实本地Edge/固定CMS的14项浏览器检查通过。覆盖保存后自动签名、元数据导出、broker重启旧Cookie失效、重新登录、编辑/冻结恢复GET-only、篡改导入拒绝、已有PR时旧导出拒绝及既有两站状态反例。OAuth/写入/PR/两站响应均为合成，公开GitHub内容读取为真实只读；真实App与生产恢复未验收。证据在仓库外evidence/cms-recovery-browser-20261026T111135458Z。模拟broker重建与HTTP服务重启不等于整机断电。


### Windows备用启动器的PR模式（准备完成，真实App仍未批准）

Setup-LocalAdmin.ps1 默认 `PublicationMode=direct` 与测试分支 codex/admin-local-probe，不改变旧配置或运行中服务。显式选择 `-PublicationMode pull-request` 才默认读取 main；显式指定非main基准会在秘密提示前拒绝。direct+main 始终拒绝；两模式都固定 allowMain=false。必须另选不存在的 ConfigPath；脚本拒绝覆盖，最终CreateNew还保护竞争条件。单独配置不提交内容、不合并、不自动部署。

Start-LocalAdmin.ps1 兼容未含publicationMode的schema1旧测试分支配置，但启动前验证mode/branch/allowMain的布尔类型、端口整数范围和精确http://127.0.0.1:<port> origin。危险组合在DPAPI解密前停止。秘密仅从Windows用户DPAPI解密至内存，再经stdin交给run.mjs；不放入命令参数、环境或输出。标准端口19443，GitHub App回调必须另案准确批准；换端口不能自动改回调。已有配置不自动迁移到PR模式。

验证：Windows实际setup脚本、合成Read-Host输入、DPAPI、实际start脚本经Node stdin探针、真实start→run.mjs进程启动、匿名401和OAuth精确回调跳转；另有拒绝模式/分支/不安全编辑配置与不覆盖旧文件检查。真实启动集成只在动态回环端口和一次性临时配置/静态目录运行，仅结束测试自建进程树。没有进行真实OAuth回调、GitHub写入或生产操作。无需重建未改动的静态Admin产物。


### Studio历史提案恢复（本地准备，生产未启用）

Studio内容提案创建完成后，服务端附带签名恢复记录；编辑器按PR分别保存元数据，提供“导出当前提案记录”，本地存储失败也能在当前页面导出。侧栏和编辑器的“历史提案与部署追踪”入口可在新会话导入/选择记录，显式核验。页面不读取或改变草稿正文，也不创建PR、提交、合并或部署。

`POST /api/proposals/restore`仍需新登录、精确Origin和当前CSRF；验证记录签名、固定仓库/所有者及PR/head身份，明确合并后核对最终SHA在main历史中，再恢复当前会话的只读追踪。未知head/身份漂移拒绝且不登记提案。仅允许恢复已确认创建成功后签发的记录；未知写入结果不生成记录，不自动重放。开放/关闭PR不查部署；明确合并后仅用最终SHA分别核验两站。

Studio和CMS共用签名实现，但使用不同HKDF盐、签名域及载荷类型，不能互换。既有CMS格式逐字节兼容，不要求作废此前记录。Studio记录只含PR编号、branch/base/head及固定身份/状态，不含正文、GitHub token、App secret、Cookie/CSRF；不是登录凭据。最多50条浏览器记录，服务会话最多恢复100条；损坏/不同同编号记录不覆盖，存储或记录丢失需已有导出或人工核对，不承诺云端备份。App凭据轮换仍使旧签名失效。

页面每次选择/核验清除旧成功；异步序号抑制过期响应；校验目标集合、最终SHA和CURRENT的实际SHA/HTTP200，错误成功响应、篡改文件、失效登录不会留下旧成功。仅版本标记/HTTP健康，不是完整功能验收。恢复只读不需要新的Contents写权限，但创建PR本身的真实App权限仍须另批。

本地验收：73项相关测试、83文件Astro0错误、61页私有构建通过。实际Edge完成原Studio表单→合成PR→签名自动保存/导出→broker/HTTP重启→新登录恢复；另实际关闭重开Edge和空浏览器上下文后重新登录，导入导出记录只读恢复。11项浏览器检查含两站不同版本、错误成功、篡改与会话失效。所有OAuth、GitHub写入、PR/合并和两站响应为合成，未进行生产修改或真实App验收。最终证据为仓库外evidence/studio-recovery-browser-20261026T113239888Z；先前113027成功也保留。


### 独立Admin审查分支（不与接收器修复捆绑）

codex/admin-minimal-review以已验收710549ae为基底，其内容完整对应main545a9c54。只从2ea05e03白名单抽取60个后台/后台测试文件，另外限定修改.gitattributes/.gitignore/package/lock及加入review-scope.json，共65文件增量；ops/deploy、.github/workflows、src/content与710基底逐字节保持，不继承旧Admin分支缺少chances.md的历史状态。

私有后台依赖仅新增dompurify3.4.17、graphql17.0.2及类型包@types/trusted-types2.0.7。原448个锁定包的版本/resolved/integrity不变；锁文件由710基底离线更新，未整份覆盖旧Admin锁。已有parse5和playwright复用M1/M2基底，不在本增量重授或升级。保留既有http-cache-semantics High和fast-uri Moderate风险记录，本次未重新audit或升级以消除告警。

独立副本npm run check通过114项测试、无跳过及Astro类型检查，私有构建63页；使用本副本实际broker/依赖的11项本地Edge重启/导出导入/状态反例通过。真实App OAuth、GitHub写入和生产激活仍未获准。本分支不是可直接合并到main的小接收器修复，须分别审查65文件Admin增量与基底44文件M1/M2，完整路径/来源blob记录在review-scope.json。该文件不授权部署。
