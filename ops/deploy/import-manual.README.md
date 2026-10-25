# 手动旧 release 导入：所有者运维说明

未安装到生产。以下是待批准的操作模板，不能直接用占位参数执行。工具不会重建、复制、修改或切换旧 release，不接收日常部署密钥调用。默认预演也进行可信 HTTPS 请求；不使用不安全TLS或重试。

## 前置

核对真实 current、policy.root/site/bootstrapSourceSha、旧版本目录及原独立验收证据。原 static-manifest.json 是 path/bytes/sha256 数组，与工具格式一致。原清单必须从先前证据取出，不能临时扫描当前服务器生成并称为“原清单”。从独立证据固定其原始文件SHA256；白名单文件、总量及完整目录检查不允许额外文件、链接或特殊文件。

新安装步骤先为部署UID创建 records/.ci.lock（0600、正确UID）。导入root只打开已有锁，避免先创建root锁阻止接收器。必须同时安装root所有的 release_records.py 和 import_manual_release.py，rollback_release.py现在依赖它们。新模块和policy均不可由部署UID写入。

## 批准后命令模板

```sh
sudo python3 -I /usr/local/lib/preview-deploy/import_manual_release.py \
  --policy /etc/preview-deploy/policy.json \
  --target releases/<已核验且当前的手动版本ID> \
  --source-sha <与policy.bootstrapSourceSha相同的40位SHA> \
  --manifest <从独立验收证据上传的原清单路径> \
  --manifest-sha256 <原清单原始文件64位SHA256>
```

默认只预演，不创建manifest/manual记录。所有文件字节、完整清单、当前软链和HTTPS首页/CSS/JS都匹配后，按已批准范围附加 --apply 才落记录。全过程持有与接收器/回滚相同的非阻塞flock；并发运行即失败。

输出sourceAttribution=OWNER_REVIEWED_BOOTSTRAP_POLICY，不声称从不可变Git构建证明了旧手动版本源码。记录recordType=OWNER_IMPORTED_MANUAL、ciAccepted=false，保留原清单hash；不写deploy-成功记录，不把旧版本说成CI已部署。当前版本必须仍指向待导入目录。

两个输出都独占创建，不覆盖。manifest先写、manual提交标记后写；中断留下孤立manifest时，后续会拒绝覆盖。所有者核查中断点和备份后另行批准恢复，不自动删除、改名或重跑覆盖。

## 验收与回退

预演不改变current；导入后也须证明current及旧文件摘要未变。正式rollback_release.py默认预演时应显示recordType=OWNER_IMPORTED_MANUAL；在批准的实机演练中实际切回并核验可信HTTPS关键资源，再恢复指定新版本。保留全部release和记录；撤销新导入不等于回滚内容，不在本工具中提供删除接口。

实际生产导入/回滚仍须集中批准；本地单元测试及一次性Linux环境通过都不能替代生产验收。
