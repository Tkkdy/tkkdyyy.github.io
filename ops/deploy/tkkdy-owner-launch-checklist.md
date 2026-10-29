# tkkdy.me 最终上线确认清单（尚未执行）

当前阶段仅准备与验证。PR #22不合并，current、Nginx、生产policy、GitHub Variables、已安装模块及自动部署均不改。

## 精确内容和身份

- 内容唯一基线：VPS current `releases/preview-main-88ac30aa-f4f1c891-20261024T035620Z`，115文件。原manifest `bdbd0dff0af30ac2b7c3631f22b3228ef501a0f5dcfe6203ed4055c3a5ebd6a0`；已核验桥接 `b4699ac0a78a4180c38772a401df89365369bf2ec3679fcaa2342cba6ad5c7aa`。
- 候选manifest `d3b094b33d246ebebce03a897ded8b5970545e3a0413f862cd796165a54d823d`；review ZIP `55e3ec0d8c66160e8f2cb8d2e19d02a018adc3804aa6fb77d90d07f015ccb252`。
- 116文件、40HTML、38条sitemap URL。正文、资源、Pagefind和10条RSS正文/GUID完全保留；44项SEO/模式标记差异。main中的新增随笔和文章修改均不进入候选。
- 首次目标：`releases/owner-tkkdy-d3b094b33d24-2026102900000003`，从未存在才可执行。一次失败也消耗本次ID，保留失败release/claim，禁止重跑覆盖；重试必须重新调查并另获owner批准，以新的attemptId保留旧证据。
- 新记录 `OWNER_DERIVED_STATIC` / `ciAccepted=false`，sourceSha仅表示旧基线血缘，sourceAttribution明确为现网静态派生。不伪造当前main/CI身份或deployment.json。

## 单次owner入口与校验

`owner_static_release.py`只允许root，默认dry-run；不能通过部署密钥/SSH_ORIGINAL_COMMAND触发。它使用原records/.ci.lock，不修改锁权限。原receiver enabled=false、sourceAuthority=github-main和CI门禁保留。

批准文件草案 `tkkdy-owner-once.DRAFT.json` 当前enabled=false、expiresEpoch=0，不能执行。确认后才在root专用暂存目录创建启用的批准文件，填入最多24小时的明确截止时间，并重新计算文件摘要。`--approval-sha256`必须匹配该精确文件，禁止直接启用草案或删校验。

批准文件绑定：expected-current、目标attemptId、旧source/桥接/原manifest、候选manifest、派生报告、旧policy摘要、整个Nginx树摘要、整个已安装工具树摘要、每个运行时Python模块和外部浏览器验收工具摘要。候选只读入内存，完整静态/路径/安全检查后，使用受审工具从真实旧release重新派生并逐文件比较，不能信任候选自己的parity声明。

执行前，校验固定摘要的工具TAR和候选ZIP，拷贝到新root-owned且0700的临时目录后再校验摘要，才允许解包。禁止直接以sudo执行用户可写目录中的代码。运行时目录只含批准的9个Python模块，所有模块root-owned且不可被组/其他人写；工具包还含受审外部gate源码。Python入口使用 `python3 -I -B`，脚本自己仅加入已核验工具目录。不要改变现有forced-command或安装目录。

参数形态（本清单不是现在执行指令）：

```text
python3 -I -B <受审工具目录>/owner_static_release.py   --approval <root-owned批准文件> --approval-sha256 <批准文件SHA256>   --policy /etc/preview-deploy/policy.json   --candidate <root-owned候选目录：manifest.json/derivation.json/site>   --baseline-manifest <原始manifest.json>
```

先无--apply做dry-run；只有批准范围内所有检查通过，再加--apply。dry-run无release/record写入，apply先独占记录claim，然后新建release，绝不覆盖。全过程持有原发布锁。若验收或配置摘要漂移，恢复原current并严格HTTPS核对旧首页，保留证据后停止。

## 两个验收阶段

1. owner入口原子切到候选，但保持新旧域名HTTP noindex头。服务端严格HTTPS比对两域首页/CSS/JS；再输出WAIT_PUBLIC_VERDICT及随机token。外部受审 `owner_public_gate.mjs` 使用正常公网DNS、固定域名、严格TLS，校验全部116文件（404走不存在路径）、HTTP/www路径查询301、正文页面canonical/OG/HTML索引状态、桌面和移动搜索/点击、图片、Pages独立地址、编辑器登录入口和朋友站点。token/候选manifest/gate自身摘要均须匹配，缺任一项或15分钟超时则恢复旧current。验收完成才保存owner记录；此时仍不开放HTTP收录。

```text
node ops/deploy/owner_public_gate.mjs <保存的WAIT_PUBLIC_VERDICT提案.json> <本地候选目录> <新的verdict.json>
```

gate输出文件必须与owner终端提案的token一致，经受控连接送回等待的root进程stdin，不能手填passed=true。提案/验收输出不要混入SSH stderr或其他终端文本。节点工具使用本PR锁定的playwright依赖，脚本自身摘要匹配批准文件。关闭其输出后owner进程若检测EOF会恢复旧current。

2. 只有阶段1成功、owner记录可读且完整manifest复核一致，才允许最终配置改动。先备份新域名配置、核对before SHA256，再只删除以下一行；写入后必须核对after SHA256，运行sudo nginx -t成功才reload，不能restart。随后使用原browser_gate.mjs对新域名production模式验收，并复查普通页面HTTP/HTML无noindex、search/404保留HTML noindex、旧域名继续HTTP noindex、www/HTTP301、两域与朋友/编辑器/Pages及TLS。不把可收录当做搜索引擎已经收录。

## 精确配置差异

只改 `/etc/nginx/sites-available/tkkdy.me`：

```diff
-    add_header X-Robots-Tag "noindex" always;
```

before SHA256 `8622c073248a67f66cad920a5e746a9beb0b8ba3d83d2aab0df31b0b0fc9369b`；after `b1dce4addfa6963a4b48f8b8bc3c370cb6ebb0f2a0270e0877b87401576d7f24`。其他字节、server块、ACME、TLS、root、安全拦截和重定向均不变。旧preview配置不改、不301；共享current使旧站内容相同、canonical指向新域名，但旧域HTTP noindex继续保留。

生产 `/etc/preview-deploy/policy.json` 零diff：保持SHA256 `4d08942872df7b95454d389453c41b7b3b7399720272049dc556cf5d50461bbc`、enabled=false、原site/sourceAuthority/授权字段。GitHub全部Variables零diff，REVIEWED_PIPELINE_SHA不动，自动部署仍false。Pages构建、编辑器认证/存储/发布、朋友配置、证书均零diff。新root批准文件仅授予本次固定静态迁移，不扩大普通receiver权限。

新增文件仅限root暂存工具/批准文件、独立新release和该release对应的claim、approval、derivation、manifest、manual记录及备份；不修改现有生产模块。当前main/PR均不合并。后续普通内容更新仍需独立审查正式profile/受审工具/策略的协调切换；在完成前原preview自动发布仍被disabled门禁阻止，不能用旧预览构建覆盖正式候选。

## 回滚与停止条件

- owner入口失败：自动原子恢复expected-current，严格HTTPS检查旧首页；不删除任何release/证据，不重试。
- Nginx最终验收失败：先恢复备份原配置（核对before SHA），nginx -t后reload，恢复新域名noindex；再用保存的旧策略与受审rollback_release.py验证expected-current=本次owner目标、target=旧release，dry-run通过后按此次已批准回滚范围apply。不得以正式域名策略回滚旧预览域名，不能删除site/profile校验。
- 恢复后完整比对旧manifest，严格TLS检查两域；原始旧record/bridge/manifest/证书/release一律保留。Nginx/策略回滚不是rollback_release.py自动完成的，须配套执行。
- current、配置树、工具树、旧桥接或任一摘要漂移；批准过期/被改；目标已存在；候选重放不一致；公网验收不通过：立即停止，不为了消除失败改动其他站点。

## 实测与待实测

实现提交5cee5cb的隔离CI40873578672已通过19项root-owned Linux事务/反例与原有回归。另补充1项批准草案/模块摘要一致性检查。公网观察器已用真实Chrome和精确现网候选做隔离网络集成：成功、字节篡改拒绝、缺失noindex拒绝三项通过；所有网络被夹具拦截、Google字体CSS被模拟，不代表公网TLS/字体服务验收。最终20项Linux测试与CI产物观察器集成以当前PR头部CI为准。生产owner dry-run/apply、候选公网HTTPS、Nginx新配置nginx -t/reload和真正收录切换尚未执行，需最终确认后才能验收。测试中的HTTPS/外部verdict替身不能算公网通过。

固定LF工具TAR SHA256 `40102ab2cb43d74b73192552f2013b746d7f38afcf7588a9616484829afb21bf`。草案逐模块及观察器摘要与受审源码一致性由独立测试验证。精确现网候选再次重放116文件逐字节一致，manifest仍为d3b094b33d246ebebce03a897ded8b5970545e3a0413f862cd796165a54d823d。工具TAR、候选ZIP、原始manifest和批准文件应作为不同身份分别核对，不将工具提交SHA冒充内容源码SHA。


## 公网传输修正与失败记录（2026-10-29）

attempt 2026102900000001在dry-run因Windows TAR保留0666暂存manifest权限而拒绝，未切换current；已将root暂存文件显式规范为0600。attempt 2026102900000002通过dry-run并临时切换候选，但受审公网观察器读取362687字节Logo超过30秒，实际passed=false已交回root事务，自动恢复旧current、完整manifest与双域HTTPS核验PASS。该attempt的claim/release/批准/派生/manifest及日志全部保留，不能重跑。

本机HTTPS_PROXY既有配置为无凭证loopback HTTP代理。已安装Playwright APIRequestContext仅使用context/browser显式proxy，观察器未配置时直连，不自动使用HTTPS_PROXY。相同原Logo由VPS读取约0.49秒，Windows curl经现有代理约4.28秒，隔离Playwright显式代理诊断约2.01秒；哈希均为4858ffe1aec781f04dcf44bc060a09e1540d168f5ddaa854e9283618e83332ed。隔离诊断不是owner验收，失败attempt不能因此改判PASS。

观察器和browser_gate.mjs新增可选PUBLIC_GATE_PROXY，默认仍直连；只接受显式端口、无凭证、无路径/查询/fragment的http://127.0.0.1:<port>或IPv6 loopback代理，不读取或修改系统代理。设置后同时应用到浏览器context与API请求，仍使用正常固定公共URL、ignoreHTTPSErrors=false、原30秒时限、逐文件哈希、全部站点/桌面移动搜索/身份token检查。报告记录DIRECT或LOOPBACK_HTTP_PROXY。不得使用注入/预加载修改观察器运行时。

新的禁用草案固定attempt 2026102900000003和新观察器SHA，enabled=false/expiresEpoch=0；候选manifest、ZIP、旧基线、9个Python模块、生产policy/Variables均不变。新工具TAR须重新核对本清单摘要。这个草案未获新attempt上线授权，不能执行。

未来经owner另行确认后，先用显式PUBLIC_GATE_PROXY=http://127.0.0.1:7897完成只读公网预检，再建立新的单次root入口；两阶段外部验收均显式使用该本机既有代理，最终TLS证书元数据检查也须走已声明的同一受控公网路径。root暂存工具/批准文件不可被组或其他用户写，release静态文件须保持Nginx可读。新工具不得覆盖安装目录或启用disabled生产policy。失败仍按原清单恢复noindex及旧current，并停止。
