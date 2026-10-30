import copy,importlib.util,pathlib,time,unittest
spec=importlib.util.spec_from_file_location('relay',pathlib.Path(__file__).with_name('relay.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class BindingTests(unittest.TestCase):
 def fixture(self,phase='guarded'):
  req={'phase':phase,'attemptId':'2026102900000007','requestId':'owner-0007-'+phase+'-'+'a'*24,'challengeSha256':'b'*64,'observerCodeCommit':'c'*40,'expiresEpoch':int(time.time())+600,'previousEvidence':None if phase=='guarded' else {'runId':12,'reportSha256':'d'*64}}
  run={'id':42,'head_sha':'e'*40,'head_branch':m.BRANCH,'event':'push','path':m.WORKFLOW,'run_attempt':1,'conclusion':'success','status':'completed','repository':{'full_name':m.REPO}}
  steps=['entries-and-neighbour-sites','full-original-content-both-domains','sitemap-rss-robots-original-identity','desktop:tkkdy.me','desktop:preview.boenbot.top','mobile:tkkdy.me','mobile:preview.boenbot.top','utility-noindex-and-certificate']
  if phase=='indexable':steps.insert(3,'existing-browser-gate-new-production')
  report={**req,'scope':'OWNER_GUARDED_PUBLIC_ACCEPTANCE' if phase=='guarded' else 'OWNER_INDEXABLE_PUBLIC_ACCEPTANCE','passed':True,'manifestSha256':m.CANDIDATE,'completeManifestFiles':116,'completeManifestDomains':2,'strictTls':True,'timeoutMs':30000,'retries':0,'transport':'DIRECT','runtime':{'node':'v24.19.0','openssl':'3.5.7','image':m.IMAGE,'browser':'156.0.8078.4','browserChannel':'chrome-for-testing','directFlagVerified':True,'runId':'42','runAttempt':'1','sourceSha':'e'*40},'steps':[{'name':s,'status':'PASS'} for s in steps],'newDomainNoindex':phase=='guarded','indexable':phase=='indexable','certificate':{'valid':True},'requests':[{'completed':True} for _ in range(241)]}
  report.update({k:True for k in ['canonical','searchAndClick','desktop','mobile','oldDomainNoindex','pagesIndependent','editorEntry','friends','fullManifest','searchAnd404Noindex']});return run,report,req
 def test_both_phase_bindings(self):
  for p in ['guarded','indexable']:
   r,d,q=self.fixture(p);self.assertTrue(m.validate(r,d,q,'e'*40,'f'*64)['passed'])
 def test_reject_wrong_run_and_rerun(self):
  for key,val in [('head_sha','0'*40),('run_attempt',2),('head_branch','main'),('event','workflow_dispatch'),('conclusion','failure')]:
   r,d,q=self.fixture();r[key]=val
   with self.subTest(key=key),self.assertRaises(RuntimeError):m.validate(r,d,q,'e'*40,'f'*64)
 def test_reject_report_drift(self):
  for key,val in [('challengeSha256','0'*64),('manifestSha256','0'*64),('completeManifestFiles',115),('completeManifestDomains',1),('strictTls',False),('timeoutMs',60000),('retries',1),('transport','PROXY'),('searchAndClick',False),('passed',False),('newDomainNoindex',False),('indexable',True)]:
   r,d,q=self.fixture();d[key]=val
   with self.subTest(key=key),self.assertRaises(RuntimeError):m.validate(r,d,q,'e'*40,'f'*64)
 def test_reject_missing_step_or_incomplete_body(self):
  for mode in ['step','body','runtime','expired','chain']:
   r,d,q=self.fixture('indexable')
   if mode=='step':d['steps'].pop()
   if mode=='body':d['requests'][0]['completed']=False
   if mode=='runtime':d['runtime']['browser']='other'
   if mode=='expired':q['expiresEpoch']=0
   if mode=='chain':d['previousEvidence']={'runId':13,'reportSha256':'0'*64}
   with self.subTest(mode=mode),self.assertRaises(RuntimeError):m.validate(r,d,q,'e'*40,'f'*64)
class RootBindingTests(BindingTests):
 def binding_fixture(self,phase='guarded'):
  spec=importlib.util.spec_from_file_location('binding',pathlib.Path(__file__).with_name('linux_binding.py'));b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
  r,d,q=self.fixture(phase);v=m.validate(r,d,q,'e'*40,'f'*64);v['token']='1'*48;d['challengeSha256']=m.sha(v['token'].encode());v['linuxEvidence']={'phase':phase,'challengeSha256':d['challengeSha256'],'observerCodeCommit':'c'*40,'workflowSha256':'2'*64,'runId':42,'runAttempt':1,'sourceSha':'e'*40,'artifactSha256':'3'*64,'reportSha256':'4'*64,'url':'https://github.com/Tkkdy/tkkdyyy.github.io/actions/runs/42','requestId':q['requestId'],'runtime':d['runtime'],'previousEvidence':q['previousEvidence']}
  a={'externalGateSha256':'f'*64,'candidateManifestSha256':m.CANDIDATE,'observerCodeCommit':'c'*40,'observerWorkflowSha256':'2'*64};p={'scope':v['scope'],'token':v['token']};return b,v,p,a
 def test_root_bound_guarded_and_final(self):
  for phase in ['guarded','indexable']:
   b,v,p,a=self.binding_fixture(phase);guard={'runId':12,'reportSha256':'d'*64} if phase=='indexable' else None;self.assertEqual(b.validate(v,p,a,guard)['runId'],42)
 def test_root_rejects_replay_or_wrong_chain(self):
  for mode in ['token','sha','run','runtime','chain','legacy']:
   b,v,p,a=self.binding_fixture('indexable');guard={'runId':12,'reportSha256':'d'*64}
   if mode=='token':p['token']='0'*48
   if mode=='sha':a['observerCodeCommit']='0'*40
   if mode=='run':v['linuxEvidence']['runAttempt']=2
   if mode=='runtime':v['linuxEvidence']['runtime']['directFlagVerified']=False
   if mode=='chain':guard['reportSha256']='0'*64
   if mode=='legacy':v.pop('linuxEvidence')
   with self.subTest(mode=mode),self.assertRaises(RuntimeError):b.validate(v,p,a,guard)
if __name__=='__main__':unittest.main()
