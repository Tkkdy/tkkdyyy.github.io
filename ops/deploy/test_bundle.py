import os,copy,io,json,stat,unittest,zipfile
from pathlib import Path
from release_bundle import *
R=Path(__file__).resolve().parent
SITE='https://preview.boenbot.top'
class BundleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data={}
        fixture=Path(os.environ['VPS_BUILD_DIR']).resolve()
        cls.data={p.relative_to(fixture).as_posix():p.read_bytes() for p in fixture.rglob('*') if p.is_file()}
        cls.meta={'releaseId':'ci-'+'a'*12+'-100-1','site':SITE,'sourceSha':'a'*40,'workflowSha':'b'*40,'lockfileSha256':'c'*64,'vpsConfigSha256':'d'*64}
        cls.data['deployment.json']=json.dumps({'target':'vps','sourceSha':'a'*40,'pipelineSha':'b'*40,'lockfileSha256':'c'*64,'configSha256':'d'*64}).encode()
    def bundle(self,data=None,meta=None,modify_manifest=None,extra=None):
        data=copy.deepcopy(self.data if data is None else data)
        manifest=[{'path':n,'bytes':len(b),'sha256':sha(b)} for n,b in sorted(data.items())]
        if modify_manifest:modify_manifest(manifest)
        out=io.BytesIO()
        with zipfile.ZipFile(out,'w') as z:
            z.writestr('release.json',json.dumps(self.meta if meta is None else meta));z.writestr('manifest.json',json.dumps(manifest))
            for n,b in data.items():z.writestr('site/'+n,b)
            if extra:extra(z)
        return out.getvalue()
    def check(self,raw,**kw):return load_bundle(raw,sha(raw),SITE,**kw)
    def test_real_accepted_artifact(self):
        raw=self.bundle();m,manifest,data=self.check(raw,workflow='b'*40)
        self.assertEqual(len(data),len(self.data));self.assertEqual(len(manifest),len(self.data))
    def test_public_identity_must_match_archive_provenance(self):
        d=copy.deepcopy(self.data);identity=json.loads(d['deployment.json']);identity['sourceSha']='e'*40;d['deployment.json']=json.dumps(identity).encode()
        with self.assertRaises(ValueError):self.check(self.bundle(data=d))
    def test_wrong_archive_hash(self):
        with self.assertRaises(ValueError):load_bundle(self.bundle(),'0'*64,SITE)
    def test_wrong_file_hash(self):
        raw=self.bundle(modify_manifest=lambda m:m[0].update(sha256='0'*64))
        with self.assertRaises(ValueError):self.check(raw)
    def test_wrong_byte_count(self):
        raw=self.bundle(modify_manifest=lambda m:m[0].update(bytes=0))
        with self.assertRaises(ValueError):self.check(raw)
    def test_manifest_duplicate(self):
        raw=self.bundle(modify_manifest=lambda m:m.append(m[0]))
        with self.assertRaises(ValueError):self.check(raw)
    def test_traversal_absolute_backslash_control(self):
        for n in ['../x','/etc/passwd','site/../x','site\\x','site//x','site/\nx','site/.env']:
            with self.subTest(n=n),self.assertRaises(ValueError):safe_name(n)
    def test_extra_zip_path(self):
        with self.assertRaises(ValueError):self.check(self.bundle(extra=lambda z:z.writestr('../outside',b'x')))
    def test_symlink(self):
        def linked(z):
            info=zipfile.ZipInfo('site/alias.txt');info.create_system=3;info.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(info,b'/etc/passwd')
        with self.assertRaises(ValueError):self.check(self.bundle(extra=linked))
    def test_admin(self):
        d={**self.data,'admin/index.html':b'editor'}
        with self.assertRaises(ValueError):self.check(self.bundle(data=d))
    def test_private_key(self):
        d={**self.data,'leak.txt':b'-----BEGIN PRIVATE KEY-----'}
        with self.assertRaises(ValueError):self.check(self.bundle(data=d))
    def test_noindex(self):
        d=copy.deepcopy(self.data);d['index.html']=d['index.html'].replace(b'noindex',b'index')
        with self.assertRaises(ValueError):self.check(self.bundle(data=d))
    def test_wrong_origin(self):
        d=copy.deepcopy(self.data);d['index.html']=d['index.html'].replace(SITE.encode(),b'https://wrong.example')
        with self.assertRaises(ValueError):self.check(self.bundle(data=d))
    def test_reviewed_workflow(self):
        with self.assertRaises(ValueError):self.check(self.bundle(),workflow='e'*40)
    def test_source_approval(self):
        approve_source(self.meta,['a'*40])
        with self.assertRaises(ValueError):approve_source(self.meta,['e'*40])
    def test_current_escape(self):
        for s in ['releases/../other','/srv/x','releases/x/y','releases/.hidden','$(id)']:
            with self.subTest(s=s),self.assertRaises(ValueError):release_target(s)
    def test_new_domain_is_configurable(self):
        other='https://future-brand.example'
        d={n:b.replace(SITE.encode(),other.encode()) for n,b in self.data.items()}
        self.assertEqual(validate_site(d,other)['files'],len(self.data))
if __name__=='__main__':unittest.main(verbosity=2)
