"""Runner-bound artifact checks using an accepted build; no SSH/network occurs."""
import json, os, shutil, tempfile, unittest, zipfile
from pathlib import Path
from unittest.mock import patch
import publish_client as client

class SSHBoundaryReached(Exception):
    pass

class ClientArtifactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bundle = Path(os.environ['VPS_BUNDLE_FILE']).resolve()
        with zipfile.ZipFile(cls.bundle) as archive:
            cls.metadata = json.loads(archive.read('release.json'))
        cls.source = cls.metadata['sourceSha']
        cls.workflow = cls.metadata['workflowSha']
        _, _, cls.run_id, cls.attempt = cls.metadata['releaseId'].split('-')

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.previous = Path.cwd()
        os.chdir(self.temp.name)
        self.addCleanup(os.chdir, self.previous)
        shutil.copyfile(self.bundle, 'bundle.zip')
        shutil.copyfile(str(self.bundle) + '.sha256', 'bundle.zip.sha256')
        self.environment = {
            'SITE_URL': self.metadata['site'],
            'SOURCE_SHA': self.source,
            'REVIEWED_WORKFLOW_SHA': self.workflow,
            'GITHUB_RUN_ID': self.run_id,
            'GITHUB_RUN_ATTEMPT': self.attempt,
            'VPS_SSH_HOST': 'ssh-boundary.invalid',
            'VPS_SSH_USER': 'preview-deploy',
            'VPS_KEY_FILE': 'unused-fixture-key',
            'VPS_KNOWN_HOSTS_FILE': 'unused-fixture-hosts',
        }

    def reject(self, changes, message):
        env = {**self.environment, **changes}
        env = {key: value for key, value in env.items() if value is not None}
        with patch.dict(os.environ, env, clear=True), patch.object(client.subprocess, 'Popen', side_effect=SSHBoundaryReached) as ssh:
            with self.assertRaisesRegex(ValueError, message):
                client.main()
            ssh.assert_not_called()

    def test_matching_accepted_bundle_reaches_ssh_boundary(self):
        with patch.dict(os.environ, self.environment, clear=True), patch.object(client.subprocess, 'Popen', side_effect=SSHBoundaryReached) as ssh:
            with self.assertRaises(SSHBoundaryReached):
                client.main()
            self.assertEqual(ssh.call_count, 1)

    def test_another_valid_source_rejected_before_ssh(self):
        other = 'a' * 40 if self.source != 'a' * 40 else 'b' * 40
        self.reject({'SOURCE_SHA': other}, 'source differs')

    def test_missing_source_rejected_before_ssh(self):
        self.reject({'SOURCE_SHA': None}, 'invalid runner source')

    def test_malformed_source_rejected_before_ssh(self):
        for value in [self.source[:12], self.source.upper(), ' ' + self.source]:
            with self.subTest(value=value):
                self.reject({'SOURCE_SHA': value}, 'invalid runner source')

    def test_another_run_rejected_before_ssh(self):
        self.reject({'GITHUB_RUN_ID': str(int(self.run_id) + 1)}, 'release differs from runner')

    def test_another_attempt_rejected_before_ssh(self):
        self.reject({'GITHUB_RUN_ATTEMPT': str(int(self.attempt) + 1)}, 'release differs from runner')

    def test_missing_or_malformed_run_rejected_before_ssh(self):
        for value in [None, '', '0', '01', '1;echo', '1' * 21]:
            with self.subTest(value=value):
                self.reject({'GITHUB_RUN_ID': value}, 'invalid runner run ID')

    def test_missing_or_malformed_attempt_rejected_before_ssh(self):
        for value in [None, '', '0', '01', '1000', '1\n']:
            with self.subTest(value=value):
                self.reject({'GITHUB_RUN_ATTEMPT': value}, 'invalid runner attempt')

    def test_reviewed_pipeline_still_required(self):
        self.reject({'REVIEWED_WORKFLOW_SHA': 'e' * 40}, 'unreviewed workflow')

    def test_archive_hash_still_required(self):
        Path('bundle.zip.sha256').write_text('0' * 64)
        self.reject({}, 'bundle size/hash')

if __name__ == '__main__':
    unittest.main(verbosity=2)
