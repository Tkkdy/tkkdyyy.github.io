# ACL guardian candidate — isolated validation only

This supplements the installation orchestration whose SSH connection reset while awaiting the public callback. It does not replace the already accepted deployment receiver, rerun its installer, or authorize another VPS change.

`acl_guard.py` currently exposes only a disposable GitHub Linux fixture CLI. Both root and the explicit CI gates are required. Its only mutations are to three fixture directories under `/var/lib/acl-guard-ci-*`; it has no production invocation or unrestricted command argument.

The launcher detaches the guardian into a new session, with no inherited terminal or stdout dependency. Before any ACL grant, the guardian exclusively locks the fixture, snapshots the exact numeric ACLs into root-only files, fsyncs an ARMED journal and starts a bounded monotonic deadline. A negative, malformed, symlinked or missing verdict restores the exact ACLs. Only an exact nonce plus boolean success before the deadline may commit. The guard handles HUP/TERM/INT during the lease and ignores repeated termination signals during bounded restoration. Existing unknown ACLs and overlapping transactions fail before mutation. All evidence and old files remain.

Integration runs real Linux root, accounts, ACL tools, flock, process sessions and SIGHUP. It does **not** simulate a real SSH transport reset or prove Ubuntu VPS session-cgroup behavior. Power loss, guardian SIGKILL, kernel failure and removal of the guardian require independent owner recovery; no startup service/reboot recovery is included. These limits must be resolved or explicitly accepted before a production proposal. The fixture-only CLI must not be loosened merely to install it.

Run only on disposable Linux CI:

```sh
sudo env GITHUB_ACTIONS=true ACL_GUARD_FIXTURE=true GITHUB_SHA="$GITHUB_SHA" python3 -I -B ops/deploy/integration_acl_guard_linux.py
```

The dedicated branch workflow has read-only repository permissions, no secrets, no Pages deployment and no VPS target. It preserves `integration-evidence/acl-guard.json`, reports production writes false and distinguishes real process-session testing from real SSH testing. Existing pinned ZIP, installer, protected production release, main and production workflow remain unchanged.
