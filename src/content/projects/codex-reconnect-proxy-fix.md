---
name: "Codex Reconnect Proxy Fix"
slug: "codex-reconnect-proxy-fix"
tagline: "一个强调权限边界、预览和回滚的诊断提示词与文档工具包。"
description: "用于诊断本地代理配置导致的 Codex Desktop 重连问题，流程坚持只读检查、范围预览、明确授权、有限写入与失败回滚。"
status: published
projectStatus: usable
statusNote: "USABLE v0.1 / UNOFFICIAL"
highlights:
  - "先只读检查，再给出范围明确、可回滚的修改提案。"
  - "只有获得用户授权才执行变更；重启并在新对话中验证后，修复才算成立。"
techStack:
  - Prompt
  - Documentation
---

Codex Reconnect Proxy Fix 是一个非官方、版本相关的提示词与文档工具包。它处理的是本地代理配置造成的重连问题，但不会在未授权时修改配置。

一次完整流程包括只读诊断、展示精确提案、等待授权、执行有限变更、重启验证，以及验证失败时回滚。
