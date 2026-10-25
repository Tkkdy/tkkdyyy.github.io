# 当前隔离开发状态（2026-10-25）

本目录复用先前自动发布准备包，尚未安装到VPS、没有部署密钥、没有启用任何生产自动发布。下面历史准备记录保留供审阅，以本节为当前状态。

新增：receiver在独占锁内先返回当前版本，客户端可自动绑定expectedCurrent；生产策略草案通过公开GitHub main精确SHA与已部署版本祖先关系进行发布前双次检查，未知/退后/分叉或API不可达均停止。手动allowlist模式保留供受控演练。生产策略默认enabled=false，reviewedWorkflowSha仍未配置，不自动扩大信任。此来源检查依赖受信任流水线和部署密钥，尚无独立产物签名证明，密钥泄漏仍可影响该测试站公开内容。

浏览器门禁现在属于客户端成功verdict之前的必要步骤，实际Pagefind搜索/结果点击失败会触发回滚。version标记由write_version.py写入各站deployment.json；status_report.py独立记录每站健康和Git SHA，UNKNOWN/旧版本不显示为部署成功。公开标记属于运维数据，不包含凭证。

.github/workflows/dual-target-validation.yml仅在codex/dual-site-m1-m2隔离分支push时运行：contents:read、无secrets、无Pages部署、无VPS连接。两个构建并行且fail-fast=false。VPS任务在一次性runner创建临时非root账户、loopback sshd和临时CA，执行真实客户端/接收器、可信TLS、全资源哈希和浏览器验收，以及失败/EOF回滚、锁冲突、拒绝覆盖、保留release和密钥撤销。临时密钥不进入artifact。测试仍不能替代真实VPS安装后的UID/ACL/主机指纹核对。

生产双发布及Admin尚在准备，不把隔离CI成功等同于生产启用。旧单站DRAFT仍是历史方案，不直接安装。新增加的真实隔离测试结果以GitHub运行和下载的证据为准；编写脚本不代表已经通过。

# 受限 GitHub Actions 发布：本地准备包

当前状态：LOCAL_DRAFT_TESTED，未推送、未启用、未配置任何凭证、未安装接收器。当前 HTTPS release 和 GitHub Pages 完全不受这些草案影响。本文不是服务器安装成功证明。

## 已有实现与证据

- preview-vps.workflow.DRAFT.yml：独立手动 workflow_dispatch；没有 push、PR 或 pull_request_target 部署触发。令牌只有 contents:read；所有 action 固定到从官方仓库解析的40位SHA。build无部署凭证，deploy为独立job并引用vps-preview环境，默认缺少启用变量即不部署。
- release_bundle.py：读现有静态dist，校验后台隔离、明显秘密模式、canonical/noindex/内部引用/RSS/Sitemap，写静态ZIP、逐文件bytes/SHA与源GitSHA/工作流SHA/Node/lockfile/VPS配置哈希/命令。业务域名读取SITE_URL；新域名配置校验测试通过。它不证明新域名实际DNS/TLS已部署。
- receiver.py：仅Linux专用非root UID与 deploy-v1 强制命令。只读root维护的禁用策略；来源SHA白名单和工作流SHA必须匹配；限制路径、ZIP大小、链接、重复项和哈希。候选先写新release、回环HTTP健康检查后才原子切current。保持锁直到外部单次校验的提交决定；失败、EOF或受控超时恢复旧current并核对HTTPS。无sudo、shell、Nginx、证书、DNS或删除历史release接口。
- publish_client.py：严格已固定known_hosts、单SSH会话；外部串行逐文件可信HTTPS/字节数/SHA校验及后台/错误页404；普通20秒，大于1MB为60秒，无重试。原生curl指标和服务器事件保存为artifact。
- policy.DRAFT.json：enabled=false；源码白名单仅当前修复828dc000；工作流SHA尚未配置。开启之前必须确认审查范围。来源元数据由受信任流水线/部署凭证背书，当前草案没有独立GitHub artifact attestation验证，不能声称密钥泄露后仍能证明源码来源。
- test_bundle.py：16项本地测试通过，含现有验收ZIP完整性、穿越/绝对路径/链接/重复manifest/错误哈希与字节数/后台/私钥/noindex/canonical/未批准来源与域名配置。
- test_transaction.py：12项本地故障注入模拟通过，直接调用receiver实际事务函数，涵盖验收失败/EOF/超时/哈希错误/未知current/记录写失败/切换后异常/提交后ACK丢失。仅逻辑模拟，不证明Linux SSH、ACL、锁、信号或磁盘原子性真实通过。transaction-tests.log保留结果。本机WSL未安装，未安装新环境。
- workflow-validation.json：本地YAML结构与权限/动作SHA/凭证隔离校验通过。tests.log保留实际输出。

## 尚未验证，不允许按“已可用”启用

Linux实际UID/ACL/forced-command、SSH断连/超时/并发和回滚的集成测试尚未运行；未运行真实GitHub Actions，也未核验仓库当前环境审批与保护规则。Python语法与纯包校验测试不能代替这些测试。当前SSH会话已结束，本轮没有为此重新登录VPS。

当前手动发布验收含浏览器Pagefind真实搜索和结果点击；草案自动路径只有资源和现有npm测试，不包含新的浏览器搜索运行。自动发布启用前需在隔离演练中补齐浏览器功能验收，或明确将每个新release的该项验收保留为人工批准门禁。未经确认不能把它标为完整端到端验收。

## 集中批准前的最小变更范围（尚未执行）

1. 先只读核对实际sshd限制、账户、目录owner/mode/ACL、Nginx运行身份与当前release。不得改用psyduck管理员密钥作为CI凭证。
2. 新建专用preview-deploy账号：无sudo、无额外组权限、锁定密码；其home/.ssh/authorized_keys和接收器/策略全部由root控制，防止部署UID修改强制命令或策略。不要授予交互认证。仅添加一把独立部署公钥；私钥仅进入GitHub受保护环境，不回显、不入仓库、不复用个人SSH密钥。
3. SSH公钥限制模板：restrict,command="/usr/bin/python3 -I /usr/local/lib/preview-deploy/receiver.py" ssh-ed25519 PUBLIC_KEY。-I隔离解释器；脚本显式从自身root控制目录加载共享校验器。禁止端口/agent/X11转发与PTY。若现有AllowUsers拒绝新账号，单独列明后批准；不自动扩展其他登录规则。
4. 只授予该UID对测试站current父目录、releases及records所需的ACL；不改原owner、其他站点、证书、Nginx配置或防火墙。ACL写权限只能通过上述受限SSH命令使用。先保存这三个目录ACL和账户配置清单到独立时间戳备份，不能覆盖已有备份。
5. 接收器与共享模块放/usr/local/lib/preview-deploy，由root所有且部署UID不可写；策略放/etc/preview-deploy/policy.json，owner root，禁组/其他写入，默认enabled=false；填实际审核过的workflow完整SHA和允许发布的源码SHA。没有允许来源就失败，不自动信任PR。
6. GitHub侧单独创建vps-preview环境并设置必须由所有者审查、禁止绕过及仅允许main工作流。环境凭证仅VPS_DEPLOY_KEY与精确固定的VPS_KNOWN_HOSTS；站点/主机/用户用变量。环境名称本身不会创建审批规则；必须核对规则实际存在。不能用ssh-keyscan输出直接替代独立核实的已知主机指纹。
7. 现有main禁止直接修改/推送。本草案未来应走单独受审查分支/PR，代码合入和Actions启用不包含在当前恢复授权里。将*.py放deploy/vps，草案工作流未来才放.github/workflows/vps-preview.yml；GitHub Pages原工作流不改。
8. 在隔离演练目录验证正常发布、候选失败不切换、错误哈希拒绝、现有版本不覆盖、外部失败/EOF/超时回滚、锁冲突、凭证撤销、浏览器搜索门禁。只有实际记录通过，才评估启用VPS_AUTODEPLOY_ENABLED=true。观察期内继续冻结当前线上版本，不自动部署。

风险：新增真实认证与目录写权限属于新的安全变更；即使命令受限，部署凭证仍有修改测试站公开内容的能力。环境审批和已审查工具不能取代私钥保护。SIGKILL或主机断电不保证进程执行except；intent记录用于管理员核对和人工恢复，不自动反复发布。

## 禁用与回退（启用前须写入批准单）

优先取消VPS_AUTODEPLOY_ENABLED并撤销独立公钥、将策略enabled=false；不删除已有release。按当次备份恢复仅新增的ACL条目与账户授权文件，不改变原用户权限。已发布站点的current回退必须核对expected current再原子替换；沿用已验收的手动回滚方案和证据，不把撤销CI权限等同于内容回滚。未知配置/哈希漂移立即停止。整个准备包当前没有安装命令被执行。

## 观察期

只读定时观察vps-7已建立，每12小时、最多14次；从2026-10-25T14:29:45Z起至少7天，最早2026-11-01T14:29:45Z。正常无变化保持安静，新故障或结束再通知。它不执行自动发布、reload或回滚。需要电脑开机且桌面应用运行；漏跑列为缺口，抽样不等于连续可用。当前音乐站直连异常与代理浏览器通过分别保留，不判定为测试站故障。

## 官方依据

- GitHub secure use：https://docs.github.com/en/actions/reference/security/secure-use
- GitHub environments：https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments
- 定时任务：https://learn.chatgpt.com/docs/automations?surface=app
