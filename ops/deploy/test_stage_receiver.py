"""Small synthetic candidate fixture; no production access, credentials, or site build."""
import copy
import io
import json
import os
import struct
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import stage_receiver as stage
from release_bundle import sha

SITE = 'https://preview.example.test'


def bundle():
    meta = {'site': SITE, 'releaseId': 'ci-' + 'a' * 12 + '-123-1', 'sourceSha': 'a' * 40,
            'workflowSha': 'b' * 40, 'lockfileSha256': 'c' * 64, 'vpsConfigSha256': 'd' * 64}
    data = {'index.html': ('<meta name="robots" content="noindex"><link rel="canonical" href="' + SITE + '/">').encode(),
            '404.html': b'<meta name="robots" content="noindex">',
            'pagefind/pagefind.js': b'fixture', 'pagefind/pagefind-entry.json': b'{}',
            'rss.xml': ('<rss><channel><link>' + SITE + '/</link></channel></rss>').encode(),
            'sitemap-index.xml': b'<sitemapindex/>',
            'sitemap-0.xml': ('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + SITE + '/</loc></url></urlset>').encode(),
            'robots.txt': ('Sitemap: ' + SITE + '/sitemap-index.xml').encode(),
            'deployment.json': json.dumps({'target': 'vps', 'sourceSha': meta['sourceSha'],
                                          'pipelineSha': meta['workflowSha'], 'lockfileSha256': meta['lockfileSha256'],
                                          'configSha256': meta['vpsConfigSha256']}).encode()}
    manifest = [{'path': n, 'bytes': len(b), 'sha256': sha(b)} for n, b in sorted(data.items())]
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w') as z:
        z.writestr('release.json', json.dumps(meta))
        z.writestr('manifest.json', json.dumps(manifest))
        for name, body in data.items():
            z.writestr('site/' + name, body)
    return out.getvalue(), meta, manifest


@unittest.skipUnless(os.name == "posix", "Linux O_NOFOLLOW and POSIX writes required; no weakened Windows fallback")
class StageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.root = self.base / 'stage'
        self.root.mkdir()
        for name in ['releases', 'records']:
            (self.root / name).mkdir()
        self.protected = self.base / 'observed-current'
        # Mock only the OS symlink read on Windows; disk and full HTTP reads are real.
        self.symlink = patch.object(stage, 'guard_current', self.guard).start()
        self.addCleanup(patch.stopall)
        self.drift = False
        self.raw, meta, self.manifest = bundle()
        self.config = {'protectedCurrent': str(self.protected), 'expectedProtectedCurrent': 'releases/frozen',
                       'archiveSha256': sha(self.raw), 'site': SITE, 'reviewedWorkflowSha': meta['workflowSha'],
                       'sourceSha': meta['sourceSha'], 'releaseId': meta['releaseId'], 'maxCandidates': 4}
        self.events = []
        self.ack = True

    def guard(self, config):
        if self.drift:
            raise ValueError('observed current drift')

    def output(self, **item):
        self.events.append(item)
        if item['phase'] == 'STAGE_FILES_READ':
            self.stream.write((json.dumps({'nonce': item['nonce'], 'accepted': self.ack}) + '\n').encode())
            self.stream.seek(self.payload_end)

    def run_stage(self, raw=None, config=None, output=None):
        raw = self.raw if raw is None else raw
        header = json.dumps({'archiveBytes': len(raw), 'archiveSha256': sha(raw)}).encode()
        payload = struct.pack('!I', len(header)) + header + raw
        self.payload_end = len(payload)
        self.stream = io.BytesIO(payload)
        return stage.stage(config or self.config, self.root, self.stream, output or self.output)

    def test_complete_candidate_all_files_and_bytes_no_public_activation(self):
        result = self.run_stage()
        self.assertEqual(result['files'], len(self.manifest))
        self.assertEqual(result['bytes'], sum(x['bytes'] for x in self.manifest))
        self.assertFalse(result['productionActivated'])
        self.assertEqual(len(list((self.root / 'records').glob('stage-*.json'))), 1)
        self.assertFalse((self.root / 'current').exists())
        self.assertEqual(self.events[-1]['phase'], 'STAGE_COMPLETE')

    def test_wrong_archive_rejected_before_candidate_creation(self):
        with self.assertRaisesRegex(ValueError, 'unapproved stage archive'):
            self.run_stage(self.raw + b'corrupt')
        self.assertEqual(list((self.root / 'releases').iterdir()), [])

    def test_wrong_source_and_build_run_rejected_before_write(self):
        for key, value in [('sourceSha', 'f' * 40), ('releaseId', 'ci-' + 'a' * 12 + '-456-1')]:
            config = {**self.config, key: value}
            with self.assertRaisesRegex(ValueError, 'source/run'):
                self.run_stage(config=config)
        self.assertEqual(list((self.root / 'releases').iterdir()), [])

    def test_disconnect_retains_candidate_without_accepted_record(self):
        with self.assertRaisesRegex(ValueError, 'missing/oversized'):
            self.run_stage(output=lambda **event: self.events.append(event))
        self.assertEqual(len(list((self.root / 'releases').iterdir())), 1)
        self.assertEqual(list((self.root / 'records').iterdir()), [])

    def test_negative_ack_no_accepted_record(self):
        self.ack = False
        with self.assertRaisesRegex(ValueError, 'acknowledgment refused'):
            self.run_stage()
        self.assertEqual(list((self.root / 'records').iterdir()), [])

    def test_drift_stops_before_any_write(self):
        self.drift = True
        with self.assertRaisesRegex(ValueError, 'current drift'):
            self.run_stage()
        self.assertEqual(list((self.root / 'releases').iterdir()), [])

    def test_drift_after_file_read_prevents_receipt(self):
        def changed(**event):
            self.output(**event)
            if event['phase'] == 'STAGE_FILES_READ':
                self.drift = True
        with self.assertRaisesRegex(ValueError, 'current drift'):
            self.run_stage(output=changed)
        self.assertEqual(list((self.root / 'records').iterdir()), [])

    def test_http_incomplete_read_retained_no_receipt(self):
        with patch.object(stage, 'read_all_http', side_effect=ValueError('candidate full HTTP read failed')):
            with self.assertRaisesRegex(ValueError, 'full HTTP read failed'):
                self.run_stage()
        self.assertEqual(len(list((self.root / 'releases').iterdir())), 1)
        self.assertEqual(list((self.root / 'records').iterdir()), [])

    def test_no_overwrite_and_bounded_storage(self):
        self.run_stage()
        self.run_stage()
        self.assertEqual(len(list((self.root / 'releases').iterdir())), 2)
        with self.assertRaisesRegex(ValueError, 'quota reached'):
            self.run_stage(config={**self.config, 'maxCandidates': 2})


if __name__ == '__main__':
    unittest.main()

@unittest.skipUnless(os.name == 'posix' and hasattr(os, 'getuid') and os.getuid() == 0,
                     'real root-owned policy and dropped UID fixture require Linux root CI')
class StagePolicyTests(unittest.TestCase):
    def setUp(self):
        import subprocess
        self.subprocess = subprocess
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.base.chmod(0o755)
        self.root = self.base / 'candidate'
        self.root.mkdir(mode=0o755)
        for name in ['releases', 'records']:
            folder = self.root / name
            folder.mkdir(mode=0o750)
            os.chown(folder, 65534, 65534)
        protected = self.base / 'production'
        protected.mkdir(mode=0o755)
        (protected / 'current').symlink_to('releases/frozen')
        self.config = {'enabled': True, 'uid': 65534, 'root': str(self.root),
                       'protectedCurrent': str(protected / 'current'),
                       'expectedProtectedCurrent': 'releases/frozen', 'maxCandidates': 4,
                       'sourceSha': 'a' * 40, 'reviewedWorkflowSha': 'b' * 40,
                       'archiveSha256': 'c' * 64, 'releaseId': 'ci-' + 'a' * 12 + '-123-1'}
        self.policy = self.base / 'policy.json'

    def check(self, expected=True):
        self.policy.write_text(json.dumps(self.config), encoding='utf-8')
        self.policy.chmod(0o644)
        script = ('import os,sys; os.setgroups([]); os.setgid(65534); os.setuid(65534); '
                  'sys.path.insert(0,sys.argv[1]); import stage_receiver; '
                  'stage_receiver.read_policy(sys.argv[2]); print("REAL_UID_POLICY_PASS")')
        result = self.subprocess.run([sys.executable, '-I', '-B', '-c', script,
                                      str(Path(stage.__file__).parent), str(self.policy)],
                                     capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode == 0, expected, result.stderr)
        return result

    def test_root_policy_real_unprivileged_uid_accepted(self):
        self.assertIn('REAL_UID_POLICY_PASS', self.check().stdout)

    def test_disabled_and_wrong_uid_refused(self):
        self.config['enabled'] = False
        self.check(False)
        self.config['enabled'] = True
        self.config['uid'] = 65533
        self.check(False)

    def test_overlap_refused(self):
        self.config['root'] = str(Path(self.config['protectedCurrent']).parent)
        self.check(False)

    def test_unexpected_current_refused(self):
        self.config['expectedProtectedCurrent'] = 'releases/unknown'
        self.check(False)

    def test_group_writable_stage_parent_refused(self):
        self.root.chmod(0o775)
        self.check(False)
