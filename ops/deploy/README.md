# Minimal dual-target build and deployment preparation

This branch starts from the exact main SHA in minimal-scope.json. It copies only the listed M1 build/URL/SEO/Pagefind/admin-pruning files and inert M2 publishing/rollback tools from the reviewed c768a440 implementation. Admin UI, authentication, PR support, fonts/vendor, installers and ACL guardians are excluded. The existing main Editorial Studio is unchanged; its legacy browser PAT risk is not resolved by this branch. VPS output must prune that Admin entirely.

The formal .github/workflows/deploy.yml is unchanged. dual-publish.workflow.DRAFT.yml and policy.DRAFT.json are proposals, never active settings. New isolated CI validates extraction builds and parity only; prior c768a440 Linux transaction, RST/SIGHUP, disabled installation and SIGKILL owner-recovery evidence is reused, not rerun here.

Only parse5 8.0.1 (URL parser) and playwright 1.64.1 (existing browser acceptance tool) are added directly. Lockfile changes must be compared against main; do not wholesale copy the Admin branch lock.

No production key, ACL, account, Nginx, certificate, current/release or GitHub protection changes are authorized here. Observation summary confirmation and a new exact activation approval remain required. No installer should be rerun. Rollback is owner-operated using validated records and the shared lock, with dry-run default. All releases remain retained.

The initial main-derived lock reintroduced already-fixed Critical/High advisories. The final lock retains previously validated c768a440 build-tool resolutions and removes Admin-only graphql/dompurify/types nodes. Every final name/version pair exists in reviewed c768a440 or main; no new version upgrade. Retained transitive updates are part of the explicit review scope, not hidden inside the parser addition. Audit remains http-cache-semantics High and fast-uri Moderate; no audit fix was run.
