"""Root-owned Linux temporary fixtures; actual symlink/manifest operations, mocked HTTPS."""
import copy,json,os,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from release_bundle import sha
@unittest.skipUnless(sys.platform.startswith('linux') and getattr(os,'geteuid',lambda:-1)()==0,'isolated Linux root fixture required')
class DomainRollbackTests(unittest.TestCase):
 def setUp(self):
  from import_manual_release import import_manual
  from receiver import atomic_link
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name).resolve()
  (self.root/'records').mkdir();(self.root/'records/.ci.lock').touch()
  self.old='releases/preview-old';self.new='releases/public-new';self.source='a'*40
  self.files={}
  for target in [self.old,self.new]:
   folder=self.root/target;folder.mkdir(parents=True)
   data={'index.html':target.encode(),'404.html':b'404','a.css':b'css','a.js':b'js'};self.files[target]=data
   for n,b in data.items():(folder/n).write_bytes(b)
  (self.root/'current').symlink_to(self.old)
  self.old_config={'enabled':False,'root':str(self.root),'site':'https://preview.boenbot.top','bootstrapSourceSha':self.source}
  self.public_config={**self.old_config,'site':'https://tkkdy.me','indexingProfile':'production'}
  self.old_policy=self.root/'preview-policy.json';self.public_policy=self.root/'public-policy.json'
  self.old_policy.write_text(json.dumps(self.old_config));self.public_policy.write_text(json.dumps(self.public_config))
  manifest=[{'path':n,'bytes':len(b),'sha256':sha(b)} for n,b in self.files[self.old].items()]
  raw=json.dumps(manifest).encode();source=self.root/'approved-old-manifest.json';source.write_bytes(raw)
  self.original=json.dumps({'releaseId':'preview-old','mainSha':self.source,'current':self.old,'manifestSha256':sha(raw),'archiveSha256':'b'*64}).encode()
  self.original_path=self.root/'records/deploy-preview-old.json';self.original_path.write_bytes(self.original)
  with patch('import_manual_release.https_body',side_effect=lambda site,n:self.files[self.old][n]):
   import_manual(self.old_policy,self.old,self.source,source,sha(raw),True,sha(self.original))
  atomic_link(self.root,self.new,self.old)
 def rollback(self,policy=None,apply=False,corrupt=False):
  from rollback_release import rollback
  def body(site,name):
   target=os.readlink(self.root/'current')
   return b'corrupt' if corrupt and target==self.old else self.files[target][name]
  with patch('rollback_release.https_body',side_effect=body):return rollback(policy or self.old_policy,self.new,self.old,apply)
 def test_old_policy_snapshot_dry_run_preserves_current_and_original(self):
  r=self.rollback();self.assertFalse(r['applied']);self.assertEqual(os.readlink(self.root/'current'),self.new);self.assertEqual(self.original_path.read_bytes(),self.original)
 def test_public_policy_refuses_legacy_site_without_relaxing_identity(self):
  with self.assertRaisesRegex(ValueError,'identity differs'):self.rollback(self.public_policy,True)
  self.assertEqual(os.readlink(self.root/'current'),self.new)
 def test_correct_snapshot_applies_atomic_rollback_and_retains_both_releases(self):
  r=self.rollback(apply=True);self.assertTrue(r['applied']);self.assertEqual(os.readlink(self.root/'current'),self.old)
  self.assertTrue((self.root/self.new).is_dir());self.assertEqual(self.original_path.read_bytes(),self.original)
 def test_wrong_indexing_profile_rejected_even_with_matching_site(self):
  self.old_policy.write_text(json.dumps({**self.old_config,'indexingProfile':'production'}))
  with self.assertRaisesRegex(ValueError,'indexing profile'):self.rollback(apply=True)
  self.assertEqual(os.readlink(self.root/'current'),self.new)
 def test_failed_postcheck_restores_expected_public_release(self):
  with self.assertRaisesRegex(ValueError,'HTTPS verification'):self.rollback(apply=True,corrupt=True)
  self.assertEqual(os.readlink(self.root/'current'),self.new)
 def test_tampered_legacy_record_or_manifest_refuses_before_switch(self):
  self.original_path.write_bytes(b'{}')
  with self.assertRaisesRegex(ValueError,'hash differs'):self.rollback(apply=True)
  self.assertEqual(os.readlink(self.root/'current'),self.new)
 def test_unexpected_current_is_preserved(self):
  (self.root/'current').unlink();(self.root/'current').symlink_to('releases/unknown')
  with self.assertRaisesRegex(ValueError,'current drift'):self.rollback(apply=True)
  self.assertEqual(os.readlink(self.root/'current'),'releases/unknown')
if __name__=='__main__':unittest.main(verbosity=2)
