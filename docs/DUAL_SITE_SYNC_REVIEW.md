# 双站同步审查（开发中，生产 NO_GO）

基于 main `4dd98aee17264fefd4399afd550264696afd2902`，PR22 仅作为 profile/RSS/产物验证参考；不合并 PR22。生产 0007 保持原状。

## 边界

本 PR 仅开发与隔离 CI。不得据此安装生产代码、修改 policy/Variables/ACL/Nginx/current 或启用自动发布。`workflow_dispatch` 新增显式单次参数：仅 main、精确 approved_source_sha 与当前事件 SHA 一致才允许单次 VPS job；自动发布开关保持 false。实际 server 仍校验 main 和祖先。

## 首次过渡

0007 保留 OWNER_DERIVED_STATIC、ciAccepted=false 及原来源 SHA。新只读模块检查 root-owned approval/derivation/manifest、原基线与两阶段验收。只在未来明确批准后，由 root 将原完成记录按冻结摘要复制为 root:preview-deploy 0640 的 durable record；不改历史私有文件权限。首次 CI 记录明确为 CI_ACCEPTED。

只读检查确认实际 UID997/GID987 目前无发布目录/锁写权限，必须另行审批最小 named ACL；本次只在 Linux 临时目录演练。不得仅设置自动开关。

## 待完成证据

真实三构建/负向产物校验、Linux root/nonroot 成功与失败回滚、main 相对 0007 的逐项内容清单、确切生产安装/策略/Variables 差异及冻结摘要，完成后补齐本文件。
