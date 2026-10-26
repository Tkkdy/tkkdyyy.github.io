import copy, io, json, unittest, zipfile
import install_disabled_receiver as install
import prepare_receiver_install as prep
import test_install_preparation as fixture_module

class DisabledInstallerBundleTests(unittest.TestCase):
    def setUp(self):
        self.fixture=fixture_module.InstallationReviewTests();self.fixture.setUp();self.addCleanup(self.fixture.doCleanups)
        self.plan=self.fixture.plan()
    def bundle(self):return prep.archive(self.plan,self.fixture.raw,self.fixture.modules)
    def test_exact_disabled_bundle_is_accepted_offline(self):
        raw=self.bundle();plan,data,manifest=install.unpack(raw,install.sha(raw));self.assertEqual(len(manifest),115);self.assertFalse(plan['policy']['enabled'])
    def test_unapproved_archive_hash_is_refused(self):
        with self.assertRaisesRegex(ValueError,'approval hash differs'):install.unpack(self.bundle(),'0'*64)
    def test_enabled_policy_is_refused_even_with_new_checksums(self):
        self.plan['policy']['enabled']=True;raw=self.bundle()
        with self.assertRaisesRegex(ValueError,'exact disabled'):install.unpack(raw,install.sha(raw))
    def test_arbitrary_installation_root_or_backup_is_refused(self):
        for key,value in [('root','/etc'),('backupDirectory','/var/backups/../etc'),('moduleDestination','/usr/bin')]:
            plan=copy.deepcopy(self.plan);plan[key]=value;raw=prep.archive(plan,self.fixture.raw,self.fixture.modules)
            with self.assertRaises(ValueError):install.unpack(raw,install.sha(raw))
    def test_module_payload_changed_without_review_plan_pin_is_refused(self):
        modules=dict(self.fixture.modules);modules['receiver.py']=b'changed';raw=prep.archive(self.plan,self.fixture.raw,modules)
        with self.assertRaisesRegex(ValueError,'module identities differ'):install.unpack(raw,install.sha(raw))
    def test_linked_or_extra_member_refused_before_extract(self):
        original=self.bundle()
        for name,mode in [('extra.txt',0o100644),('plan.json',0o120777)]:
            out=io.BytesIO()
            with zipfile.ZipFile(io.BytesIO(original)) as source,zipfile.ZipFile(out,'w') as target:
                for item in source.infolist():
                    if item.filename==name:continue
                    target.writestr(item,source.read(item))
                item=zipfile.ZipInfo(name);item.external_attr=mode<<16;target.writestr(item,b'bad')
            raw=out.getvalue()
            with self.assertRaises(ValueError):install.unpack(raw,install.sha(raw))
    def test_checksum_file_cannot_omit_file(self):
        out=io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(self.bundle())) as source,zipfile.ZipFile(out,'w') as target:
            for item in source.infolist():
                body=source.read(item)
                if item.filename=='SHA256SUMS':body=b'\n'.join(body.splitlines()[:-1])+b'\n'
                target.writestr(item,body)
        raw=out.getvalue()
        with self.assertRaisesRegex(ValueError,'member hash differs'):install.unpack(raw,install.sha(raw))
if __name__=='__main__':unittest.main()