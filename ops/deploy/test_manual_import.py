import copy,json,tempfile,unittest
from pathlib import Path
from import_manual_release import verify_manifest
from release_records import read_record
from release_bundle import sha
class ManualBaselineTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name).resolve();self.data={'index.html':b'old','404.html':b'404','a.css':b'css','a.js':b'js'}
        for n,b in self.data.items():(self.root/n).write_bytes(b)
        self.manifest=[{'path':n,'bytes':len(b),'sha256':sha(b)} for n,b in self.data.items()]
    def tearDown(self):self.temp.cleanup()
    def verify(self,manifest=None,digest=None):
        raw=json.dumps(self.manifest if manifest is None else manifest).encode();return verify_manifest(self.root,raw,sha(raw) if digest is None else digest)
    def test_original_array_manifest_accepted_without_rebuilding(self):
        manifest,files=self.verify();self.assertEqual(files,self.data);self.assertEqual(manifest,self.manifest)
    def test_pinned_manifest_digest_required(self):
        with self.assertRaisesRegex(ValueError,'unapproved'):self.verify(digest='0'*64)
    def test_file_corruption_refused(self):
        (self.root/'index.html').write_bytes(b'different')
        with self.assertRaisesRegex(ValueError,'bytes differ'):self.verify()
    def test_unlisted_hidden_file_refused(self):
        (self.root/'.env').write_bytes(b'private')
        with self.assertRaisesRegex(ValueError,'unlisted'):self.verify()
    def test_missing_file_refused(self):
        (self.root/'a.css').unlink()
        with self.assertRaises(FileNotFoundError):self.verify()
    def test_duplicate_manifest_refused(self):
        with self.assertRaisesRegex(ValueError,'duplicate'):self.verify(self.manifest+[self.manifest[0]])
    def test_traversal_and_invalid_size_refused(self):
        for key,value in [('path','../outside'),('bytes',True),('bytes',8_000_001),('sha256','bad')]:
            items=copy.deepcopy(self.manifest);items[0][key]=value
            with self.assertRaises(ValueError):self.verify(items)
    def test_extra_manifest_metadata_refused(self):
        items=copy.deepcopy(self.manifest);items[0]['unreviewed']=True
        with self.assertRaisesRegex(ValueError,'manifest item'):self.verify(items)
    def test_manual_provenance_and_ambiguity(self):
        records=self.root/'records';records.mkdir();path=records/'manual-old.json';record={'recordType':'OWNER_IMPORTED_MANUAL','fullManifestVerified':True,'publicCriticalVerified':True,'ciAccepted':False};path.write_text(json.dumps(record))
        self.assertEqual(read_record(self.root,'old'),record)
        (records/'deploy-old.json').write_text('{}')
        with self.assertRaisesRegex(ValueError,'ambiguous'):read_record(self.root,'old')
    def test_manual_source_is_used_after_owner_rollback(self):
        from receiver import authorize_source
        from unittest.mock import patch
        records=self.root/'records';records.mkdir();(records/'manual-old.json').write_text(json.dumps({'recordType':'OWNER_IMPORTED_MANUAL','fullManifestVerified':True,'publicCriticalVerified':True,'ciAccepted':False,'sourceSha':'a'*40}))
        with patch('source_authority.verify_main') as verify:
            authorize_source({'sourceSha':'b'*40},{'sourceAuthority':'github-main','repository':'Tkkdy/tkkdyyy.github.io','bootstrapSourceSha':'c'*40},self.root,'releases/old')
            verify.assert_called_once_with('Tkkdy/tkkdyyy.github.io','b'*40,'a'*40)
    def test_manual_cannot_claim_ci_acceptance(self):
        records=self.root/'records';records.mkdir();(records/'manual-old.json').write_text(json.dumps({'recordType':'OWNER_IMPORTED_MANUAL','fullManifestVerified':True,'publicCriticalVerified':True,'ciAccepted':True}))
        with self.assertRaisesRegex(ValueError,'CI acceptance'):read_record(self.root,'old')
if __name__=='__main__':unittest.main()
