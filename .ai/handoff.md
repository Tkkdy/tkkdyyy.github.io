# tkkdy.me production indexing migration

State: IN_PROGRESS. Role: EXECUTOR. Next: EXECUTOR until isolated checks and PR are complete, then human approval before any activation.

Contract: user authorized independent branch, Pages/preview/production builds, rollback validation and PR; no merge, production policy/Variables/Nginx/current changes or deployment of unconfirmed content.

Branch: codex/tkkdy-production-seo. Base: f006dc383b9f01b0a76d62e075ea7584fe0c0729. Original worktree/user artifacts preserved; no agents delegated.

Reality: current VPS source record88ac30aa plus manual828dc000; legacy record lacks site/sourceSha and currently needs explicit owner bridge before modern rollback. New/old VPS domains share current. Repo main includes four unapproved-for-VPS published essays, one modified article and one excluded draft. Evidence and full runbook: [migration](../ops/deploy/tkkdy-production-migration.md).

Local results so far: npm ci; Astro check0 errors/warnings;164 Node tests; three builds;45 public route/body parity;17 existing bundle tests;13 new profile tests; all three candidate Chromium search/SEO checks PASS. Linux root filesystem rollback validation pending isolated CI; no live rollback claimed.

Next: finish static review, commit/push only this branch, create PR with auto-merge disabled, await actual isolated CI and update evidence. Human owns later merge/production/content decisions.
