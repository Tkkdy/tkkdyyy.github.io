"""Actual root-owned Linux temporary transactions; HTTPS/public observer mocked."""
import json,os,sys,tempfile,time,unittest,shutil
from pathlib import Path
from unittest.mock import patch
from release_bundle import sha

@unittest.skipUnless(sys.platform.startswith('linux') and getattr(os,'geteuid',lambda:-1)()==0,'root Linux fixture required')
class OwnerStaticTests(unittest.TestCase):
 def setUp(self):
  import owner_static_release as owner
  from import_manual_release import import_manual
  from prepare_live_domain_candidate import prepare
  self.owner=owner;self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.base=Path(self.tmp.name).resolve();self.root=self.base/'live';self.old='releases/preview-baseline';self.source='a'*40
  (self.root/'records').mkdir(parents=True);(self.root/'records/.ci.lock').touch();folder=self.root/self.old;folder.mkdir(parents=True)
  site=owner.OLD
  self.data={}
  for n,path in [('index.html',''),('about/index.html','about/'),('search/index.html','search/'),('404.html',None)]:
   seo='' if path is None else '<link rel="canonical" href="'+site+'/'+path+'"><meta property="og:url" content="'+site+'/'+path+'">'
   self.data[n]=('<html><head>'+seo+'<meta name="robots" content="noindex"></head><body><h1>Frozen content</h1><link rel="stylesheet" href="/a.css"><script src="/a.js"></script></body></html>').encode()
  self.data.update({'a.css':b'body{}','a.js':b'void 0','pagefind/pagefind.js':b'void 0','pagefind/pagefind-entry.json':b'{}','robots.txt':('Sitemap: '+site+'/sitemap-index.xml').encode(),'sitemap-index.xml':('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>'+site+'/sitemap-0.xml</loc></sitemap></sitemapindex>').encode(),'sitemap-0.xml':('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+site+'/</loc></url><url><loc>'+site+'/about/</loc></url></urlset>').encode(),'rss.xml':('<rss><channel><link>'+site+'/</link><item><title>Frozen</title><link>'+site+'/about/</link><guid>'+site+'/about/</guid><description>Original</description><pubDate>Original date</pubDate></item></channel></rss>').encode()})
  for n,b in self.data.items():p=folder/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
  (self.root/'current').symlink_to(self.old)
  self.policy=self.base/'policy.json';config={'root':str(self.root),'enabled':False,'site':site,'sourceAuthority':'github-main','bootstrapSourceSha':self.source};self.policy.write_text(json.dumps(config))
  raw=json.dumps([{'path':n,'bytes':len(b),'sha256':sha(b)} for n,b in sorted(self.data.items())],sort_keys=True).encode();self.manifest=self.base/'baseline-manifest.json';self.manifest.write_bytes(raw)
  original={'releaseId':Path(self.old).name,'current':self.old,'mainSha':self.source,'manifestSha256':sha(raw),'archiveSha256':'b'*64};record=self.root/'records'/('deploy-'+Path(self.old).name+'.json');record.write_text(json.dumps(original))
  with patch('import_manual_release.https_body',side_effect=lambda site,n:self.data[n]):import_manual(self.policy,self.old,self.source,self.manifest,sha(raw),True,sha(record.read_bytes()))
  self.candidate=self.base/'candidate';prepare(folder,self.manifest,sha(raw),self.candidate)
  self.nginx=self.base/'nginx';self.nginx.mkdir();(self.nginx/'site.conf').write_text('noindex retained')
  self.installed=self.base/'installed';self.installed.mkdir();(self.installed/'old.py').write_text('# unchanged')
  self.tools=self.base/'tools';self.tools.mkdir()
  # Root-owned tool bytes are checked even though the test imports trusted checkout modules.
  for name in ['owner_static_release.py','prepare_live_domain_candidate.py','release_bundle.py','release_records.py','receiver.py','import_manual_release.py','indexing_profile.py','rollback_release.py']:
   shutil.copyfile(Path(owner.__file__).parent/name,self.tools/name)
  for name,value in [('NGINX_ROOT',self.nginx),('INSTALLED_ROOT',self.installed),('__file__',str(self.tools/'owner_static_release.py'))]:
   patcher=patch.object(owner,name,value);patcher.start();self.addCleanup(patcher.stop)
  digest=sha((self.candidate/'manifest.json').read_bytes());self.target='releases/owner-tkkdy-'+digest[:12]+'-'+'1'*16;self.approval=self.base/'owner.json'
  self.a={'attemptId':'1'*16,'externalGateSha256':'c'*64,'schema':1,'scope':'ONE_OWNER_LIVE_DERIVED_PROMOTION','enabled':True,'expiresEpoch':int(time.time())+3600,'root':str(self.root),'site':owner.NEW,'indexingProfile':'production','expectedCurrent':self.old,'target':self.target,'baselineSourceSha':self.source,'baselineOriginalManifestSha256':sha(raw),'baselineBridgeSha256':sha((self.root/'records'/('legacy-'+Path(self.old).name+'.json')).read_bytes()),'candidateManifestSha256':digest,'derivationSha256':sha((self.candidate/'derivation.json').read_bytes()),'policySha256':sha(self.policy.read_bytes()),'protectedFilesSha256':{str(self.policy):sha(self.policy.read_bytes())},'toolFilesSha256':{p.name:sha(p.read_bytes()) for p in self.tools.glob('*.py')},'nginxTreeSha256':owner.tree_digest(self.nginx),'installedToolsTreeSha256':owner.tree_digest(self.installed)}
  self.save()
 def save(self):self.approval.write_text(json.dumps(self.a))
 def verdict(self,proposal):return {**proposal,'gateSha256':'c'*64,'passed':True,**{k:True for k in ['strictTls','canonical','searchAndClick','desktop','mobile','oldDomainNoindex','newDomainNoindex','pagesIndependent','editorEntry','friends']}}
 def run_owner(self,apply=False,reader=None):
  def body(site,n):return (self.root/os.readlink(self.root/'current')/n).read_bytes()
  with patch.object(self.owner,'https_body',side_effect=body):return self.owner.promote(self.approval,sha(self.approval.read_bytes()),self.policy,self.candidate,self.manifest,apply,reader or self.verdict)
 def unchanged(self):self.assertEqual(os.readlink(self.root/'current'),self.old)
 def test_default_dry_run_has_no_release_or_claim(self):
  result=self.run_owner();self.assertFalse(result['applied']);self.unchanged();self.assertFalse((self.root/self.target).exists());self.assertEqual(len(list((self.root/'records').iterdir())),4)
 def test_root_required(self):
  with patch.object(os,'geteuid',return_value=1000),self.assertRaisesRegex(ValueError,'root owner'):self.run_owner()
 def test_disabled_approval_rejected(self):
  self.a['enabled']=False;self.save()
  with self.assertRaisesRegex(ValueError,'explicit owner approval'):self.run_owner(True)
  self.unchanged()
 def test_expired_approval_rejected(self):
  self.a['expiresEpoch']=int(time.time())-1;self.save()
  with self.assertRaisesRegex(ValueError,'expired'):self.run_owner(True)
 def test_approval_digest_and_ownership_enforced(self):
  with self.assertRaisesRegex(ValueError,'digest'):self.owner.promote(self.approval,'0'*64,self.policy,self.candidate,self.manifest)
  self.approval.chmod(0o666)
  with self.assertRaisesRegex(ValueError,'root-owned'):self.run_owner()
 def test_current_drift_refused(self):
  (self.root/'current').unlink();(self.root/'current').symlink_to('releases/unknown')
  with self.assertRaisesRegex(ValueError,'current drift'):self.run_owner(True)
 def test_policy_change_refused(self):
  self.policy.write_text('{}')
  with self.assertRaisesRegex(ValueError,'policy drift'):self.run_owner(True)
 def test_nginx_change_refused(self):
  (self.nginx/'site.conf').write_text('changed')
  with self.assertRaisesRegex(ValueError,'Nginx tree drift'):self.run_owner(True)
 def test_installed_tool_change_refused(self):
  (self.installed/'old.py').write_text('changed')
  with self.assertRaisesRegex(ValueError,'installed tools drift'):self.run_owner(True)
 def test_unreviewed_runtime_tool_refused(self):
  (self.tools/'receiver.py').write_text('changed')
  with self.assertRaisesRegex(ValueError,'unreviewed tool'):self.run_owner(True)
 def test_baseline_body_change_refused(self):
  (self.root/self.old/'index.html').write_text('changed')
  with self.assertRaisesRegex(ValueError,'bytes differ'):self.run_owner(True)
 def test_candidate_body_change_refused(self):
  (self.candidate/'site/index.html').write_text('changed')
  with self.assertRaisesRegex(ValueError,'bytes differ'):self.run_owner(True)
 def test_self_attested_candidate_cannot_add_main_content(self):
  p=self.candidate/'site/index.html';p.write_bytes(p.read_bytes().replace(b'Frozen content',b'UNAPPROVED MAIN'))
  manifest=json.loads((self.candidate/'manifest.json').read_bytes())
  for item in manifest:
   if item['path']=='index.html':item.update(bytes=p.stat().st_size,sha256=sha(p.read_bytes()))
  raw=json.dumps(manifest,sort_keys=True).encode();(self.candidate/'manifest.json').write_bytes(raw);self.a['candidateManifestSha256']=sha(raw);self.a['target']='releases/owner-tkkdy-'+sha(raw)[:12]+'-'+'1'*16;self.save()
  with self.assertRaisesRegex(ValueError,'candidate differs'):self.run_owner(True)
  self.unchanged()
 def test_guarded_success_has_honest_identity_and_is_rollback_compatible(self):
  from release_records import read_record
  from rollback_release import rollback
  result=self.run_owner(True);self.assertTrue(result['applied']);self.assertFalse(result['indexingActivated']);self.assertEqual(os.readlink(self.root/'current'),self.target)
  record=read_record(self.root,Path(self.target).name);self.assertEqual(record['recordType'],'OWNER_DERIVED_STATIC');self.assertFalse(record['ciAccepted']);self.assertEqual(record['sourceSha'],self.source)
  self.assertFalse((self.root/self.target/'deployment.json').exists())
  r=rollback(self.policy,self.target,self.old,False);self.assertFalse(r['applied'])
 def test_failed_public_gate_restores_and_consumes_attempt(self):
  with self.assertRaisesRegex(ValueError,'public verdict'):self.run_owner(True,lambda p:{**self.verdict(p),'passed':False})
  self.unchanged()
  with self.assertRaisesRegex(ValueError,'already exists'):self.run_owner(True)
 def test_missing_mobile_gate_restores(self):
  with self.assertRaisesRegex(ValueError,'missing mobile'):self.run_owner(True,lambda p:{**self.verdict(p),'mobile':False})
  self.unchanged()
 def test_wrong_verdict_token_restores(self):
  with self.assertRaisesRegex(ValueError,'public verdict'):self.run_owner(True,lambda p:{**self.verdict(p),'token':'wrong'})
  self.unchanged()
 def test_failed_https_postcheck_restores(self):
  def body(site,n):
   return b'corrupt' if os.readlink(self.root/'current')==self.target else self.data[n]
  with patch.object(self.owner,'https_body',side_effect=body),self.assertRaisesRegex(ValueError,'strict HTTPS'):
   self.owner.promote(self.approval,sha(self.approval.read_bytes()),self.policy,self.candidate,self.manifest,True,self.verdict)
  self.unchanged()
 def test_tampered_historical_owner_approval_rejected(self):
  from release_records import read_record
  self.run_owner(True);(self.root/'records'/('owner-approval-'+Path(self.target).name+'.json')).write_text('{}')
  with self.assertRaisesRegex(ValueError,'approval invalid'):read_record(self.root,Path(self.target).name)
class OwnerDraftTests(unittest.TestCase):
 def test_disabled_draft_matches_reviewed_modules_and_observer(self):
  folder=Path(__file__).resolve().parent;a=json.loads((folder/'tkkdy-owner-once.DRAFT.json').read_text())
  self.assertIs(a['enabled'],False);self.assertEqual(a['expiresEpoch'],0)
  for name,digest in a['toolFilesSha256'].items():self.assertEqual(sha((folder/name).read_bytes().replace(b'\r\n',b'\n')),digest,name)
  self.assertEqual(sha((folder/'owner_public_gate.mjs').read_bytes().replace(b'\r\n',b'\n')),a['externalGateSha256'])
if __name__=='__main__':unittest.main(verbosity=2)
