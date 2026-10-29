# tkkdy.me 正式域名迁移：待审批实现

## 任务与边界

本 PR 只准备代码和隔离验收，不是上线授权。禁止合并、修改 GitHub Variables/生产策略、部署程序、Nginx、current 或 releases；不启用自动部署。Pages 保留原地址和独立构建，编辑器认证/存储/发布逻辑及朋友站点不变。新增 workflow 只有 contents: read 和测试，不读取部署 secrets，不连接 VPS。

固定源基线：`f006dc383b9f01b0a76d62e075ea7584fe0c0729`。VPS 当前记录：`88ac30aa31d4c806e6af9a71b955db2f0dd16967`，曾附加手工修复 `828dc0005875b44bf945ffb82d49d31af9155560`；实际 current 为 `releases/preview-main-88ac30aa-f4f1c891-20261024T035620Z`。不能把源码 SHA 等同于完整部署身份。

## main 与 VPS 内容审计

源码范围 `src/content`、`public/uploads`：相对记录的 mainSha，有以下6个文件差异；本 PR 不修改这些文件，也不上传构建产物至 VPS。

| 文件 | main 状态/变化 | VPS 发布决定 |
|---|---|---|
| articles/context-is-the-new-interface.md | 已发布文章正文修改；含 2026-10-29 Development fixture 验收段落 | 待确认，不能顺带上线 |
| essays/agency.md | 新增已发布《生活的主语》 | 待确认 |
| essays/chances.md | 新增已发布《选择之前》 | 待确认 |
| essays/games.md | 新增已发布《爱玩游戏的小孩，没有游戏的天选》 | 待确认 |
| essays/re.md | 新增已发布《re手写信》；旧部署记录明确 deferredArticle | 继续保留未批准状态 |
| essays/p1-editor-migration-verification-20261027.md | 新增 draft，homepage.show=false | 继续排除在公开构建外 |

实际运行目录只读清单与候选构建交叉核对：线上40个HTML，候选45个；新增为四篇随笔详情和 `tags/批判/index.html`，没有删除旧路由。新增文章还会改变列表、标签、搜索和RSS，不能只批准一个详情路径却忽略派生内容。记录的手工修复源码不在远端 main 历史中，不能声称源码 diff 能完整重建现网；实际文件清单作为补充证据。

三种分支构建均使用此 PR 的测试源码，包含 main 中待确认的新内容，都是测试产物，`audit_profiles.py` 报告固定 `releaseApproved:false`。不得把其 CI 成功解释为内容发布批准。正式发布前必须重新冻结用户确认过的内容范围和精确源码/工具 SHA；若需要保持 VPS 当前内容，应另行准备有明确差异的内容冻结提交，不能伪造当前 main 的产物身份。

## 构建和身份

- Pages：`npm run build`，地址和 base 不变，不读取 VPS 的发布模式。
- VPS 预览：`SITE_URL=https://preview.boenbot.top VPS_INDEXING_PROFILE=preview npm run build:vps`；未指定模式仍是 preview。
- VPS 正式：`SITE_URL=https://tkkdy.me VPS_INDEXING_PROFILE=production npm run build:vps`。模式非法或正式地址不是干净 HTTPS 根地址时失败。
- VPS 输出包含 `vps-build.json`，身份写入器必须与指定模式匹配。公开 deployment.json 和 release.json 都记录模式；缺字段的旧记录只能按 preview 处理。
- 客户端由受审流程选择模式，服务端由 root-owned 策略选择模式，产物不能自我授权。错误模式在创建SSH连接/解包发布前拒绝。
- 原有 digest、manifest、ZIP路径、来源SHA、pipeline SHA、静态文件/Admin隔离与来源授权检查保留。增加 OG/sitemap索引/目标存在性与模式检查。
- `.github/workflows/deploy.yml` 只传递模式，默认仍 preview；VPS_AUTODEPLOY_ENABLED 门禁、Environment、源码与工具双checkout保留。更新 REVIEWED_PIPELINE_SHA 会同时影响 Pages 使用的工具版本，须先验收两个目标。旧受审工具不支持新参数时应失败，不能绕过。

RSS：从现网只读获取10个历史条目的GUID，保存于 `src/data/vps-rss-guids.json`；源 RSS SHA256 为 `6dbf1a109890a05fa3c3c712ca20464aa9c2885a9f5527c8d5eded560ff55a04`。新域名导航链接变化，但已有GUID保持原值；新条目使用新域名GUID。Pages/预览GUID行为不变。不把GUID当做错误旧域导航链接。输出通过测试确认每条只有一个GUID。

## 上线前的确认材料（本 PR 不执行）

提交精确源码SHA、pipeline SHA、产物摘要、内容确认清单、旧current/manifest/记录/策略/工具/Nginx/变量快照，以及回滚 dry-run 结果。当前 receiver enabled=false，reviewedWorkflowSha=NOT_CONFIGURED，原样保留。策略草案 `tkkdy-production.policy.DRAFT.json` 同样 disabled，不能直接用于上线。

1. 在旧策略下先核验旧版本完整manifest和历史记录摘要。旧记录缺 site/sourceSha；复用 import_manual_release.py 的显式 legacy-record-sha256 导入，保留原记录不改写，生成 OWNER_VERIFIED_LEGACY，ciAccepted=false。只在另获上线授权后写生产桥接记录。
2. 保存 root-owned 旧策略快照和完整回退材料。使用旧策略与明确 expected-current 做回滚 dry-run；缺manifest或摘要不匹配就停止，不能删掉 site 比较或伪造CI记录。
3. 在现有受控发布方式下执行单次 owner 发布，不为了首次迁移启用 receiver/自动部署、改认证或安全权限。新策略site/profile、受审工具、变量变更必须单独确认；不以更改工具绕过 disabled 门禁。
4. 持有现有发布锁，检查 expected-current 和配置摘要后安装独立新release，不覆盖旧目录；使用受控原子current切换，不用临时手工覆盖symlink。
5. 先切换正式产物，暂留新域名的HTTP noindex头，验收新旧站与资源。此时仍不应收录。最后仅移除新域名的全站noindex头，nginx -t通过才reload；旧域名noindex头原样保留，旧站不301。共享current意味着旧域名正文同步更新、canonical指向新域名。
6. 正式验收：普通页面无HTML/HTTP noindex；search/404保留noindex；canonical/OG/sitemap/RSS导航新域名一致；HTTP/www301保留路径查询；完整文件/搜索/桌面移动端/Pages/编辑器入口/朋友站点/TLS续期检查。不得把允许收录当做已被搜索引擎收录。

## 回滚

回滚由owner操作、默认dry-run，继续校验root-owned策略、锁、expected-current、完整manifest、legacy桥接、site及indexingProfile匹配。公共部署密钥无回滚入口。

- 同域正式版本回退：使用匹配site/profile的正式策略快照。
- 跨回预览版本：先恢复新域名noindex保护；选择保存的旧策略快照，通过 `rollback_release.py --policy <旧快照> --expected-current <明确的新版本> --target <明确的旧版本>` 验证。不能拿正式策略直接回滚旧站记录，更不能接受任意site。
- 审批后apply，再恢复对应策略/工具/变量/Nginx并验收两域。所有release、证书和记录保留。策略和Nginx恢复不是 rollback_release.py 自动完成的，必须在受控owner迁移事务中明确配套，不能声称该工具单独实现了全部配置回滚。
- 回滚脚本自身的HTTPS后验收失败，会尝试原子恢复expected-current；整体迁移随后保持新域名noindex，保留失败证据，停止而非循环重试。

## 验证可信边界

本地/CI构建不是上线；浏览器使用127.0.0.1临时服务，不证明公网候选HTTPS。Linux回滚测试在临时root-owned目录中使用真实flock/symlink/fsync/manifest，HTTPS边界被mock；不能声称已在生产执行回滚。本轮禁止生产桥接写入及current切换，因此现网旧格式记录的实际回滚dry-run须留待上线前完成。

CI 三构建、模式反例、内容parity、浏览器及Linux回滚结果见PR检查；本地详细日志与只读线上摘要保存在本次聊天的本地验收目录，不把私有日志或部署凭证提交到仓库。
