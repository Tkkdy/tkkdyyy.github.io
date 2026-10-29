# 2026-10-29 一键发布整合候选（尚未部署）

基于已部署 c0c9c684 云端版本与 main f006dc38，保留已有 Google 网关、Tunnel、GitHub App 身份、SQLite 草稿及恢复逻辑；只在既有内容 PR 流程上启用已验收的范围/哈希/CI/准确 SHA 自动合并。

跨设备恢复使用云端草稿中的持久提交意图和签名收据；显式点击发布才恢复同一 PR，不因读取草稿或历史自动合并。模糊写入结果停止而不创建替代 PR；不同设备保存继续受既有 revision CAS 约束。公开草稿仍由服务端拒绝。合并后保存新的正文基线，后续编辑不会误用发布前哈希。

Pages 顶部云端入口从 PUBLIC_ADMIN_ORIGIN 配置读取；该公开地址不是凭证。没有把域名硬编码进业务逻辑，原 Pages 草稿和本机备用入口保留。云端启用需切换 editor 自身不可变版本及受保护配置 contentAutoMergeEnabled=true，原 Google/GitHub 凭证、权限、Tunnel、Nginx、观察 current 与 VPS_AUTODEPLOY_ENABLED=false 保持不变。真实多设备一键发布尚未验收，不能用本地测试代替。

以下为既有云端服务的历史验收与恢复基线，不是本次一键发布已上线的证明。

# 云端 Editorial Studio

入口：**https://editor.boenbot.top/**。2026-10-28 已部署独立 Admin、Google OIDC 网关和 Cloudflare Tunnel，完成真实所有者登录、写作、上传图片、独立浏览器会话恢复和已有文章私有编辑。本文记录当前状态，替代此前准备阶段的待授权与未部署描述。

## 日常使用

1. 打开入口，使用指定 Google 邮箱登录，再使用 GitHub Tkkdy 登录。
2. 首页选择已有内容，或点击“新建内容”。支持文章、随笔和碎片；项目与影像支持已有内容的基础字段编辑。
3. 输入文字、选择封面或正文图片，等待“已保存到云端 · 私有草稿”。图片和草稿保存在 VPS 私有存储，尚未提交 GitHub。
4. 换设备后登录，在“私有草稿与恢复”点击“继续编辑”。此处也能下载备份、恢复最近三个版本和删除草稿。
5. 准备发布时将状态改为“已发布”，点击发布创建内容 PR。通过必需 CI 后按现有保护规则合并，在“历史提案与部署追踪”查看两站状态。

当前仍需合并 PR；没有启用自动合并。VPS 正式自动发布仍关闭，不能将“创建 PR”解释为两站已完成生产发布。草稿状态被服务端禁止提交到公开仓库。

## 实际验收

- 指定 Google 邮箱真实登录成功，内层 GitHub 登录返回 Tkkdy、固定仓库、main 只读及 pull-request 发布模式。
- 公网有效 HTTPS。未登录的编辑页面跳转 Google；草稿、会话及认证 API 返回 401。直连 Broker 本地安全检查通过；真实浏览器匿名及伪造身份头/Cookie 访问草稿均返回 401。
- 真实公网保存中文多段正文与 PNG 图片，预览显示正文及图片；全新浏览器上下文不复制编辑器 Cookie 或 localStorage，重新经过提供方登录后恢复同一草稿与图片。
- 390px 手机宽度恢复后无横向溢出；已有文章“选择之前”可以读取并保存私有修改。未公开任何本轮验收内容。
- 草稿版本冲突真实返回 409，临时冲突草稿已清理。服务端草稿数据库权限 0600；专用数据目录 0700。
- GitHub Pages 真实状态页核验 main `5a7e80df1ac9d77351075920700bd82149ee6799`，公开版本标记与流水线均匹配。VPS 流水线 SKIPPED，公开版本标记尚不可读，准确 SHA 显示 UNKNOWN，不伪称双站一致。
- Admin 服务实际重启后，草稿、图片和历史版本摘要一致；快照恢复到新目录成功，重复覆盖被拒绝。三个 editor 服务均 active/enabled，保留三份快照，原网站保护基线及 GitHub 正式自动发布 false 均复核一致。没有重启整台 VPS。重启后在原 Chrome 正常代理路径重新登录，实际载入同一草稿的 726 字符正文与私有图片，并继续修改后获得云端保存确认。
- 真实其他邮箱登录拒绝和实体 Android/iPadOS 操作尚未验收；手机视口测试不能替代实体设备。本机排障中观察到网络路径变化：后续直连超时，现有代理访问 editor 的 API 正常返回 401（约一秒），最后已通过原 Chrome 正常代理路径的真实登录和重启后草稿恢复；未修改系统代理、DNS或其他服务。

先前本地构建、126 项检查、30 项认证定向集成及多视口写作证据继续适用；合成 OIDC 错误邮箱/签名/issuer/audience/nonce 拒绝不能替代真实第二账号验收。

## 独立部署与安全边界

链路：Cloudflare HTTPS → 独立 named Tunnel → `127.0.0.1:19445` OAuth2 Proxy → `127.0.0.1:19444` 原 GitHub App Broker。没有 editor 直达 Broker 路由，没有修改正式 Nginx，也没有新增公网监听端口。

- 专用 Tunnel：editorial-studio；只有 editor.boenbot.top 路由，目标固定为回环网关，Host 固定为 editor.boenbot.top。DNS 为代理 CNAME，指向该专用 Tunnel。
- 外层 Google OIDC：独立未关联结算账号的项目、一个 Web 客户端、唯一 HTTPS 回调；仅 openid/email/profile，唯一指定邮箱测试用户和精确邮箱 allowlist。验证 issuer、签名、audience、有效期、已验证邮箱、nonce、state 和 PKCE。
- 内层保留原 GitHub App、Tkkdy owner ID 与固定仓库 ID 验证；HTTPS callback 与原 Windows 回环 callback 并存，不改变 GitHub 主邮箱。
- 两层 Cookie 都是独立 __Host- 名称，Secure、HttpOnly、SameSite=Lax。Broker 只向固定回环网关核验会话，不信任客户端身份头或转发头。
- 三个专用 systemd 用户与服务：editorial-studio、editorial-gateway、editorial-tunnel。无新 sudoers 或 SSH 权限。凭证通过 root-only 文件和 systemd LoadCredential 传递，不写 Git、命令行或访问日志。
- Node 24.19.0、OAuth2 Proxy 7.15.5、cloudflared 2026.10.5 官方下载并核对 SHA256，独立安装，不覆盖系统运行时或其他 Tunnel。
- 不启用 Cloudflare Access/Zero Trust 计费。试建但未使用的外层 GitHub OAuth 客户端已删除。Google 初次客户端的密钥曾因控制台控件标签进入工具输出，已撤销并重建；撤销密钥从未部署，新密钥未输出。

当前部署修复版本 `c0c9c6843115f3a69fc27d9b5c8363342500e98f`，目录 `/opt/editorial-studio/c0c9c6843115`；仅修改备份目录创建为可重复执行，静态 Admin 产物保持原样，2204 个部署文件逐一核对清单。原始 `f630c94b9256` 目录仅保留审计，它包含本次已修复的备份目录问题，不作为可直接启用的回退版本。当前 `c0c9c6843115` 为已验证恢复版本；原始部署包 SHA256 `50c5bd5dc2332fd19edeef1c49ba434bf0185ad4052b7fe42721b24062cb83e2`。私有配置 `/etc/editorial-studio`，草稿 `/var/lib/editorial-studio`。代码版本分目录保留，三项服务均健康且已开机启用。

## 草稿与恢复

SQLite FULL 同步、串行事务和版本 CAS；另一会话先保存时返回 409，不静默覆盖。最多 200 篇、单篇含图片 12 MiB、当前及最近三个历史版本合计 64 MiB；单图 8 MB。数据库物理上限 256 MiB。中文 IME 完成组合输入后保存，未完成保存时离开有提醒；断网或强杀前最后一笔输入仍需看云端确认。

启动与每小时创建一致性快照，保留三份，位置 `/var/lib/editorial-studio/backups`。同 VPS 快照能恢复误操作，不能抵御整机丢失；本轮没有将私人草稿上传外部备份。

整库恢复须停止独立 Admin，保留原数据，使用工具恢复到**新的绝对目录**：

```sh
/opt/editorial-studio/bin/node /opt/editorial-studio/c0c9c6843115/ops/admin-broker/restore-drafts.mjs /ABS/snapshot.sqlite /ABS/new-private-directory
```

工具验证 SQLite quick_check 与表结构，拒绝覆盖现有目录。检查恢复数据、专用用户及 0700/0600 权限后，再将私有配置 draftDirectory 指向新目录并启动 Admin。回退时停止 Admin、恢复原配置与数据目录。不要覆盖运行中的数据库。

停止云端入口只操作三个 editorial-* 服务；回退部署只切换 editor 自身不可变版本。不得修改 preview 的 current、Nginx、正式自动发布开关、仓库保护或其他服务。

## 本地备用与能力边界

原 Windows Editorial Studio、Sveltia、GitHub App 本地 callback 和私有本地配置保留。项目/影像的复杂对象字段继续用本地 Sveltia；云端禁止 Sveltia 创建公开草稿分支，项目/影像暂不提供新建 UI。

控制通道从文件轮询改为仅 127.0.0.1 的私有能力认证通道，Host/Origin 校验、请求串行与重复请求缓存。能力值只以 DPAPI 密文保存于专用控制目录，SSH/sudo 口令只在认证进程内存，不复制密钥进 Git。本轮没有改 Windows ACL、关闭系统保护或扩大 AppData 可写范围。旧控制进程两小时到期后已 CLOSED；新 V3 控制窗口已认证，恢复验收在同一会话完成。


2026-10-28 重启验收实际发现并修复：旧备份实现对已存在目录调用非递归 mkdir，引发 EEXIST，导致后续定时备份及启动失败。新增回归测试先复现失败，修复后 10 项草稿与恢复测试全部通过；随后部署独立修复版本并再次完成真实重启、快照与拒绝覆盖验收。保留失败证据，没有以首次启动成功替代重启验收。该修复已本地提交，未推送或修改公开 main。
