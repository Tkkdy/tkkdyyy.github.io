---
name: "Attention Router"
slug: "attention-router"
tagline: "让任务、工作上下文和重要提醒，在桌面上有一个安静的出口。"
description: "本地优先的注意力路由器，通过 Windows Hub、Web Console 与指定 ESP32 电子纸，展示待办、当前事项及经过授权的提醒。"
status: published
projectStatus: developing
statusNote: "v0.1.0 源码版已发布；实验集成需单独配置，精确公开固件真机验收未完成。"
cover: "/projects/attention-router/hardware-overview.jpg"
coverAlt: "Attention Router ESP32、转接板与电子纸 Home 页面原型实拍；屏幕状态原样保留"
techStack: [Python, FastAPI, SQLite, ESP32]
githubUrl: "https://github.com/Tkkdy/attention-router"
featured: true
homepage:
  show: true
  order: 1
screenshots:
  - src: "/projects/attention-router/hardware-overview.jpg"
    alt: "ESP32 与电子纸 Home 页面真机实拍，保留原有屏幕状态，不代表精确公开固件已验收"
    caption: "原型真机实拍 / 屏幕状态原样保留 / 精确公开固件真机验收未完成。"
  - src: "/projects/attention-router/console-demo.png"
    alt: "真实 Web Console 的隔离合成数据演示；连接及设备状态保持原样"
    caption: "真实界面 / 合成示例数据 / 非设备实拍；Copyright © 2026 Tkkdy，MIT。"
---

Attention Router 把任务、当前工作状态和重要事件连接到桌面上的独立输出窗口。外部 Agent 负责理解与建议，本地 Hub 按明确授权、事件时间和工作上下文执行确定性路由。

## 已实现

- Home、Workspace、Interrupt 页面，以及 Todo、Current、Next 展示。
- NOW / QUEUE / DIGEST / DROP 四类注意力路由；Web Console 支持提醒 ACK，ACK 不等于完成 Todo。
- Windows 前台上下文与手动工作状态覆盖、本地 API、Scene 及缓存与 STALE 状态。
- TODAY 目前只是现有顺序中的前三条未完成 Todo，并非按到期日筛选；DIGEST 是路由分类，并非 AI 自动摘要。

## 实验集成

GrokBot / DeepSeekBot、MCP / OAuth、Codex 额度、Tibo Reset 及外部信息源需要用户自己的配置、权限和服务。它们并非默认启用的一键安装闭环，也没有全部通过真实客户端端到端验收。基础 Hub 本身不调用 LLM。

## 版本与限制

[v0.1.0](https://github.com/Tkkdy/attention-router/releases/tag/v0.1.0) 是正常源码 Release，未提供预编译固件。目标硬件为经典 ESP32（4 MB）与指定 GDEY042Z98 4.2 英寸三色电子纸及转接板；其他屏幕不能假定兼容。

公开验证记录保留历史稳定性定向测试 9/9、核心回归 86/88，以及两项旧 JSON 迁移失败。建议使用全新数据目录。精确公开固件的实屏、Wi-Fi、NVS / 断电恢复和长期可靠性验收尚未完成；离线中文标题可能降级为 ASCII 短编号。软件测试通过不代表实体设备验收通过。

设备约 30 秒轮询并受电子纸刷新时间限制，不能用作紧急告警器。Hub / Gateway 面向本地使用，不应直接暴露公网。

## 未来方向

通用 ChatGPT / Codex 完成通知、Agent Inbox、跨应用手机生活事件与智能预测仍属规划，未作为 v0.1.0 功能交付，也没有承诺日期。

## 来源与素材

内容依据公开 [README](https://github.com/Tkkdy/attention-router)、[Release Notes](https://github.com/Tkkdy/attention-router/blob/main/RELEASE_NOTES.md)、[功能矩阵](https://github.com/Tkkdy/attention-router/blob/main/docs/FEATURES.md) 和 [验证记录](https://github.com/Tkkdy/attention-router/blob/main/docs/VALIDATION.md)。当前说明按公开源码版与现有公开文档整理，后续 main 的集成记录不等于 v0.1.0 标签已重新验收。

截图原样取自公开仓库提交 `837a67d6730e9daf01eebaa5b10f1cab0780e747` 的 `assets/console-demo.png`。它是实际运行的 Console 与合成数据，非概念图、非真机实拍。[素材索引](https://github.com/Tkkdy/attention-router/blob/837a67d6730e9daf01eebaa5b10f1cab0780e747/assets/ASSET_INDEX.md) 明确此 UI 与截图为 Copyright © 2026 Tkkdy，MIT；[许可正文](/projects/attention-router/LICENSE.txt) 随素材保留。真机主图同样原样取自该提交的 `assets/hardware-overview.jpg`，经 Owner 本轮明确授权复制到本站静态目录。它证明原型及所拍页面存在，不证明精确公开固件已经通过真机验收；照片不推断为 MIT 许可。首页与项目列表使用真机主图，详情按真机、Console 顺序展示，两张均不裁切、不移除状态标记。
