"""Offline, no-secret receiver installation review bundle. Never connects or installs."""
import argparse, collections, datetime, hashlib, io, json, re, subprocess, zipfile
from pathlib import Path

MODULES = ('receiver.py', 'release_bundle.py', 'source_authority.py', 'rollback_release.py', 'release_records.py', 'import_manual_release.py')
ROOT = '/srv/www/preview.boenbot.top'
CURRENT = 'releases/preview-main-88ac30aa-f4f1c891-20261024T035620Z'
MANIFEST_SHA = 'bdbd0dff0af30ac2b7c3631f22b3228ef501a0f5dcfe6203ed4055c3a5ebd6a0'
SOURCE = '88ac30aa31d4c806e6af9a71b955db2f0dd16967'

def digest(raw): return hashlib.sha256(raw).hexdigest()
def require(value, message):
    if not value: raise ValueError(message)
def load(path):
    raw = Path(path).read_bytes()
    return json.loads(raw.decode('utf-16' if raw[:2] in (b'\xff\xfe', b'\xfe\xff') else 'utf-8-sig'))

def baseline_hashes(events):
    result = {}
    completed = None
    for item in events:
        if item.get('kind') == 'gateConfig': result[item['path']] = item['sha256']
        if item.get('kind') == 'deploymentCompleted': completed = item
    require(completed and completed.get('serverAcceptance') == 'PASS', 'missing prior A acceptance')
    require(completed['mainSha'] == SOURCE and completed['current'] == CURRENT, 'prior A identity differs')
    result['/etc/nginx/sites-enabled/preview.boenbot.top'] = completed['nginxSha256']
    require(set(result) == {'/etc/nginx/nginx.conf', '/etc/nginx/sites-enabled/default', '/etc/nginx/sites-enabled/music.leux.me', '/etc/nginx/sites-enabled/preview.boenbot.top'}, 'incomplete baseline config pins')
    return result

def make_plan(report, session, original_raw, events, modules, source_sha, now=None):
    require(re.fullmatch('[0-9a-f]{40}', source_sha) is not None, 'invalid preparation source SHA')
    require(session.get('exitCode') == 0 and session.get('scope') == 'READ_ONLY_RETRY', 'SSH preflight did not complete')
    require(report.get('scope') == 'READ_ONLY_PRODUCTION_PREFLIGHT' and report.get('state') == 'PASS' and report.get('mutations') is False, 'preflight not a read-only PASS')
    require(report.get('uid') == 1001, 'server login identity differs')
    observed = datetime.datetime.fromisoformat(report['utc'].replace('Z', '+00:00'))
    now = now or datetime.datetime.now(datetime.timezone.utc)
    require(datetime.timedelta(0) <= now - observed <= datetime.timedelta(hours=48), 'preflight stale or future')
    require(report['current']['path'] == ROOT + '/current' and report['current']['symlink'] is True and report['current']['target'] == report['finalCurrent'] == CURRENT, 'release identity changed')
    require(digest(original_raw) == MANIFEST_SHA, 'original independent manifest hash differs')
    original = json.loads(original_raw.decode('utf-8-sig'))
    require(len(original) == 115 and len({i['path'] for i in original}) == len(original), 'original manifest identity differs')
    remote = report['releaseManifest']
    require(remote['state'] == 'PASS' and remote['files'] == len(original) and remote['extraFiles'] == [], 'remote inventory incomplete')
    # Windows stdout decoding damaged some path labels. Do not use those labels.
    # The server's verifier checked paths BEFORE JSON emission. Match all size/hash
    # pairs here, while shipping only the independently pinned original manifest.
    pairs = lambda items: collections.Counter((i['bytes'], i['sha256']) for i in items)
    require(pairs(remote['manifest']) == pairs(original), 'remote file identities differ')
    expected_configs = baseline_hashes(events)
    actual_configs = {i['path']: i.get('sha256') for i in report['nginxConfigHashes']}
    require(len(actual_configs) == len(report['nginxConfigHashes']) and actual_configs == expected_configs, 'Nginx config drift')
    for name in ('nginx', 'ssh', 'certbot.timer'):
        require(report['services'][name].get('code') == 0 and report['services'][name].get('stdout') == 'active', 'inactive protected service: ' + name)
    require(report['accounts']['psyduck']['uid'] == 1001 and report['accounts']['www-data']['uid'] == 33, 'account identity drift')
    for name in ('preview-deploy', 'editorial-admin'):
        require(report['accounts'][name] == {'status': 'ABSENT'}, 'unexpected pre-existing account: ' + name)
    paths = {p['path']: p for p in report['paths']}
    for path in (ROOT, ROOT + '/releases', ROOT + '/records', ROOT + '/' + CURRENT):
        p = paths[path]
        require(p.get('uid') == 1001 and p.get('gid') == 1001 and p.get('mode') == '0o755' and p.get('symlink') is False, 'site directory drift: ' + path)
    for path in ('/usr/local/lib/preview-deploy', '/etc/preview-deploy', '/etc/preview-deploy/policy.json', '/var/lib/preview-deploy'):
        require(paths[path].get('status') == 'ABSENT', 'destination already exists: ' + path)
    require(set(modules) == set(MODULES), 'module whitelist differs')
    require(all(isinstance(b, bytes) and b for b in modules.values()), 'empty/invalid module')
    stamp = observed.strftime('%Y%m%dT%H%M%SZ')
    policy = {'enabled': False, 'root': ROOT, 'site': 'https://preview.boenbot.top', 'reviewedWorkflowSha': 'NOT_CONFIGURED', 'approvedSourceShas': [], 'sourceAuthority': 'github-main', 'repository': 'Tkkdy/tkkdyyy.github.io', 'bootstrapSourceSha': SOURCE}
    plan = {
        'schema': 1, 'stage': 'DISABLED_RECEIVER_INSTALL_REVIEW_ONLY',
        'preparationSourceSha': source_sha, 'observedUtc': report['utc'],
        'server': {'sshHost': '203.55.176.11', 'sshLogin': 'psyduck', 'uid': 1001},
        'expectedCurrent': CURRENT, 'root': ROOT, 'expectedNginxConfigHashes': expected_configs,
        'originalManifestSha256': MANIFEST_SHA, 'originalFileCount': len(original),
        'backupDirectory': '/var/backups/dual-site-receiver-' + stamp,
        'moduleDestination': '/usr/local/lib/preview-deploy',
        'moduleHashes': {n: digest(modules[n]) for n in MODULES},
        'policyDestination': '/etc/preview-deploy/policy.json', 'policy': policy,
        'newAccount': {'name': 'preview-deploy', 'system': True, 'home': '/var/lib/preview-deploy', 'shell': '/bin/sh', 'password': 'LOCKED', 'sudo': False},
        'rootOwnedAuthorization': {'directory': '/var/lib/preview-deploy/.ssh', 'directoryMode': '0755', 'file': '/var/lib/preview-deploy/.ssh/authorized_keys', 'fileMode': '0644', 'initialContents': '', 'keyInstalled': False},
        'aclProposal': [{'path': p, 'entry': 'u:preview-deploy:rwx', 'defaultAcl': False} for p in (ROOT, ROOT + '/releases', ROOT + '/records')],
        'lockFile': {'path': ROOT + '/records/.ci.lock', 'mode': '0600', 'owner': 'preview-deploy'},
        'prerequisites': {'aclToolsMissing': report['tools'].get('getfacl') is None or report['tools'].get('setfacl') is None, 'python': report['versions']['python3'], 'nodeRequiredForReceiver': False},
        'requiredApproval': ['install acl package if absent without upgrading other packages', 'create disabled dedicated account and root-owned code/policy/empty authorization', 'backup exact directory ACLs then grant only listed ACL entries', 'create deploy-owned lock file; preserve all releases'],
        'notIncluded': ['deploy key', 'enable receiver', 'manual release import apply', 'release switch', 'GitHub production workflow or environments', 'Admin runtime or account', 'Nginx or TLS or DNS changes'],
        'postInstallGates': ['policy.enabled remains false', 'empty authorization file', 'UID cannot write modules/policy/authorization or unrelated services', 'current and full original manifest unchanged', 'all Nginx hashes unchanged', 'owner backup includes exact original ACL masks', 'effective sshd policy for dedicated account reviewed before any key is installed'],
        'rollback': {'order': ['keep policy disabled and authorization empty', 'restore only approved directory ACLs from exclusive backup using setfacl --restore', 'retain account locked and root-owned installed files for inspection', 'retain lock, all releases and all records; no content switch or automatic deletion'], 'contentRollbackNeeded': False},
        'productionInstalled': False, 'authorizationReceived': False,
        'evidenceLimits': ['preflight describes one sampled moment; recheck all live pins before any apply', 'getfacl absent means existing extended ACLs unknown; installing ACL tooling does not prove no ACLs existed', 'certificate file unreadable as nonroot; this is not TLS failure', 'remote decoded path labels are not reused as a manifest', 'root-level installer and real production permissions are not validated by this offline bundle'],
    }
    return plan

def archive(plan, original_raw, modules):
    members = {'plan.json': json.dumps(plan, ensure_ascii=True, sort_keys=True, indent=2).encode(), 'original-manifest.json': original_raw, 'policy.disabled.json': json.dumps(plan['policy'], sort_keys=True, indent=2).encode()}
    members.update({'modules/' + n: modules[n] for n in MODULES})
    members['SHA256SUMS'] = ''.join(digest(body) + '  ' + n + '\n' for n, body in sorted(members.items())).encode('ascii')
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        for n, body in sorted(members.items()):
            info = zipfile.ZipInfo(n, (2026, 1, 1, 0, 0, 0)); info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16; z.writestr(info, body)
    return out.getvalue()

def main():
    p = argparse.ArgumentParser(description=__doc__)
    for n in ('report', 'session', 'original-manifest', 'prior-a-events', 'source-sha', 'output'): p.add_argument('--' + n, required=True)
    a = p.parse_args(); code = Path(__file__).resolve().parent; repo = code.parent.parent
    git = lambda *args: subprocess.check_output(['git', *args], cwd=repo, text=True).strip()
    require(git('rev-parse', 'HEAD') == a.source_sha, 'preparation checkout SHA differs')
    require(not git('status', '--porcelain'), 'dirty preparation checkout')
    events = [json.loads(line) for line in Path(a.prior_a_events).read_text(encoding='utf-8-sig').splitlines() if line.strip()]
    modules = {}
    for n in MODULES:
        path = code/n; require(path.is_file() and not path.is_symlink(), 'unsafe module source'); modules[n] = path.read_bytes()
    original = Path(a.original_manifest).read_bytes()
    plan = make_plan(load(a.report), load(a.session), original, events, modules, a.source_sha)
    raw = archive(plan, original, modules)
    # Exclusive output: reruns cannot replace prior review evidence.
    with Path(a.output).open('xb') as f: f.write(raw)
    print(json.dumps({'stage': plan['stage'], 'output': str(Path(a.output).resolve()), 'sha256': digest(raw), 'files': 10, 'productionInstalled': False, 'authorizationReceived': False}))
if __name__ == '__main__': main()