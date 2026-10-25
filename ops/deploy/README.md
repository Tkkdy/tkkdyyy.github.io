# 双站受限自动发布：实现与启用边界

当前为隔离验收通过、生产未安装。真实 Ubuntu Actions 40219977768 已运行正式客户端和接收器、严格 SSH、可信 TLS、全资源摘要、Pagefind 浏览器门禁及所有者回滚，补齐旧人工版本导入后真正切回/恢复。45 项部署测试通过。完整证据见仓库外 M2-isolated-acceptance.md 和 evidence/ci-40219977768；隔离成功不证明真实 VPS UID/ACL 已配置。

## 实际实现

- dual-publish.workflow.DRAFT.yml 位于 .github 外，未启用。未来批准后替换现有 deploy.yml，不可并行启动两个 Pages 发布工作流。两站各自构建和部署，只依赖自己的构建任务；锁定相同源码 SHA。当前正式 deploy.yml 保持不变。
- 发布工具从精确 REVIEWED_PIPELINE_SHA 读取，源码来自当次 main SHA；接收器发布前两次核对公开 main 与已部署源码祖先关系。未知、退后、分叉或 API 失败均拒绝新发布。
- release_bundle.py 校验路径、类型、秘密模式、后台隔离、canonical/noindex、资源引用和逐文件字节/SHA；记录源码、流水线、配置和 lockfile 哈希。50 MB 总量、8 MB 单文件限制。
- receiver.py 非 root forced-command，仅 deploy-v1；独占锁、expectedCurrent 比较、候选健康检查、原子 current 和不可覆盖 release。等待客户端成功 verdict 才写成功记录；否决、EOF 和受控超时回滚。历史版本全部保留。
- publish_client.py 固定 known_hosts；资源串行可信 HTTPS 校验，普通 20 秒，超过 1 MB 为 60 秒，无不安全 TLS 或重试；browser_gate.mjs 的真实 Pagefind 搜索/点击属于成功前必要门禁。
- import_manual_release.py 仅 root 所有者调用，默认 dry run；固定原清单SHA、完整目录与字节检查、当前目标比较和可信HTTPS关键资源核验后，才以manual-记录保留人工版本归属，ciAccepted=false。安装需先为部署UID建立0600锁，导入不会创建root专属锁、切换current或修改release。
- rollback_release.py 仅所有者调用，默认 dry run，核验CI记录或明确导入的manual记录、完整manifest及所有文件（含未列出文件拒绝）后才允许 --apply；切换失败恢复原 current 并核对 HTTPS。日常密钥不能调用。
- status_report.py 分别报告两个公开版本与 HTTP 健康。版本相同不代表完整功能验收。GitHub 提交、构建成功不能显示成两站发布成功。

## 生产启用前仍须完成

实际 VPS 的只读 UID/ACL/sshd/目录/主机指纹核对、原 release 的真实导入核验、专用部署账户和密钥、root 所有策略/接收器安装、真实环境审批设置和安装后回滚演练均未执行。policy.DRAFT.json 仍 enabled=false，reviewedWorkflowSha=NOT_CONFIGURED。不能直接安装并打开开关。

现有手动 release 不一定带新接收器要求的 records/manifest；自动失败回滚 current 可以返回它，但 rollback_release.py 主动选择目标需要记录。import_manual_release.py 已实现上述兼容，但未在VPS执行。必须从已有验收 manifest 独立核验全部字节并建立可审计迁移记录；在实机验收前保留旧人工回滚入口；禁止伪造过去由新系统接受的成功记录。

集中审查准备与未决参数见仓库外 Production-change-review.md。目前无已批准生产安装命令。生产部署所需的新身份、ACL、密钥与工作流变更不能继承旧 HTTPS A 授权。

## 日常操作与失败处理

批准启用后：内容从 Admin 提交 main → 两站独立构建 → 各自部署 → 查看各目标实际版本和 job 失败步骤。任何目标失败均保留它的旧版本；另一目标继续。GitHub API 不可达阻止新发布，不影响现有静态站。

先停止新发布并撤销专用密钥，再检查 intent、成功记录、current 和逐文件哈希。不要盲目重跑或直接删除失败 release。SIGKILL/断电不保证自动回滚，需所有者依据记录受控恢复。撤销 CI 权限不等于回滚内容。

未来换域名由 SITE_URL、policy.site、工作流变量、Admin 公共状态地址及独立 DNS/TLS 审查控制，不逐篇替换文章。先构建、校验新域名 canonical/robots/RSS/Sitemap，再按批准顺序切换。不要沿用旧证书或跨域 Cookie。

## 风险与线上保护

来源检查依赖已审查工具和部署密钥，未实现独立 artifact attestation。持有部署密钥仍有修改该测试站内容的能力；环境审批、forced-command 和路径限制不等于密钥泄露无影响。

线上 VPS 冻结 88ac30aa，Pages 原生产持续运行。只读观察 vps-7 与开发并行，最早 2026-11-01T14:29:45Z 完成；漏跑须记缺口，抽样不是连续可用性证明。http-cache-semantics High / fast-uri Moderate 风险继续保留，不为清零升级无关依赖。音乐站、Hello、Cockpit、旧预览和全部旧 release 受保护。禁止重跑单次 A 或注册新 LE 账户。
