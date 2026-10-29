"""Real build outputs; negative artifact/policy cases, no SSH or production writes."""
import copy,io,json,os,unittest,zipfile
from pathlib import Path
from release_bundle import validate_site,load_bundle,sha
from indexing_profile import indexing_profile
PREVIEW='https://preview.boenbot.top'
PUBLIC='https://tkkdy.me'
def read(path):return {p.relative_to(path).as_posix():p.read_bytes() for p in path.rglob('*') if p.is_file()}
class IndexingProfileTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.preview=read(Path(os.environ['VPS_PREVIEW_DIR']))
  cls.public=read(Path(os.environ['VPS_PRODUCTION_DIR']))
 def test_both_real_builds_pass_their_own_profile(self):
  validate_site(self.preview,PREVIEW)
  validate_site(self.public,PUBLIC,'production')
 def test_no_profile_defaults_to_preview_and_invalid_values_fail(self):
  self.assertEqual(indexing_profile(),'preview')
  for value in [None,'','false','prod',True]:
   with self.assertRaises(ValueError):indexing_profile(value)
 def test_same_origin_does_not_override_profile_authority(self):
  for data,site,wrong in [(self.public,PUBLIC,'preview'),(self.preview,PREVIEW,'production')]:
   with self.assertRaises(ValueError):validate_site(data,site,wrong)
 def test_public_home_noindex_or_none_is_rejected(self):
  for robots in [b'noindex',b'none',b'index, NOINDEX']:
   data=copy.deepcopy(self.public);data['index.html']=data['index.html'].replace(b'</head>',b'<meta name="robots" content="'+robots+b'"></head>')
   with self.assertRaises(ValueError):validate_site(data,PUBLIC,'production')
 def test_search_and_404_must_stay_noindex(self):
  for path in ['search/index.html','404.html']:
   data=copy.deepcopy(self.public);data[path]=data[path].replace(b'noindex',b'index')
   with self.assertRaises(ValueError):validate_site(data,PUBLIC,'production')
 def test_canonical_and_og_must_use_same_expected_origin(self):
  data=copy.deepcopy(self.public);data['index.html']=data['index.html'].replace(b'https://tkkdy.me/',b'https://wrong.example/')
  with self.assertRaises(ValueError):validate_site(data,PUBLIC,'production')
 def test_missing_or_forged_profile_marker_is_rejected(self):
  for marker in [None,b'{"schema":1,"site":"https://tkkdy.me","indexingProfile":"preview"}']:
   data=copy.deepcopy(self.public)
   if marker is None:del data['vps-build.json']
   else:data['vps-build.json']=marker
   with self.assertRaises(ValueError):validate_site(data,PUBLIC,'production')
 def test_sitemap_search_or_wrong_index_and_wrong_rss_fail(self):
  for path,old,new in [('sitemap-index.xml',b'https://tkkdy.me/',b'https://wrong.example/'),('sitemap-0.xml',b'https://tkkdy.me/',b'https://tkkdy.me/search/'),('rss.xml',b'https://tkkdy.me/',b'https://wrong.example/')]:
   data=copy.deepcopy(self.public);data[path]=data[path].replace(old,new)
   with self.assertRaises(ValueError):validate_site(data,PUBLIC,'production')
 def test_guid_stability_without_duplicate_guid_elements(self):
  import xml.etree.ElementTree as ET
  baseline=json.loads((Path(__file__).resolve().parents[2]/'src/data/vps-rss-guids.json').read_text())
  from urllib.parse import urlsplit
  for item in ET.fromstring(self.public['rss.xml']).findall('./channel/item'):
   self.assertEqual(len(item.findall('guid')),1)
   link=item.findtext('link');self.assertTrue(link.startswith(PUBLIC+'/'))
   self.assertEqual(item.findtext('guid'),baseline.get(urlsplit(link).path,link))
 def bundle(self,data,profile):
  data=copy.deepcopy(data)
  meta={'releaseId':'ci-'+'a'*12+'-100-1','site':PUBLIC,'indexingProfile':profile,'sourceSha':'a'*40,'workflowSha':'b'*40,'lockfileSha256':'c'*64,'vpsConfigSha256':'d'*64}
  data['deployment.json']=json.dumps({'target':'vps','indexingProfile':profile,'sourceSha':'a'*40,'pipelineSha':'b'*40,'lockfileSha256':'c'*64,'configSha256':'d'*64}).encode()
  buf=io.BytesIO()
  with zipfile.ZipFile(buf,'w') as z:
   z.writestr('release.json',json.dumps(meta));z.writestr('manifest.json',json.dumps([{'path':n,'bytes':len(v),'sha256':sha(v)} for n,v in data.items()]))
   for n,v in data.items():z.writestr('site/'+n,v)
  return buf.getvalue()
 def test_artifact_cannot_self_authorize_production(self):
  raw=self.bundle(self.public,'production')
  with self.assertRaisesRegex(ValueError,'profile differs'):load_bundle(raw,sha(raw),PUBLIC,'b'*40)
  load_bundle(raw,sha(raw),PUBLIC,'b'*40,'production')
 def test_public_identity_profile_cannot_disagree_with_release_profile(self):
  raw=self.bundle(self.public,'production')
  source=io.BytesIO(raw);out=io.BytesIO()
  with zipfile.ZipFile(source) as z:
   data={n:z.read(n) for n in z.namelist()}
  identity=json.loads(data['site/deployment.json']);identity['indexingProfile']='preview';data['site/deployment.json']=json.dumps(identity).encode()
  manifest=json.loads(data['manifest.json'])
  for item in manifest:
   if item['path']=='deployment.json':item.update(bytes=len(data['site/deployment.json']),sha256=sha(data['site/deployment.json']))
  data['manifest.json']=json.dumps(manifest).encode()
  with zipfile.ZipFile(out,'w') as z:
   for n,v in data.items():z.writestr(n,v)
  changed=out.getvalue()
  with self.assertRaisesRegex(ValueError,'public indexing identity'):load_bundle(changed,sha(changed),PUBLIC,'b'*40,'production')
 def test_wrong_client_profile_stops_before_any_ssh_process(self):
  import tempfile
  from unittest.mock import patch
  import publish_client as client
  raw=self.bundle(self.public,'production')
  previous=Path.cwd()
  with tempfile.TemporaryDirectory() as folder:
   try:
    os.chdir(folder);Path('bundle.zip').write_bytes(raw);Path('bundle.zip.sha256').write_text(sha(raw))
    with patch.dict(os.environ,{'SITE_URL':PUBLIC,'REVIEWED_WORKFLOW_SHA':'b'*40,'VPS_INDEXING_PROFILE':'preview'},clear=True),patch.object(client.subprocess,'Popen') as ssh:
     with self.assertRaisesRegex(ValueError,'profile differs'):client.main()
     ssh.assert_not_called()
   finally:os.chdir(previous)
 def test_relabeling_public_artifact_as_preview_does_not_bypass_html_checks(self):
  raw=self.bundle(self.public,'preview')
  with self.assertRaises(ValueError):load_bundle(raw,sha(raw),PUBLIC,'b'*40)
if __name__=='__main__':unittest.main(verbosity=2)
