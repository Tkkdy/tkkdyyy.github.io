# 第一批内容与首页修复

State: READY_FOR_REVIEW. Local acceptance: PASS. Branch: codex/content-home-first-batch. Fresh main baseline: 033eda7d83b8bcf408d8d4a0b48a6e912f8f783f.
Task contract: Owner original request + supplement 01 (Wonderland, hardware primary + Console secondary). Stop at Draft PR; no main, merge, Ready transition or production operations.
Review and file inventory: docs/content-home-review/README.md. Machine results/screenshots: docs/content-home-review/acceptance.json and SCREENSHOTS.md.
Local: check 183 pass / 2 existing skips; build/build:vps and 33 browser screenshots PASS; count/viewport matrix 9/9; Pages and VPS search PASS; private editor draft retention PASS.
Featured: Wonderland final choice. Third screen: agency review preview; final selection outstanding. Photography: no published works; waiting for Owner files, not an engineering failure.
Material fixes: real images + byte equality/provenance, public Pages admin draft exclusion, 320px long-SHA wrap, old website screenshot placeholder replacement. No deployment-system changes.
Draft PR: to be recorded after creation. Next actor: Owner visual reviewer. Do not merge or deploy automatically.

---

## Historical handoff (preserved; not current task authorization)

# 双站生产同步审查候选

State: READY_FOR_REVIEW; production NO_GO. Draft PR #29 on codex/dual-site-production-sync, base main 4dd98aee17264fefd4399afd550264696afd2902. Review: docs/DUAL_SITE_SYNC_REVIEW.md; exact proposed production and content inventories: docs/dual-site-change-plan.json and docs/dual-site-initial-content.json. Latest exact-head CI artifacts freeze actual source/tool/module/policy SHA; require raw test logs, not just green outer status. Prior fully inspected run 41175825554 passed 13 profile +18 real nonroot transition +7 rollback tests and actual local browser gates. This head adds fail-closed build combinations, draft exclusion, root seal denial cases; latest matching CI must pass.

No production changes, merge or content publication authorized this turn. Current remains owner-tkkdy-d3b094b33d24-2026102900000007. No 0007 replay/0008, editor/private data/SSH/Nginx changes. Minimal ACL + durable completion + formal policy/Variables need later exact approval. Initial content includes previously deferred re and Development fixtures: not automatically approved. Deployment secrets/environment/forced SSH and current contentAutoMergeEnabled are UNVERIFIED. Continuous publishing remains false and requires a separate decision after first controlled release.

Local evidence: C:/Users/PsyDuck/Desktop/tkkdy-dual-site-sync-20261031/. Stop at this review boundary; do not deploy merely because CI passes.
