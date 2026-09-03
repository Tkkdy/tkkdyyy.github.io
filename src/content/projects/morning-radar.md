---
name: "Morning Radar"
slug: "morning-radar"
tagline: "让每日信号成为可以追溯、阅读和继续判断的晨报。"
description: "Morning Radar 自动采集 AI 科技、重点公司市场数据、GitHub 项目动态和开发者社区信号，去重合并后生成可追溯的中文晨报、静态网站与微信摘要。"
status: published
projectStatus: developing
statusNote: "DEVELOPING"
highlights:
  - "先聚合来源，再去重与评分，减少重复信号对判断的干扰。"
  - "把筛选结果整理为中文 brief，并保留来源轨迹供后续核对。"
  - "通过 GitHub Actions 持续生成静态输出，让晨报成为可重复的日常流程。"
techStack:
  - Python
  - LLM
  - GitHub Actions
githubUrl: "https://github.com/Tkkdy/Morning-Radar"
updatedAt: 2026-08-17
featured: true
homepage:
  show: true
  order: 1
screenshots:
  - src: "/projects/morning-radar-2026-08-15.png"
    alt: "Morning Radar 2026 年 8 月 15 日真实晨报首屏"
    caption: "真实输出 / 2026-08-15"
---

Morning Radar 面向每天需要处理大量技术与产品信息的个人工作流。它把来源收集、去重、评分、摘要和静态发布连接成一条可以重复运行的流程。

当前主页展示的是 2026 年 8 月 15 日生成的真实晨报输出。每条信息仍可回到来源轨迹继续核对，而不是只留下无法解释的摘要结论。

## 当前范围

- 收集并整理多个信息来源。
- 去重与评分后生成中文 brief。
- 通过 GitHub Actions 运行自动化流程并发布静态结果。
