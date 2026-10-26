"""Root-only disabled receiver installation. Default dry-run, no keys or releases."""
import argparse, hashlib, io, json, os, platform, re, stat, subprocess, sys, zipfile
from pathlib import Path

ROOT='/srv/www/preview.boenbot.top'
CURRENT='releases/preview-main-88ac30aa-f4f1c891-20261024T035620Z'
ACCOUNT='preview-deploy'
MODULES=('receiver.py','release_bundle.py','source_authority.py','rollback_release.py','release_records.py','import_manual_release.py')
CONFIGS={'/etc/nginx/nginx.conf','/etc/nginx/sites-enabled/default','/etc/nginx/sites-enabled/music.leux.me','/etc/nginx/sites-enabled/preview.boenbot.top'}
def sha(raw): return hashlib.sha256(raw).hexdigest()
def require(ok,message):
    if not ok: raise ValueError(message)
def command(*args):
    return subprocess.check_output(args,stderr=subprocess.PIPE,text=True,timeout=30)
def unpack(raw,approved_sha):
    require(re.fullmatch('[a-f0-9]{64}',approved_sha) and sha(raw)==approved_sha,'bundle approval hash differs')
    require(len(raw)<=2_000_000,'review bundle limit')
    expected={'plan.json','policy.disabled.json','original-manifest.json','SHA256SUMS'}|{'modules/'+n for n in MODULES}
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        items=z.infolist(); require(len(items)==len(expected) and {i.filename for i in items}==expected,'bundle whitelist differs')
        require(sum(i.file_size for i in items)<=2_000_000 and all(not i.flag_bits&1 and stat.S_ISREG(i.external_attr>>16) for i in items),'unsafe review member')
        data={i.filename:z.read(i) for i in items}
    lines=data['SHA256SUMS'].decode('ascii').splitlines(); sums={}
    for line in lines:
        digest,name=line.split('  ',1);require(name not in sums and re.fullmatch('[a-f0-9]{64}',digest),'duplicate/invalid checksum');sums[name]=digest
    require(set(sums)==expected-{'SHA256SUMS'} and all(sha(data[n])==sums[n] for n in sums),'bundle member hash differs')
    plan=json.loads(data['plan.json']); policy=json.loads(data['policy.disabled.json'])
    require(plan['schema']==1 and plan['stage']=='DISABLED_RECEIVER_INSTALL_REVIEW_ONLY' and plan['productionInstalled'] is False and plan['authorizationReceived'] is False,'unexpected review stage')
    require(plan['root']==ROOT and plan['expectedCurrent']==CURRENT,'unexpected installation root/current')
    require(re.fullmatch('/var/backups/dual-site-receiver-[0-9]{8}T[0-9]{6}Z',plan['backupDirectory']),'unsafe backup path')
    require(plan['policyDestination']=='/etc/preview-deploy/policy.json' and plan['moduleDestination']=='/usr/local/lib/preview-deploy','unexpected installation destination')
    expected_policy={'enabled':False,'root':ROOT,'site':'https://preview.boenbot.top','reviewedWorkflowSha':'NOT_CONFIGURED','approvedSourceShas':[],'sourceAuthority':'github-main','repository':'Tkkdy/tkkdyyy.github.io','bootstrapSourceSha':'88ac30aa31d4c806e6af9a71b955db2f0dd16967'}
    require(policy==plan['policy']==expected_policy,'policy is not exact disabled configuration')
    require(set(plan['expectedNginxConfigHashes'])==CONFIGS,'config pin whitelist differs')
    targets={p:p if p=='/etc/nginx/nginx.conf' else p.replace('/sites-enabled/','/sites-available/') for p in CONFIGS}
    require(plan.get('expectedNginxConfigTargets')==targets,'config target identity pins differ')
    require(plan['originalFileCount']==115 and sha(data['original-manifest.json'])==plan['originalManifestSha256'],'original manifest differs')
    require(set(plan['moduleHashes'])==set(MODULES) and all(sha(data['modules/'+n])==plan['moduleHashes'][n] for n in MODULES),'module identities differ')
    manifest=json.loads(data['original-manifest.json']);require(len(manifest)==115 and len({i['path'] for i in manifest})==115,'original file count differs')
    for item in manifest:
        name=item['path'];require(isinstance(name,str) and not name.startswith('/') and '\\' not in name and not any(p in ('','.', '..') for p in name.split('/')) and not any(ord(c)<32 for c in name),'unsafe original manifest path')
        require(type(item['bytes']) is int and 0<=item['bytes']<=8_000_000 and re.fullmatch('[a-f0-9]{64}',item['sha256']),'unsafe original manifest metadata')
    return plan,data,manifest

def exclusive(path,raw,mode=0o644,uid=0,gid=0):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode)
    with os.fdopen(fd,'wb') as f:
        os.fchmod(f.fileno(),mode);os.fchown(f.fileno(),uid,gid);f.write(raw);f.flush();os.fsync(f.fileno())

def perform(raw,approved_sha,apply=False,prefix=None,service_check=None):
    require(platform.system()=='Linux' and os.getuid()==0,'Linux root required; no sudo is invoked by this tool')
    if prefix is not None:
        require(os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('ISOLATED_RECEIVER_INSTALL')=='true' and str(prefix).startswith('/var/lib/dual-install-ci-'),'only disposable CI can remap installation paths')
        prefix=Path(prefix).resolve()
    else:require(service_check is None,'production service checks cannot be overridden')
    P=lambda s: Path(s) if prefix is None else prefix/str(s).lstrip('/')
    plan,data,manifest=unpack(raw,approved_sha)
    backup=P(plan['backupDirectory']); root=P(ROOT); current=root/'current'
    destinations=[P('/usr/local/lib/preview-deploy'),P('/etc/preview-deploy'),P('/var/lib/preview-deploy')]
    for path in [backup,*destinations,root/'records/.ci.lock']:
        require(not path.exists() and not path.is_symlink(),'pre-existing installation object: '+str(path))
    for name in (ACCOUNT,):
        try:pwd.getpwnam(name)
        except KeyError:pass
        else:raise ValueError('pre-existing deployment account')
    import grp, pwd
    try:grp.getgrnam(ACCOUNT)
    except KeyError:pass
    else:raise ValueError('pre-existing deployment group')
    for path in [backup.parent,*(p.parent for p in destinations)]:
        require(path.is_dir() and path.resolve()==path and path.stat().st_uid==0 and not path.stat().st_mode&0o022,'unsafe root installation parent: '+str(path))
    for path in [root,root/'releases',root/'records',root/CURRENT]:
        s=path.lstat();require(path.is_dir() and path.resolve()==path and s.st_uid==1001 and s.st_gid==1001 and stat.S_IMODE(s.st_mode)==0o755,'site identity/mode drift')
    require(current.is_symlink() and current.lstat().st_uid==0 and os.readlink(current)==CURRENT,'current link identity drift')
    def unchanged():
        require(os.readlink(current)==CURRENT,'current changed')
        for item in manifest:
            path=root/CURRENT/item['path'];s=path.lstat()
            require(path.resolve()==path and stat.S_ISREG(s.st_mode) and s.st_size==item['bytes'] and sha(path.read_bytes())==item['sha256'],'release manifest drift')
        files=[]
        for path in (root/CURRENT).rglob('*'):
            require(not path.is_symlink(),'linked release member')
            require(path.is_dir() or path.is_file(),'special release member')
            if path.is_file():files.append(path.relative_to(root/CURRENT).as_posix())
        require(set(files)=={i['path'] for i in manifest},'unlisted release files')
        for name,digest in plan['expectedNginxConfigHashes'].items():
            require(P(name).resolve()==P(plan['expectedNginxConfigTargets'][name]),'Nginx configuration target identity drift: '+name)
            require(sha(P(name).read_bytes())==digest,'Nginx config drift: '+name)
    unchanged()
    for name in ('nginx','ssh','certbot.timer'):
        result=service_check(name) if service_check else command('/usr/bin/systemctl','is-active',name).strip()
        require(result=='active','inactive protected service: '+name)
    # No assumption about ACL absence: tooling must be approved/installed first.
    acl_before={}
    for path in (root,root/'releases',root/'records'):
        acl=command('/usr/bin/getfacl','-c','-p',str(path))
        entries={line.strip() for line in acl.splitlines() if line.strip() and not line.startswith('#')}
        require(entries=={'user::rwx','group::r-x','other::r-x'},'unreviewed existing extended ACL or mask; stop for review')
        acl_before[str(path)]=command('/usr/bin/getfacl','-p',str(path))
    report={'scope':'DISABLED_RECEIVER_INSTALL','stage':'DRY_RUN_PASS','applied':False,'bundleSha256':approved_sha,'backup':str(backup),'current':CURRENT,'fullManifestVerified':True,'nginxConfigPinsVerified':True,'aclBaselineReviewed':True,'accountCreated':False,'keyInstalled':False,'receiverEnabled':False,'releaseSwitched':False,'allReleasesRetained':True}
    if not apply:return report
    backup.mkdir(mode=0o700)
    exclusive(backup/'original-acls.txt',''.join(acl_before.values()).encode(),0o600)
    exclusive(backup/'baseline.json',json.dumps(report,indent=2).encode(),0o600)
    exclusive(backup/'approved-bundle.zip',raw,0o600)
    acl_touched=False
    try:
        command('/usr/sbin/useradd','--system','--user-group','--no-create-home','--home-dir',str(P('/var/lib/preview-deploy')),'--shell','/bin/sh',ACCOUNT)
        command('/usr/sbin/usermod','--password','*',ACCOUNT)
        user=pwd.getpwnam(ACCOUNT);require(user.pw_uid!=0 and os.getgrouplist(ACCOUNT,user.pw_gid)==[user.pw_gid],'unexpected privileged account/group')
        report['accountCreated']=True;report['deploymentUid']=user.pw_uid
        for path in destinations:path.mkdir(mode=0o755);path.chmod(0o755)
        for n in MODULES:exclusive(destinations[0]/n,data['modules/'+n])
        exclusive(destinations[1]/'policy.json',data['policy.disabled.json'])
        ssh=destinations[2]/'.ssh';ssh.mkdir(mode=0o755);ssh.chmod(0o755);exclusive(ssh/'authorized_keys',b'')
        exclusive(root/'records/.ci.lock',b'',0o600,user.pw_uid,user.pw_gid)
        # Baseline has no named/default ACL or mask. Adding this one principal
        # therefore cannot silently broaden some existing masked ACL entry.
        acl_touched=True
        for path in (root,root/'releases',root/'records'):command('/usr/bin/setfacl','-m','u:'+str(user.pw_uid)+':rwx',str(path))
        unchanged()
        for n in MODULES:
            path=destinations[0]/n;require(path.stat().st_uid==0 and stat.S_IMODE(path.stat().st_mode)==0o644 and sha(path.read_bytes())==plan['moduleHashes'][n],'installed module protection differs')
        require(json.loads((destinations[1]/'policy.json').read_bytes())['enabled'] is False and (ssh/'authorized_keys').read_bytes()==b'','unexpected activation')
        # Real access checks with dedicated identity, not an inferred mode claim.
        for path in (destinations[0],*destinations[0].iterdir(),destinations[1],destinations[1]/'policy.json',destinations[2],ssh,ssh/'authorized_keys',P('/etc/nginx'),P('/etc/letsencrypt')):
            result=subprocess.run(['/usr/sbin/runuser','-u',ACCOUNT,'--','/usr/bin/test','-w',str(path)],capture_output=True,timeout=10)
            require(result.returncode==1,'unexpected deployment write access or access test error: '+str(path))
        for path in (*destinations,ssh):command('/usr/sbin/runuser','-u',ACCOUNT,'--','/usr/bin/test','-x',str(path))
        for path in (*destinations[0].iterdir(),destinations[1]/'policy.json',ssh/'authorized_keys'):command('/usr/sbin/runuser','-u',ACCOUNT,'--','/usr/bin/test','-r',str(path))
        for path in (root,root/'releases',root/'records',root/'records/.ci.lock'):
            command('/usr/sbin/runuser','-u',ACCOUNT,'--','/usr/bin/test','-w',str(path))
        report.update(stage='INSTALLED_DISABLED_PASS',applied=True)
        exclusive(backup/'result.json',json.dumps(report,indent=2).encode(),0o600)
        return report
    except BaseException as error:
        # No key was ever installed, policy is always disabled, and no content
        # switch is attempted. Retain partial installation for owner inspection.
        restored=False
        if acl_touched:
            command('/usr/bin/setfacl','--restore='+str(backup/'original-acls.txt'));restored=True
        failure={**report,'stage':'STOP_PARTIAL_INSTALL_RETAINED','errorType':type(error).__name__,'message':str(error),'originalACLsRestored':restored,'accountMayExist':True}
        exclusive(backup/'failure.json',json.dumps(failure,indent=2).encode(),0o600)
        raise

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--bundle',required=True);p.add_argument('--sha256',required=True);p.add_argument('--apply',action='store_true');p.add_argument('--check-bundle-only',action='store_true');a=p.parse_args();raw=Path(a.bundle).read_bytes()
    if a.check_bundle_only:
        require(not a.apply,'bundle-only cannot apply');plan,data,manifest=unpack(raw,a.sha256);print(json.dumps({'stage':'OFFLINE_BUNDLE_VALIDATED','files':len(manifest),'installed':False}));return
    # Execute only the owner-staged immutable root copy, never a user-writable
    # Python script or ancestor. This check does not replace reviewing its hash.
    script=Path(__file__).resolve()
    for path in (script,*script.parents):
        s=path.stat();require(s.st_uid==0 and not s.st_mode&0o022,'installer must be staged under root-owned protected ancestors')
    print(json.dumps(perform(raw,a.sha256,a.apply),sort_keys=True))
if __name__=='__main__':main()