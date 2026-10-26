# Minimal dual-target build and deployment preparation

This branch starts from the exact main SHA in minimal-scope.json. It copies only the listed M1 build/URL/SEO/Pagefind/admin-pruning files and inert M2 publishing/rollback tools from the reviewed c768a440 implementation. Admin UI, authentication, PR support, fonts/vendor, installers and ACL guardians are excluded. The existing main Editorial Studio is unchanged; its legacy browser PAT risk is not resolved by this branch. VPS output must prune that Admin entirely.

The formal .github/workflows/deploy.yml is unchanged. dual-publish.workflow.DRAFT.yml and policy.DRAFT.json are proposals, never active settings. New isolated CI validates extraction builds and parity only; prior c768a440 Linux transaction, RST/SIGHUP, disabled installation and SIGKILL owner-recovery evidence is reused, not rerun here.

Only parse5 8.0.1 (URL parser) and playwright 1.64.1 (existing browser acceptance tool) are added directly. Lockfile changes must be compared against main; do not wholesale copy the Admin branch lock.

No production key, ACL, account, Nginx, certificate, current/release or GitHub protection changes are authorized here. Observation summary confirmation and a new exact activation approval remain required. No installer should be rerun. Rollback is owner-operated using validated records and the shared lock, with dry-run default. All releases remain retained.

The initial main-derived lock reintroduced already-fixed Critical/High advisories. The final lock retains previously validated c768a440 build-tool resolutions and removes Admin-only graphql/dompurify/types nodes. Every final name/version pair exists in reviewed c768a440 or main; no new version upgrade. Retained transitive updates are part of the explicit review scope, not hidden inside the parser addition. Audit remains http-cache-semantics High and fast-uri Moderate; no audit fix was run.

Windows checkout CRLF and Linux artifact LF initially caused the local pack identity gate to reject the package-lock hash, correctly. Audited lock/config/runtime files now use explicit LF attributes; no artifact metadata was rewritten to bypass the check. CI additionally packages and reload-validates the VPS ZIP before exporting the inert review artifact.

Runner artifact identity: publish_client.py requires SOURCE_SHA (exact event SHA), GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT, supplied by the inert workflow job/GitHub runner. After existing ZIP, manifest and reviewed-pipeline validation, it rejects a different source or release run/attempt before starting SSH. Missing/noncanonical identities fail closed. This is an additional client integration check, not artifact attestation or a substitute for receiver verify_main, reviewed workflow/Environment protection, or production approval. Do not invent runner IDs to reuse an unrelated archive.

Targeted offline check: set VPS_BUNDLE_FILE to a retained accepted bundle.zip with its adjacent .sha256, then run python -B -m unittest discover -s ops/deploy -p test_publish_client.py -v. Tests load the actual bundle and replace the SSH process boundary; they do not connect or prove real Actions execution. Reuse existing Linux receiver evidence; this client-only patch does not change receiver modules, ACL, policy or formal workflow.
