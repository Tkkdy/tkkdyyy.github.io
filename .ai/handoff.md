# tkkdy.me production indexing migration

State: READY_FOR_REVIEW. Role: EXECUTOR. Next: HUMAN_PRODUCT_OWNER for review and separate activation/content approval. No merge authorized.

Contract: user authorized independent branch, Pages/preview/production builds, rollback validation and PR; no merge, production policy/Variables/Nginx/current changes or deployment of unconfirmed content.

Branch: codex/tkkdy-production-seo. Base: f006dc383b9f01b0a76d62e075ea7584fe0c0729. Original worktree/user artifacts preserved; no agents delegated.

Reality: current VPS source record88ac30aa plus manual828dc000; legacy record lacks site/sourceSha and currently needs explicit owner bridge before modern rollback. New/old VPS domains share current. Repo main includes four unapproved-for-VPS published essays, one modified article and one excluded draft. Evidence and full runbook: [migration](../ops/deploy/tkkdy-production-migration.md).

Local results so far: npm ci; Astro check0 errors/warnings;164 Node tests; three builds;45 public route/body parity;17 existing bundle tests;13 new profile tests; all three candidate Chromium search/SEO checks PASS. Linux root filesystem rollback7 and legacy bridge18 tests PASS in isolated CI40866696829; no live rollback claimed.

PR: https://github.com/Tkkdy/tkkdyyy.github.io/pull/22 (draft; no auto-merge). Code commit f564f11399a99d366c2879c70f74c7266b8ef683 tested; final changes are documentation only. CI40866696829 passed all four jobs. Final head checks are visible on PR. No production changes or content-file diff. Human owns later merge/production/content decisions; actual legacy baseline bridge/dry-run must still precede activation.
