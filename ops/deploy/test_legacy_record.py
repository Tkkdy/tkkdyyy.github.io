"""Linux root fixture only: no production paths, SSH, HTTP or real TLS."""
import copy,json,os,stat,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from import_manual_release import import_manual
from release_records import read_record
from release_bundle import sha
from receiver import authorize_source

@unittest.skipUnless(sys.platform.startswith('linux') and getattr(os,'geteuid',lambda:-1)()==0,'requires isolated Linux root fixture')
class LegacyRecordTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name).resolve();self.rid='preview-old';self.target='releases/'+self.rid;self.source='a'*40
        (self.root/'releases'/self.rid).mkdir(parents=True);(self.root/'records').mkdir();(self.root/'records/.ci.lock').touch()
        self.data={'index.html':b'old','404.html':b'404','a.css':b'css','a.js':b'js'}
        for n,b in self.data.items():(self.root/self.target/n).write_bytes(b)
        self.manifest=[{'path':n,'bytes':len(b),'sha256':sha(b)} for n,b in self.data.items()]
        self.raw=json.dumps(self.manifest,indent=2).encode();self.input=self.root/'input.json';self.input.write_bytes(self.raw)
        self.legacy={'releaseId':self.rid,'mainSha':self.source,'current':self.target,'manifestSha256':sha(self.raw),'archiveSha256':'b'*64,'serverAcceptance':'PASS'}
        self.original=json.dumps(self.legacy,indent=2).encode();self.path=self.root/'records'/('deploy-'+self.rid+'.json');self.path.write_bytes(self.original);self.path.chmod(0o644)
        self.proof=self.root/'records'/('legacy-'+self.rid+'.json');self.saved=self.root/'records'/('manifest-'+self.rid+'.json')
        self.policy=self.root/'policy.json';self.config={'root':str(self.root),'site':'https://example.test','bootstrapSourceSha':self.source,'enabled':False};self.policy.write_text(json.dumps(self.config));self.policy.chmod(0o644)
        (self.root/'current').symlink_to(self.target)
        self.network=patch('import_manual_release.https_body',side_effect=lambda site,name:self.data[name]);self.network.start();self.addCleanup(self.network.stop)
    def tearDown(self):self.temp.cleanup()
    def run_import(self,apply=False,digest=None):
        return import_manual(self.policy,self.target,self.source,self.input,sha(self.raw),apply,sha(self.original) if digest is None else digest)
    def test_default_dry_run_preserves_record_and_creates_no_proof(self):
        result=self.run_import();self.assertFalse(result['applied']);self.assertFalse(self.proof.exists());self.assertFalse(self.saved.exists());self.assertEqual(self.path.read_bytes(),self.original)
    def test_import_and_reader_keep_manual_provenance(self):
        self.run_import(True);record=read_record(self.root,self.rid)
        self.assertEqual(record['sourceSha'],self.source);self.assertFalse(record['ciAccepted']);self.assertEqual(record['recordType'],'OWNER_VERIFIED_LEGACY');self.assertEqual(self.path.read_bytes(),self.original)
    def test_replay_refuses_without_overwriting(self):
        self.run_import(True);before=self.proof.read_bytes()
        with self.assertRaisesRegex(ValueError,'overwritten'):self.run_import(True)
        self.assertEqual(before,self.proof.read_bytes());self.assertEqual(self.path.read_bytes(),self.original)
    def test_bad_pin_refuses(self):
        with self.assertRaisesRegex(ValueError,'hash differs'):self.run_import(True,'0'*64)
        self.assertFalse(self.saved.exists())
    def test_no_opt_in_still_refuses_existing_deploy(self):
        with self.assertRaisesRegex(ValueError,'overwritten'):import_manual(self.policy,self.target,self.source,self.input,sha(self.raw),True)
    def test_enabled_receiver_refuses_migration(self):
        self.config['enabled']=True;self.policy.write_text(json.dumps(self.config))
        with self.assertRaisesRegex(ValueError,'disabled'):self.run_import(True)
    def test_corrupt_release_refuses_before_writes(self):
        (self.root/self.target/'index.html').write_bytes(b'corrupt')
        with self.assertRaises(ValueError):self.run_import(True)
        self.assertFalse(self.saved.exists());self.assertFalse(self.proof.exists())
    def test_failed_public_check_refuses(self):
        with patch('import_manual_release.https_body',return_value=b'wrong'):
            with self.assertRaisesRegex(ValueError,'HTTPS bytes differ'):self.run_import(True)
        self.assertFalse(self.saved.exists())
    def test_current_drift_refuses(self):
        (self.root/'current').unlink();(self.root/'current').symlink_to('releases/other')
        with self.assertRaisesRegex(ValueError,'not current'):self.run_import(True)
    def test_deploy_legacy_field_mismatch_refuses_even_with_new_pin(self):
        for field,value in [('mainSha','c'*40),('current','releases/other'),('releaseId','other'),('manifestSha256','c'*64),('sourceSha','a'*40)]:
            record=copy.deepcopy(self.legacy);record[field]=value;self.path.write_text(json.dumps(record));digest=sha(self.path.read_bytes())
            with self.subTest(field=field):
                with self.assertRaises(ValueError):self.run_import(True,digest)
        self.assertFalse(self.saved.exists())
    def test_nonroot_owned_and_writable_proof_refused(self):
        self.run_import(True);os.chown(self.proof,65534,65534)
        with self.assertRaisesRegex(ValueError,'root-owned'):read_record(self.root,self.rid)
        os.chown(self.proof,0,0);self.proof.chmod(0o666)
        with self.assertRaisesRegex(ValueError,'root-owned'):read_record(self.root,self.rid)
    def test_original_record_tamper_refused(self):
        self.run_import(True);self.path.write_text('{}')
        with self.assertRaisesRegex(ValueError,'hash differs'):read_record(self.root,self.rid)
    def test_saved_manifest_tamper_refused(self):
        self.run_import(True);self.saved.write_text('[]')
        with self.assertRaisesRegex(ValueError,'saved manifest differs'):read_record(self.root,self.rid)
    def test_proof_cannot_claim_ci_success(self):
        self.run_import(True);v=json.loads(self.proof.read_text());v['ciAccepted']=True;self.proof.write_text(json.dumps(v))
        with self.assertRaisesRegex(ValueError,'provenance'):read_record(self.root,self.rid)
    def test_symlink_proof_refused(self):
        self.run_import(True);other=self.root/'elsewhere';self.proof.rename(other);self.proof.symlink_to(other)
        with self.assertRaises(OSError):read_record(self.root,self.rid)
    def test_manual_record_alongside_legacy_refused(self):
        self.run_import(True);(self.root/'records'/('manual-'+self.rid+'.json')).write_text('{}')
        with self.assertRaisesRegex(ValueError,'ambiguous'):read_record(self.root,self.rid)
    def test_partial_manifest_without_proof_does_not_authorize(self):
        self.saved.write_bytes(self.raw)
        with patch('source_authority.verify_main') as verify:
            with self.assertRaises(KeyError):authorize_source({'sourceSha':'b'*40},{'sourceAuthority':'github-main','repository':'Tkkdy/tkkdyyy.github.io','bootstrapSourceSha':self.source},self.root,self.target)
            verify.assert_not_called()
    def test_owner_rollback_and_subsequent_source_check(self):
        self.run_import(True);new=self.root/'releases/new';new.mkdir()
        (new/'index.html').write_bytes(b'new');(self.root/'current').unlink();(self.root/'current').symlink_to('releases/new')
        from rollback_release import rollback
        with patch('rollback_release.https_body',side_effect=lambda site,name:self.data[name]):
            result=rollback(self.policy,'releases/new',self.target,True)
        self.assertTrue(result['applied']);self.assertEqual(os.readlink(self.root/'current'),self.target);self.assertEqual(self.path.read_bytes(),self.original)
        with patch('source_authority.verify_main') as verify:
            authorize_source({'sourceSha':'d'*40},{'sourceAuthority':'github-main','repository':'Tkkdy/tkkdyyy.github.io'},self.root,self.target)
            verify.assert_called_once_with('Tkkdy/tkkdyyy.github.io','d'*40,self.source)

if __name__=='__main__':unittest.main()
