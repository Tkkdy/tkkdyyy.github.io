# 云端编辑器：本地候选与一次性上线范围

此候选基于 main `7eae5c02cb40ae53398e15e29d056a8d9ec7e140`，分支 `codex/cloud-editor`，独立目录 `C:/Users/PsyDuck/Documents/Codex/cloud-editor-20261028`。未部署、未创建 DNS、未更改 App、未切换 VPS current。当前本机真实 GitHub 登录与 VPS 候选传输的既有验收不等于本候选云端验收。

## 使用流程

打开 `https://editor.boenbot.top/admin/`（待完成独立上线验收后开通），通过外层 Access 与 GitHub 所有者认证。首页显示仓库现有文章、随笔、碎片、项目和影像，以及服务端私有草稿。写作自动保存，另一设备打开同一草稿继续。图片随草稿私有保存，点击发布才由现有上传层写入内容提案。发布前选择“已发布”；“草稿”状态禁止发往公开仓库。原 PR/必需 CI/main 保护不变，当前仍需合并 PR；两站状态独立核验。

文章沿用 TipTap，项目/影像沿用 Sveltia 配置的基础字段，复杂对象字段保留原文，继续通过 Windows Sveltia 修改。本候选没有声称云端 Sveltia 私有工作区已完成：它原有保存动作会产生公开 Git 分支，因此仅在云端禁止其写入；原本地 Sveltia 原样保留。项目/影像目前只编辑已有内容，不提供新建影像。此限制须在产品验收时确认，不能当作全部内容能力已完成。

## 私有存储与恢复

Node 24.19+ 自带 SQLite；不新增数据库服务。运行时目录必须在仓库和静态目录之外。Linux 目录0700/数据库0600、systemd UMask0077。最多200篇，单篇12MiB，当前和最近3个历史版本合计64MiB；达到限制返回明确错误，事务回滚。单张图片8MB，保留原始 data URL，不发往 GitHub。

SQLite FULL同步，单进程操作序列化、事务 CAS revision；其他会话已更新返回409，禁止悄悄覆盖。文章冲突可载入远端、另存草稿或下载；项目/影像冲突保留当前页，需下载与重新载入比较。手机 IME composition 完成再保存，退出未保存页有提醒；系统强杀浏览器/断网最后一笔输入无法保证，必须看到云端保存确认。

“私有草稿与恢复”可下载单篇、恢复最近3个历史版本、显式删除已完成草稿。数据库启动时和每小时生成一致性备份，保留3份；物理数据库上限256MiB，加备份和临时文件需预留至少1.5GiB。备份在同一 VPS，可恢复误操作，不能抵御整机丢失；本轮不向外部传输私人草稿，异机备份另定私有目的地后实施。

整库恢复：先停止独立 Admin 服务，保留原数据，运行 `node ops/admin-broker/restore-drafts.mjs /ABS/backup.sqlite /ABS/new-private-directory`。验证 quick_check 和草稿目录后，将私有配置的 draftDirectory 指向新目录再启动。恢复工具只创建新目录，拒绝覆盖。回退时停 Admin，恢复原配置及目录；不影响公开网站。不要直接用 cp 覆盖运行中的数据库。

## 原一次性变更范围（所有者已批准；Access开通因付款资料门禁停止）

建议 Cloudflare Access + 独立 named Tunnel，Node只绑定127.0.0.1:19444。无需修改正式Nginx、证书或打开入站端口。Access和源站均核验签名/issuer/audience/时效，失败关闭；固定Host与Origin，不信任X-Forwarded-*推断认证或公网源。Cookie为__Host-前缀、Secure/HttpOnly/SameSite=Lax；云端会话最长8小时且不超过GitHub令牌实际有效期，本机默认30分钟不变；保留PKCE/state与精确Origin/CSRF，原受限CSP继续适用。

批准范围应一次覆盖：

1. 仅 editor.boenbot.top 的DNS记录；新建仅限所有者身份的Access应用与策略、独立持久Tunnel，不设Bypass。
2. 现有VPS创建独立系统用户、只读不可变Admin代码目录 `/opt/editorial-studio/<release>`，私有配置 `/etc/editorial-studio`、数据 `/var/lib/editorial-studio`，安装两个独立systemd服务（Admin与Tunnel）；若缺少合适Node/cloudflared，仅安装所需运行时，不升级其他服务。
3. 复用现有GitHub App，新增 `https://editor.boenbot.top/auth/callback`，保留 `http://127.0.0.1:19443/auth/callback` 和原安装/仓库权限。client secret通过受保护本机配置解密后直接SSH stdin传入root-only文件，禁止在日志/参数/对话中输出。若App不支持同时保留回调，先停止并提交替代方案，不覆盖本地回调。
4. 将已验证的候选源代码与私有Admin构建产物传输至该VPS；只改变这个新入口的访问范围。先备份待变更配置，SHA256白名单校验后安装，记录前后差异。不得上传本机私有配置、.git、草稿或日志。
5. 真实GitHub登录/退出、手机/iPad/桌面、跨设备草稿、图片、失效会话、备份恢复的验收；生产内容发布仅使用所有者明确批准的内容。开发测试内容不发往公开仓库。

不会随此批准更改preview网站current、正式Nginx路由、VPS正式自动发布开关、既有接收器权限、仓库保护或Auto-merge，也不合并移动导航PR。若Cloudflare计划需要付费则停止，不自动开通费用。

回滚：禁用并停止两个新服务，撤销新Tunnel入口与仅该子域DNS/Access配置、移除新增App回调；私有数据保留，原本地回调和公开网站不动。不可逆删除私有数据另需批准。

## 生产发布门禁

既有Pages/VPS工作流保持原样。VPS正式开关仍按观察与单独授权推进。首次真实双站生产验收后，才以同一合并SHA核对两站公开版本与内容，再评估只对受限内容路径Auto-merge；本候选不实现、不启用自动合并。

## 候选初始状态（后续核验见文末）

真实Cloudflare账户、Access允许的所有者身份、团队域名/AUD、Tunnel和DNS权限未核实；真实云端OAuth与原VPS资源容量未验证。Android/iPadOS需要实体设备验收，桌面浏览器窄视口/触摸模拟不等于实体设备通过。现有源站SHA与开关的参考信息来自2026-10-28交接，安装前必须重新只读核对。

参考：[Access JWT验证](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)、[Tunnel源站参数](https://developers.cloudflare.com/tunnel/reference/origin-parameters/)、[Node SQLite备份](https://nodejs.org/download/release/latest-jod/docs/api/sqlite.html)。


## 2026-10-28 本轮验证结果

- `npm run check`：0 errors / 0 warnings，126项通过；2项提示为兼容旧浏览器的beforeunload.returnValue弃用提示。
- 最后定向9项：精确邮箱、RS256签名、issuer/AUD/有效期、HTTP Host/伪造转发头、私有API认证/CSRF、公开草稿提交拒绝、CAS冲突、配额、历史与整库恢复，全部通过。合成密钥、邮箱与OAuth，不是Cloudflare真实身份验收。
- 本地真实Edge/Chromium浏览器：两个隔离cookie会话长文恢复，图片上传及第三桌面会话恢复，sandbox iframe预览，旧设备冲突另存，项目编辑自动保存及恢复列表通过；无页面错误、无GitHub写入。手机/iPad为尺寸与触摸模拟，尚无实体Android/iPadOS验收。
- Admin/Pages/VPS构建通过。复用既有双站审计：Pages173文件、VPS123文件；两者44公开HTML、各1072本地引用一致，24内容项；VPS的Admin文件为0，公开源内容和图片未改。
- 真实权限检查：域名NS指向Cloudflare；editor子域A记录不存在；工具浏览器未登录Cloudflare；SSH BatchMode认证未成功。现有本地App受保护配置存在，只有DPAPI密文，无明文secret输出。没有执行真实DNS/Access/VPS/App变更。
- 所有者已指定外层精确邮箱名单，配置参数记录在本机独立证据目录，不提交个人邮箱到公共仓库。独立Chrome Cloudflare登录窗口已打开，等待所有者本人完成登录。

证据目录：`C:/Users/PsyDuck/Documents/Codex/cloud-editor-evidence-20261028`，包含`browser-results.json`、`dual-build-audit.json`、构建日志及截图。早期浏览器用例中的字段兼容问题已修复；错误的按钮/iframe测试定位已纠正，最终用例通过。不是公网或实机验收。

最后只读公网核验：Pages的deployment.json及HTTP200匹配main `7eae5c02cb40ae53398e15e29d056a8d9ec7e140`；VPS的deployment.json返回404，当前精确SHA为UNKNOWN（不等于网站故障）。GitHub变量VPS_AUTODEPLOY_ENABLED现场读取仍为false。

## 2026-10-28 无需付款资料的外层替代候选

所有者已批准前述一次性上线范围，但随后要求保持 Cloudflare Zero Trust 停止、准备无需付款资料的同等外层方案。实际免费开通页要求付款方式、账单地址与超额收费授权，已停止；只选择过免费计划，没有激活、同意计费、填写资料或创建 Access/DNS/Tunnel。现有 butler-shadow 健康且未修改。

替代链路为：独立 Cloudflare named Tunnel（仅提供 HTTPS）→ 127.0.0.1:19445 OAuth2 Proxy → 127.0.0.1:19444 原 Broker。全主机流量经过网关，没有直达 Broker 的隧道路由；不修改正式 Nginx。Broker 的公网启动配置必须在 Access 与 gateway 两种校验中恰好选择一种，不能关闭外层验证。原本地模式和 GitHub App 仓库/owner ID 校验保持原样。

使用 OAuth2 Proxy 官方稳定版 v7.15.5。外层使用独立 GitHub OAuth App，回调为 https://editor.boenbot.top/oauth2/callback，仅请求 user:email 和 read:org（官方 GitHub provider 会调用组织/团队端点），不申请 repo 权限；内层继续复用现有 GitHub App 的 /auth/callback，并保留本地回调。两个客户端分离，避免将仓库写权限交给外层网关。创建这个额外 OAuth App 是原先“只新增现有 App 回调”之外的真实权限变更；本轮仅准备模板、本地代码和验证，尚未创建。

网关的 authenticated_emails_file 私有文件只存所有者指定的完整邮箱，不设置 email_domains 或通配符，并设置 github_users = ["Tkkdy"]。源码只选 GitHub 已验证的主邮箱，故指定邮箱必须同时是该账号的已验证主邮箱。当前 CLI 只读确认用户 ID144055705 / Tkkdy，读取 /user/emails 返回404权限不足，未扩大 CLI scope；真实主邮箱匹配尚未核实。不能用公开 profile.email 推断验证状态，也不会把 Gmail 登录换成整个 gmail.com 允许。

Broker 每次请求将 Cookie 直接发送到固定127.0.0.1端口的 /oauth2/auth，仅接受202且响应邮箱和用户名均精确匹配。不信任请求的身份头、Bearer或 X-Forwarded-*，不跟随认证子请求重定向，3秒超时，失败关闭。外层 Cookie 使用独立 __Host- 名称、Secure/HttpOnly/Lax、最长8小时、15分钟刷新；state/CSRF与S256 PKCE开启。日志关闭请求与认证日志，防止回调code或会话信息进入日志；私有配置通过systemd LoadCredential提供，持久数据仍由原Broker保管。

生产模板：oauth2-proxy.cfg.DRAFT、editorial-gateway.service.DRAFT、cloudflared-gateway.yml.DRAFT。Broker替代配置移除 access，增加 gateway: {"port":19445,"host":"editor.boenbot.top","allowedEmail":"EXACT_OWNER_EMAIL","allowedUser":"Tkkdy"}。不将真实邮箱、secret或cookie_secret写入公共模板。外层新增一个独立受限系统用户/服务；其余已批准存储、Node服务、现有App回调和回退范围继续有效。生产启用仍需所有者确认这个具体替代客户端变更，并完成VPS交互认证。

验证：官方Windows压缩包SHA256 958a5f7e77c3571cd101eea92e6021ea4f47604f8e25cb02299754265d88e537，官方校验匹配，执行版本7.15.5；生产模板 --config-test 通过。真实网关二进制搭配合成GitHub OAuth/API：精确邮箱及用户名可通过外层但仍需内层登录；错误邮箱、未验证邮箱、其他用户名、伪造Cookie、伪造state、身份头冒用及网关停机均无法取得编辑器/API数据；验证PKCE兑换。提供方对错误用户名返回500错误页，其他邮箱返回403；两者都不签发会话，这是已知错误页体验限制，不是生产可用性通过。合成HTTP测试仅在本机使用非Secure Cookie，生产模板保持Secure。连同原认证与HTTP服务共28项定向测试通过；未使用真实OAuth、未写仓库或VPS。

参考：[OAuth2 Proxy GitHub provider](https://oauth2-proxy.github.io/oauth2-proxy/configuration/providers/github/)、[认证子请求接口](https://oauth2-proxy.github.io/oauth2-proxy/features/endpoints/)、[GitHub邮箱读取权限](https://docs.github.com/en/rest/users/emails#list-email-addresses-for-the-authenticated-user)。
