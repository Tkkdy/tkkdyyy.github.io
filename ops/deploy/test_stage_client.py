import copy
import unittest
from stage_client import validate_receipt
from release_bundle import sha
import json

class ReceiptTests(unittest.TestCase):
    def setUp(self):
        self.metadata = {'releaseId': 'ci-' + 'a'*12 + '-123-1', 'sourceSha': 'a'*40, 'workflowSha': 'b'*40}
        self.expected = {'archiveSha256': 'c'*64, 'expectedProtectedCurrent': 'releases/frozen'}
        self.manifest = [{'path': 'index.html', 'bytes': 3, 'sha256': sha(b'old')}]
        self.receipt = {'phase': 'STAGE_FILES_READ', **self.metadata, 'archiveSha256': 'c'*64,
                        'manifestSha256': sha(json.dumps(self.manifest, sort_keys=True).encode()),
                        'files': 1, 'bytes': 3, 'protectedCurrent': 'releases/frozen',
                        'productionActivated': False, 'networkPath': 'VPS loopback HTTP; candidate only',
                        'nonce': 'd'*32, 'candidate': self.metadata['releaseId'] + '-' + 'd'*32}

    def test_exact_receipt(self):
        self.assertEqual(validate_receipt(self.receipt, self.expected, self.metadata, self.manifest), 'd'*32)

    def test_identity_bytes_hash_activation_and_current_must_all_match(self):
        for key in self.receipt:
            receipt = copy.deepcopy(self.receipt)
            receipt[key] = 'unexpected'
            with self.subTest(field=key), self.assertRaises(ValueError):
                validate_receipt(receipt, self.expected, self.metadata, self.manifest)
