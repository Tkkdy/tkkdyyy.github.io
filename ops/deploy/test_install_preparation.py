import copy, datetime, io, json, tempfile, unittest, zipfile
from pathlib import Path
from unittest.mock import patch
import prepare_receiver_install as prep

class InstallationReviewTests(unittest.TestCase):
    def setUp(self):
        self.original = [{'path': 'index.html' if n == 0 else 'files/中文-' + str(n), 'bytes': n + 1, 'sha256': prep.digest(str(n).encode())} for n in range(115)]
        self.raw = json.dumps(self.original, ensure_ascii=False).encode()
        self.modules = {n: ('# reviewed ' + n).encode() for n in prep.MODULES}
        self.configs = {p: prep.digest(p.encode()) for p in ['/etc/nginx/nginx.conf', '/etc/nginx/sites-enabled/default', '/etc/nginx/sites-enabled/music.leux.me', '/etc/nginx/sites-enabled/preview.boenbot.top']}
        self.events = [{'kind': 'gateConfig', 'path': p, 'sha256': h} for p, h in self.configs.items() if not p.endswith('preview.boenbot.top')]
        self.events.append({'kind': 'deploymentCompleted', 'serverAcceptance': 'PASS', 'mainSha': prep.SOURCE, 'current': prep.CURRENT, 'nginxSha256': self.configs['/etc/nginx/sites-enabled/preview.boenbot.top']})
        self.report = {'scope': 'READ_ONLY_PRODUCTION_PREFLIGHT', 'state': 'PASS', 'mutations': False, 'uid': 1001, 'utc': '2026-10-26T03:14:55Z', 'current': {'path': prep.ROOT + '/current', 'symlink': True, 'target': prep.CURRENT}, 'finalCurrent': prep.CURRENT, 'releaseManifest': {'state': 'PASS', 'files': 115, 'manifest': copy.deepcopy(self.original), 'extraFiles': []}, 'nginxConfigHashes': [{'path': p, 'sha256': h} for p, h in self.configs.items()], 'services': {n: {'code': 0, 'stdout': 'active'} for n in ('nginx', 'ssh', 'certbot.timer')}, 'accounts': {'psyduck': {'uid': 1001}, 'www-data': {'uid': 33}, 'preview-deploy': {'status': 'ABSENT'}, 'editorial-admin': {'status': 'ABSENT'}}, 'paths': [], 'tools': {'getfacl': None, 'setfacl': None}, 'versions': {'python3': {'code': 0, 'stdout': 'Python 3.12.3'}}}
        self.report['paths'] = [{'path': p, 'uid': 1001, 'gid': 1001, 'mode': '0o755', 'symlink': False} for p in (prep.ROOT, prep.ROOT + '/releases', prep.ROOT + '/records', prep.ROOT + '/' + prep.CURRENT)]
        self.report['paths'] += [{'path': p, 'status': 'ABSENT'} for p in ('/usr/local/lib/preview-deploy', '/etc/preview-deploy', '/etc/preview-deploy/policy.json', '/var/lib/preview-deploy')]
        self.session = {'exitCode': 0, 'scope': 'READ_ONLY_RETRY'}
        self.now = datetime.datetime(2026, 10, 26, 4, tzinfo=datetime.timezone.utc)
        self.pin = patch.object(prep, 'MANIFEST_SHA', prep.digest(self.raw)); self.pin.start(); self.addCleanup(self.pin.stop)
    def plan(self): return prep.make_plan(self.report, self.session, self.raw, self.events, self.modules, 'a'*40, self.now)
    def test_real_windows_encodings_read_without_rewriting_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            for encoding in ('utf-8-sig', 'utf-16'):
                path = Path(folder)/encoding; raw = json.dumps({'中文': '正文'}, ensure_ascii=False).encode(encoding); path.write_bytes(raw)
                self.assertEqual(prep.load(path), {'中文': '正文'}); self.assertEqual(path.read_bytes(), raw)
    def test_damaged_console_path_labels_never_replace_original_manifest(self):
        self.report['releaseManifest']['manifest'][2]['path'] = 'files/????'
        plan = self.plan(); raw = prep.archive(plan, self.raw, self.modules)
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            self.assertEqual(z.read('original-manifest.json'), self.raw)
            self.assertEqual(len(z.namelist()), 10)
            for line in z.read('SHA256SUMS').decode().splitlines():
                sha, name = line.split('  ', 1); self.assertEqual(prep.digest(z.read(name)), sha)
            self.assertFalse(json.loads(z.read('policy.disabled.json'))['enabled'])
            self.assertNotIn('authorized_keys', z.namelist())
        self.assertEqual(raw, prep.archive(plan, self.raw, self.modules))
        self.assertFalse(plan['productionInstalled']); self.assertFalse(plan['authorizationReceived'])
    def test_preflight_failure_not_accepted_as_server_pass(self):
        self.session['exitCode'] = 255
        with self.assertRaisesRegex(ValueError, 'did not complete'): self.plan()
    def test_config_drift_missing_and_duplicate_each_refused(self):
        original = copy.deepcopy(self.report['nginxConfigHashes'])
        for items in [original[:-1], original + [original[0]], [{**original[0], 'sha256': '0'*64}] + original[1:]]:
            self.report['nginxConfigHashes'] = items
            with self.assertRaisesRegex(ValueError, 'Nginx config drift'): self.plan()
    def test_same_file_count_different_bytes_refused(self):
        self.report['releaseManifest']['manifest'][2]['sha256'] = '0'*64
        with self.assertRaisesRegex(ValueError, 'file identities differ'): self.plan()
    def test_changed_independent_manifest_refused(self):
        self.raw += b'\n'
        with self.assertRaisesRegex(ValueError, 'manifest hash differs'): self.plan()
    def test_extra_remote_file_refused(self):
        self.report['releaseManifest']['extraFiles'] = ['.env']
        with self.assertRaisesRegex(ValueError, 'inventory incomplete'): self.plan()
    def test_current_switch_during_inspection_refused(self):
        self.report['finalCurrent'] = 'releases/new'
        with self.assertRaisesRegex(ValueError, 'release identity changed'): self.plan()
    def test_preexisting_destination_or_account_is_never_overwritten(self):
        self.report['paths'][-1] = {'path': '/var/lib/preview-deploy', 'uid': 0}
        with self.assertRaisesRegex(ValueError, 'destination already exists'): self.plan()
        self.report['paths'][-1] = {'path': '/var/lib/preview-deploy', 'status': 'ABSENT'}
        self.report['accounts']['preview-deploy'] = {'uid': 1234}
        with self.assertRaisesRegex(ValueError, 'pre-existing account'): self.plan()
    def test_stale_and_future_snapshots_cannot_authorize_plan(self):
        for hours in (-2, 49):
            self.now = datetime.datetime(2026, 10, 26, 3, 14, 55, tzinfo=datetime.timezone.utc) + datetime.timedelta(hours=hours)
            with self.assertRaisesRegex(ValueError, 'stale or future'): self.plan()
    def test_modules_are_a_closed_whitelist(self):
        self.modules['private.env'] = b'not allowed'
        with self.assertRaisesRegex(ValueError, 'whitelist differs'): self.plan()
    def test_missing_acl_tools_require_separate_approval_not_false_no_acl(self):
        plan = self.plan()
        self.assertTrue(plan['prerequisites']['aclToolsMissing']); self.assertFalse(plan['prerequisites']['nodeRequiredForReceiver'])
        self.assertIn('deploy key', plan['notIncluded']); self.assertIn('release switch', plan['notIncluded'])
        self.assertTrue(all(not entry['defaultAcl'] for entry in plan['aclProposal']))
        self.assertTrue(any('unknown' in text for text in plan['evidenceLimits']))
if __name__ == '__main__': unittest.main()