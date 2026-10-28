# 云端编辑器：本地候选与一次性上线范围

此候选基于 main `7eae5c02cb40ae53398e15e29d056a8d9ec7e140`，分支 `codex/cloud-editor`，独立目录 `C:/Users/PsyDuck/Documents/Codex/cloud-editor-20261028`。未部署、未创建 DNS、未更改 App、未切换 VPS current。当前本机真实 GitHub 登录与 VPS 候选传输的既有验收不等于本候选云端验收。

## 使用流程

打开 `https://editor.boenbot.top/admin/`（待批准后开通），通过外层 Access 与 GitHub 所有者认证。首页显示仓库现有文章、随笔、碎片、项目和影像，以及服务端私有草稿。写作自动保存，另一设备打开同一草稿继续。图片随草稿私有保存，点击发布才由现有上传层写入内容提案。发布前选择“已发布”；“草稿”状态禁止发往公开仓库。原 PR/必需 CI/main 保护不变，当前仍需合并 PR；两站状态独立核验。

文章沿用 TipTap，项目/影像沿用 Sveltia 配置的基础字段，复杂对象字段保留原文，继续通过 Windows Sveltia 修改。本候选没有声称云端 Sveltia 私有工作区已完成：它原有保存动作会产生公开 Git 分支，因此仅在云端禁止其写入；原本地 Sveltia 原样保留。项目/影像目前只编辑已有内容，不提供新建影像。此限制须在产品验收时确认，不能当作全部内容能力已完成。

## 私有存储与恢复

Node 24.19+ 自带 SQLite；不新增数据库服务。运行时目录必须在仓库和静态目录之外。Linux 目录0700/数据库0600、systemd UMask0077。最多200篇，单篇12MiB，当前和最近3个历史版本合计64MiB；达到限制返回明确错误，事务回滚。单张图片8MB，保留原始 data URL，不发往 GitHub。

SQLite FULL同步，单进程操作序列化、事务 CAS revision；其他会话已更新返回409，禁止悄悄覆盖。文章冲突可载入远端、另存草稿或下载；项目/影像冲突保留当前页，需下载与重新载入比较。手机 IME composition 完成再保存，退出未保存页有提醒；系统强杀浏览器/断网最后一笔输入无法保证，必须看到云端保存确认。

“私有草稿与恢复”可下载单篇、恢复最近3个历史版本、显式删除已完成草稿。数据库启动时和每小时生成一致性备份，保留3份；物理数据库上限256MiB，加备份和临时文件需预留至少1.5GiB。备份在同一 VPS，可恢复误操作，不能抵御整机丢失；本轮不向外部传输私人草稿，异机备份另定私有目的地后实施。

整库恢复：先停止独立 Admin 服务，保留原数据，运行 `node ops/admin-broker/restore-drafts.mjs /ABS/backup.sqlite /ABS/new-private-directory`。验证 quick_check 和草稿目录后，将私有配置的 draftDirectory 指向新目录再启动。恢复工具只创建新目录，拒绝覆盖。回退时停 Admin，恢复原配置及目录；不影响公开网站。不要直接用 cp 覆盖运行中的数据库。

## 一次性变更申请（尚未批准）

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

## 尚待验证

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
