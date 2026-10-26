import unittest
from source_authority import verify_main
class SourceAuthorityTests(unittest.TestCase):
 def test_manual_allowlist_receiver_entry(self):
  from receiver import authorize_source
  from pathlib import Path
  authorize_source({'sourceSha':'a'*40},{'approvedSourceShas':['a'*40]},Path('UNUSED'),'releases/old')
  with self.assertRaises(ValueError):authorize_source({'sourceSha':'b'*40},{'approvedSourceShas':['a'*40]},Path('UNUSED'),'releases/old')
 def test_current_main_descends_from_deployed(self):
  seen=[]
  def fetch(path):
   seen.append(path)
   return {'sha':'b'*40} if path.endswith('/main') else {'status':'ahead','merge_base_commit':{'sha':'a'*40}}
  self.assertEqual(verify_main('o/r','b'*40,'a'*40,fetch)['sourceSha'],'b'*40);self.assertEqual(len(seen),2)
 def test_superseded_job_rejected(self):
  with self.assertRaises(ValueError):verify_main('o/r','a'*40,'b'*40,lambda p:{'sha':'b'*40})
 def test_force_push_or_unrelated_history_rejected(self):
  for status in ['behind','diverged','identical']:
   with self.subTest(status=status),self.assertRaises(ValueError):verify_main('o/r','b'*40,'a'*40,lambda p:{'sha':'b'*40} if p.endswith('/main') else {'status':status,'merge_base_commit':{'sha':'c'*40}})
 def test_authority_failure_is_not_retried(self):
  calls=[]
  def fetch(path):calls.append(path);raise TimeoutError('network')
  with self.assertRaises(TimeoutError):verify_main('o/r','a'*40,'b'*40,fetch)
  self.assertEqual(len(calls),1)
if __name__=='__main__':unittest.main()
