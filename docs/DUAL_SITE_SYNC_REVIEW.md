# 双站内容同步审查：生产 NO_GO

Draft PR [#29](https://github.com/Tkkdy/tkkdyyy.github.io/pull/29)，基于实时 main `4dd98aee17264fefd4399afd550264696afd2902`。本轮只有开发、只读检查和隔离验证；没有合并、生产安装、配置变更或内容发布。PR22 保持 Draft，仅选择性参考其 profile/RSS/产物校验；没有携入 owner 发布框架。

## 已核实的生产基线

- current：`releases/owner-tkkdy-d3b094b33d24-2026102900000007`；116 文件逐项哈希一致。
- manifest：`d3b094b33d246ebebce03a897ded8b5970545e3a0413f862cd796165a54d823d`。
- provenance：`OWNER_DERIVED_STATIC`、`ciAccepted=false`、source `88ac30aa31d4c806e6af9a71b955db2f0dd16967`，保持原样。新代码在远端内存中只读验证了真实 approval、derivation、完整 release、原基线及 guarded/indexable 完成证据，PASS；没有写服务器文件。
- 当前只有六个常驻 Python 模块；早前九个模块是临时 owner 执行包，不能混淆。精确配置和逐模块摘要见 [变更计划](dual-site-change-plan.json)。
- 正式首页 HTTPS 200、canonical 正式域、HTTP 无 noindex；www HTTPS 301 至 apex；preview HTTPS 200、HTTP noindex、canonical 正式域。Nginx 不需再改。
- VPS 对 Pages/朋友站点/editor 的单次直接出口采样出现网络异常，标为 NETWORK_UNVERIFIED；独立 Windows 既有网络路径严格 TLS 采样分别为 Pages 200、leux.me 200、music.leux.me 200、editor 302。不能把出口异常推定为服务故障；302 只证明入口。

## 首笔内容批次：必须单独认可

main 的公开内容与 0007 不同。新分支没有修改任何文章或上传图片，但首次 main 构建会将这些已在 Git 中的变化同步到 VPS。逐路由、RSS、图片、源文件 frontmatter 清单见 [真实产物对比](dual-site-initial-content.json)。

| 路径 | 公开标题 | 状态 / 首次 VPS 影响 |
| --- | --- | --- |
| essays/agency/ | 生活的主语 | 新增，published |
| essays/chances/ | 选择之前 | 新增，published |
| essays/games/ | 爱玩游戏的小孩，没有游戏的天选 | 新增，published |
| essays/ipad-pro/ | 吃灰的 iPad Pro | 新增，published |
| essays/re/ | re手写信 | **此前 deferred；当前 main 是 published，首次同步会公开，尚未获本次 owner 批准** |
| articles/context-is-the-new-interface/ | 上下文正在成为个人 AI 的真正界面 | 修改；末尾含两段 2026-10-29 Development fixture 验收文字和一张验收图片；不能当作纯 SEO 更新默认带上 |
| src/content/essays/p1-editor-migration-verification-20261027.md | P1 编辑发布链路验收草稿 | draft；没有 HTML/RSS，新增浏览器负向验证其不进入 Pagefind |

公开 HTML 40→46：新增五篇随笔和 `tags/批判/`，没有删除公开页面；24 个既有页面 main 文本变化清单见 JSON，其中多数为已有 UTC 日期显示修正、聚合页计数及排序变化。RSS 10→15；原十条 GUID 保留旧 URI，链接指向正式域，新五条 GUID 用正式域 URI。新增图片 `uploads/context-is-the-new-interface-1-87269e2e172d.png`，旧上传图片无删除/改写；Pagefind 文件 51→58。

全站还会包含 main 已有的移动导航/搜索改进、首页标题换行及 UTC 日期格式。Pages 管理台后续代码没有整份覆盖；VPS 产物继续移除 admin。Pages base 仍为 `/tkkdyyy.github.io/`，构建产物独立。

## 最小实现与文件范围

- `astro.config.vps.mjs`、`scripts/vps-indexing-profile.mjs`、`write-vps-profile.mjs`：缺省 preview；production 只能使用 `https://tkkdy.me` HTTPS 根地址；写入明确 marker。`package.json` 仅改 `build:vps` 字段，保留 main 编辑台依赖。
- `src/pages/rss.xml.ts`、`src/lib/rss-guid.mjs`、`src/data/vps-rss-guids.json`：VPS 历史十条 GUID 稳定；Pages 原逻辑保留。
- `release_bundle.py`、`write_version.py`、`publish_client.py`、`receiver.py`、`rollback_release.py`、`indexing_profile.py`：可信调用方、产物、公示身份、policy 与回滚 profile 一致；原 strict TLS、source/main/祖先、超时、单次 SSH 及失败回滚保持。
- `release_records.py`、`owner_records.py`：明确读取真实 0007 来源，校验 root-owned 一次性批准、derivation/manifest、原基线来源、两阶段完整证据；CI 新记录明确 `CI_ACCEPTED`。不伪造旧 provenance。
- `seal_owner_completion.py`：未来 owner-only 单次准备工具，默认 dry-run；按冻结原始摘要封存已有完成记录为 root:987 0640，拒绝覆盖、非 root、错误摘要；不改旧私有文件权限，不调用网络或发布。
- `browser_gate.mjs`：只加入 profile/canonical/noindex 检查和严格限于 loopback 的测试 canonical；公网禁止覆盖 canonical。新 `verify-local-profile.mjs` 只用于临时目录浏览器/移动端/共享预览检查。
- `.github/workflows/deploy.yml`：保留五个原 job、受审 pipeline 双 checkout、forced-command、版本报告及环境名称；只传递 profile、保持公共 editor 链接一致，并增加明确单次 dispatch 参数。单次仅允许 main、输入 `controlled_vps_release=true`、`approved_source_sha` 等于事件 SHA；server 仍独立验证实时 main。自动开关仍 false。对该授权条件增加正反向测试，没有改运行中的 editor。
- `.github/workflows/ci.yml` 与对应 Python 测试：三目标真实产物、静态正反向 SEO、真正 UID997/GID987 接收器与 ACL/记录/回滚隔离测试、真实 Chrome 搜索/图片/移动端。保留 `ci.yml/check` 名称，编辑台原 publisher 等待整个 CI run success。所有 `tee` 管道明确使用 bash pipefail。

## 真实验证与边界

[41175825554](https://github.com/Tkkdy/tkkdyyy.github.io/actions/runs/41175825554)：check、preview、production、isolated-acceptance 全部 success；原始日志确认 profile 13/13、UID997/GID987 过渡 18/18、历史回滚 7/7。真实 Chrome 正式/预览检查、共享 production 内容 canonical+HTTP noindex、移动端搜索和图片均 PASS。

最终 head 随此审查文件补充：增加构建 profile 非法组合、草稿 Pagefind 排除、封存错误摘要/非 root 拒绝，必须以 PR 最新 **相同 head** CI 原始日志及 artifacts 为最终依据。`frozen-change-plan.json` 在 CI 中绑定实际 head、模块字节与两份拟议 policy 的 SHA256；这只是精确审查材料，`applied=false`。

早前 [41175376798](https://github.com/Tkkdy/tkkdyyy.github.io/actions/runs/41175376798) 工作流上下文无效；[41175457320](https://github.com/Tkkdy/tkkdyyy.github.io/actions/runs/41175457320) 原固定条件测试失败；[41175598204](https://github.com/Tkkdy/tkkdyyy.github.io/actions/runs/41175598204) 外层绿色但原始 Linux 测试失败，**不计 PASS**。该退出码问题和 fixture 代码目录读取权限已修复。

Linux 过渡测试的 GitHub authority/服务器 HTTPS 使用显式隔离替身，证据是模拟内容与临时文件；没有测试真实生产 SSH 密钥握手或生产 release 切换。真实 0007 provenance 另做远端只读验证。上述边界不等于生产验收。

## 首次生产准备：仍待明确授权

机器可审的 before/after、ACL 范围、摘要见变更计划及最新 CI 的 frozen plan；不是当前执行指令。

1. 审批本 PR 精确 head、首次内容批次（尤其 re 和 Development fixture），再允许合并；如果内容不认可，先让 owner 决定延期项，不能私自改文章来获得发布授权。合并后必须验证 main 内容树等于已审候选并冻结真正首次 source SHA；不得推断后续新增 main 内容也被认可。
2. 只读重验 0007/current、所有冻结配置与部署 UID/GID。先保存安装模块、policy、Variables、ACL 的精确快照，停用状态保持；只安装 frozen plan 的模块白名单，root-owned 0644。source_authority.py 与现装仅换行不同，保留现装 SHA，不无谓替换。
3. 现有 UID997 无写权限，明确批准后才可添加 named ACL：部署根、releases、records 给 preview-deploy rwx；既有 `.ci.lock` 给 rw。不改旧 root 文件，不改 SSH、Nginx 或其他站点。先后复核非 root 真正可读可信记录、可用锁。
4. 使用 frozen plan 的 exact 原 root completion SHA 和 manual record SHA，root dry-run 后执行唯一无覆盖封存；完成文件 root:987 0640。完整校验其两阶段链。不是新 owner attempt，不重跑 0007，不创建 0008。
5. 精确策略：site 改正式域、indexingProfile=production、reviewedWorkflowSha=已审 pipeline SHA；保留 repository/sourceAuthority/bootstrap/approvedSourceShas/root。安装阶段 enabled=false；一次受控发布时才 enabled=true。Variables 只按冻结清单对齐，`VPS_AUTODEPLOY_ENABLED=false` 不变；Pages/editor 值不变。
6. **凭据/环境 NO_GO**：本轮仓库 Secrets 名称列表为空；既有 `vps-preview` environment 查询 HTTP404，SSH host/user Variables 缺失。密钥就绪、既有 forced key 指纹/限制及环境保护不能确认。先在独立批准范围内核实现成密钥可用性，不自动造新密钥、改 SSH 或扩大权限；如需向 GitHub 配置既有部署密钥与 known_hosts，必须明确审批该安全操作。现有代码不会代替它。
7. 准备通过且明确批准首笔后，仅 dispatch main 的单次参数与精确 source SHA，完成真实双站版本/资源/浏览器核验；任何失败按原 receiver 回滚并停止。部署环境名称沿用原 workflow，不因其叫 preview 就使用 preview SEO。不要把绿色构建当发布成功。
8. 首笔真实成功后，owner 另行决定是否启用长期自动发布；本 PR 或首笔授权均不默认包括将 `VPS_AUTODEPLOY_ENABLED` 改 true。

## 回退

内容回滚优先用审过的 production policy + 新 rollback 模块，从实际失败/当前 CI release 原子切回仍保留的 **indexable 0007**，验 manifest、provenance、site/profile 和严格 HTTPS，再记录 rollback。生产 noindex/Nginx 完全不动。临时 Linux 已证明成功 CI→0007 和 browser FAIL/超时→0007。

若撤销准备配置：先阻止后续 VPS job、policy disabled，再用所存快照精确恢复 policy、Variables、模块和 ACL；不能先移除 ACL/来源验证器导致回滚失效。新 completion 记录保留为审计证据，不覆盖旧记录。旧 115 文件 release 与 production policy 不兼容，不能关闭 profile 检查强退；其恢复需独立的历史 policy/config 快照与批准，既有 owner 配置备份保留。

## GO / NO_GO

| 项目 | 状态 / 证据 |
| --- | --- |
| 0007、policy、Nginx、Variables、安装模块无漂移 | PASS：本轮只读原始证据 |
| 实时 main、PR22 及选择性依赖闭包 | PASS：main 4dd98aee，PR22 未合并 |
| 三目标构建、SEO/RSS/normal+utility HTML、图片/Pagefind | PASS 上述 run；最终以最新同 head CI 冻结 artifact 为准 |
| UID997/GID987 成功、失败路径、真实回滚和共享预览浏览器 | PASS 上述原始日志；最终同 head CI 需继续通过 |
| 本轮实际生产修改或内容发布 | NOT_RUN，未授权 |
| 首次内容批次，包括 re 和验收 fixture | 待 owner 明确认可，NO_GO |
| 生产目录/锁写 ACL 与 durable completion | 现存缺失；仅临时目录演练，待批准，NO_GO |
| production policy/Variables 对齐 | 只有拟议精确差异，未执行，NO_GO |
| 部署密钥、known_hosts、forced SSH 握手、环境状态 | UNVERIFIED / 阻断；不得猜测就绪 |
| contentAutoMergeEnabled 当前值/私有会话实时效果 | UNVERIFIED；服务 active，但读取单一布尔值也需要 sudo 密码，未读取凭据或私有草稿。PR24 owner 身份合并不单独证明当前开关 |
| 长期自动发布 | 继续关闭；需要首笔成功后的独立决定 |

日常路径不需要 owner attempt：editor 仍走已有内容 PR→ci.yml/check 与 GitHub 安全合并→同一 main SHA 分别构建 Pages/VPS→既有 guarded receiver/浏览器/失败回滚。只有首笔 lineage/权限/策略对齐需一次准备。工程变更仍走人工审查；普通内容更新不能触碰固定 pipeline 或回退到旧域/preview noindex。两站版本报告按各自 deployment.json 判断成功、失败、未同步；一站失败不冒充整体同步成功。
