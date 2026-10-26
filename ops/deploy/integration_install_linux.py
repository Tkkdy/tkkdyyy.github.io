"""Disposable CI: real root/account/ACL installation, synthetic site/config/services."""
import hashlib,json,os,pathlib,shutil,sys,tempfile
P=pathlib.Path
if sys.platform!='linux' or os.getuid()!=0 or os.environ.get('GITHUB_ACTIONS')!='true' or os.environ.get('ISOLATED_RECEIVER_INSTALL')!='true':raise SystemExit('Disposable root CI only')
CODE=P(__file__).resolve().parent;sys.path.insert(0,str(CODE))
import install_disabled_receiver as install
import prepare_receiver_install as prep
from test_install_preparation import InstallationReviewTests
fixture=InstallationReviewTests();fixture.setUp()
T=P(tempfile.mkdtemp(prefix='dual-install-ci-',dir='/var/lib'));T.chmod(0o755)
def mapped(path):return T/str(path).lstrip('/')
for name in ('/var/backups','/usr/local/lib','/etc/nginx/sites-enabled','/etc/letsencrypt','/var/lib','/srv/www'):
    mapped(name).mkdir(parents=True,exist_ok=True)
root=mapped(install.ROOT);old=root/install.CURRENT
for path in (root,root/'releases',root/'records',old):path.mkdir(parents=True,exist_ok=True);os.chown(path,1001,1001);path.chmod(0o755)
manifest=[]
for n in range(115):
    name='index.html' if n==0 else 'files/中文-'+str(n);body=('synthetic-old-'+str(n)).encode();path=old/name;path.parent.mkdir(exist_ok=True);path.write_bytes(body);manifest.append({'path':name,'bytes':len(body),'sha256':install.sha(body)})
fixture.original=manifest;fixture.raw=json.dumps(manifest,ensure_ascii=False).encode();prep.MANIFEST_SHA=install.sha(fixture.raw)
fixture.report['releaseManifest']['manifest']=manifest
fixture.modules={name:(CODE/name).read_bytes() for name in prep.MODULES}
for name in fixture.configs:
    path=mapped(name);path.write_bytes(name.encode())
os.symlink(install.CURRENT,root/'current')
plan=fixture.plan();raw=prep.archive(plan,fixture.raw,fixture.modules);digest=install.sha(raw)
service=lambda name:'active' # fixture only; real production path always invokes systemctl
checks=[]
try:
    install.perform(raw,'0'*64,prefix=T,service_check=service)
    raise AssertionError('bad digest unexpectedly accepted')
except ValueError:checks.append('bad-approval-hash-refused-before-mutation')
changed=mapped('/etc/nginx/sites-enabled/music.leux.me');before=changed.read_bytes();changed.write_bytes(b'drift')
try:
    install.perform(raw,digest,prefix=T,service_check=service)
    raise AssertionError('config drift unexpectedly accepted')
except ValueError as error:assert 'Nginx config drift' in str(error)
changed.write_bytes(before);checks.append('unrelated-config-drift-refused-before-mutation')
result=install.perform(raw,digest,prefix=T,service_check=service);assert result['stage']=='DRY_RUN_PASS' and not mapped(plan['backupDirectory']).exists();checks.append('actual-root-dry-run-no-backup-or-account-created')
# Named ACLs cannot be silently widened by automatic mask recalculation.
install.command('/usr/bin/setfacl','-m','u:33:r-x',str(root))
try:
    install.perform(raw,digest,prefix=T,service_check=service)
    raise AssertionError('unknown ACL accepted')
except ValueError as error:assert 'unreviewed existing extended ACL' in str(error)
install.command('/usr/bin/setfacl','-b',str(root));checks.append('pre-existing-named-ACL-refused-before-mutation')
result=install.perform(raw,digest,apply=True,prefix=T,service_check=service)
assert result['stage']=='INSTALLED_DISABLED_PASS' and result['applied'] and not result['keyInstalled'] and not result['receiverEnabled'];checks.append('actual-root-disabled-account-modules-policy-lock-and-ACL-install')
assert (mapped('/var/lib/preview-deploy')/'.ssh/authorized_keys').read_bytes()==b''
assert os.readlink(root/'current')==install.CURRENT
for item in manifest:assert install.sha((old/item['path']).read_bytes())==item['sha256']
checks.append('old-current-and-all-115-synthetic-files-unchanged')
try:
    install.perform(raw,digest,apply=True,prefix=T,service_check=service)
    raise AssertionError('existing install overwritten')
except ValueError:checks.append('repeat-install-refused-without-overwrite')
backup=mapped(plan['backupDirectory']);install.command('/usr/bin/setfacl','--restore='+str(backup/'original-acls.txt'))
for path in (root,root/'releases',root/'records'):
    value=install.command('/usr/bin/getfacl','-c','-p',str(path));assert 'user:'+str(result['deploymentUid'])+':' not in value
assert os.readlink(root/'current')==install.CURRENT and (mapped('/var/lib/preview-deploy')/'.ssh/authorized_keys').read_bytes()==b''
checks.append('actual-exact-ACL-restore-with-locked-account-empty-key-and-all-files-retained')
report={'state':'PASS','scope':'DISPOSABLE_REAL_ROOT_ACCOUNT_ACL_INSTALL_SYNTHETIC_SITE_CONFIG_SERVICES','checks':checks,'productionInstalled':False,'productionACLValidated':False,'realSystemctlValidated':False,'publicSiteChanged':False,'allTestArtifactsRetained':True,'testRoot':str(T)}
E=CODE.parent.parent/'integration-evidence';E.mkdir(exist_ok=True);(E/'disabled-install.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
fixture.doCleanups()