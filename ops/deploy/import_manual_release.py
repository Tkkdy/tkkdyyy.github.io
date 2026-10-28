"""Owner-only manual baseline import. No release/current/config changes; dry run default."""
import argparse,json,os,re,stat,sys,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from release_bundle import LIMIT,require,sha,safe_name,release_target,site_origin
from receiver import exclusive,https_body

def verify_manifest(candidate,raw,digest):
    require(candidate.is_absolute() and candidate.resolve()==candidate and candidate.is_dir(),'unsafe candidate')
    require(len(raw)<=2_000_000 and sha(raw)==digest,'unapproved manifest bytes')
    manifest=json.loads(raw);require(isinstance(manifest,list) and 0<len(manifest)<=5000,'invalid manifest')
    files={};total=0
    for item in manifest:
        require(isinstance(item,dict) and set(item)=={'path','bytes','sha256'},'invalid manifest item')
        name=safe_name(item['path']);require(name not in files,'duplicate manifest path')
        require(type(item['bytes']) is int and 0<=item['bytes']<=8_000_000 and re.fullmatch('[a-f0-9]{64}',item['sha256'] or ''),'invalid file size/hash')
        total+=item['bytes'];require(total<=LIMIT,'release too large')
        file=candidate/name;info=file.lstat();require(file.resolve()==file and stat.S_ISREG(info.st_mode),'unsafe release file');require(info.st_size==item['bytes'],'manual release bytes differ')
        body=file.read_bytes();require(len(body)==item['bytes'] and sha(body)==item['sha256'],'manual release bytes differ');files[name]=body
    actual=set()
    for file in candidate.rglob('*'):
        require(not file.is_symlink(),'linked release member')
        if file.is_dir():continue
        require(stat.S_ISREG(file.lstat().st_mode),'special release member');actual.add(file.relative_to(candidate).as_posix())
    require(actual==set(files),'unlisted or missing release files')
    require(all(n in files for n in ['index.html','404.html']) and any(n.endswith('.css') for n in files) and any(n.endswith('.js') for n in files),'missing critical baseline resources')
    return manifest,files

def import_manual(policy,target,source,manifest_file,digest,apply=False,legacy_record_sha256=None):
    import fcntl
    require(os.geteuid()==0,'owner import requires root; never callable by deployment key')
    policy=Path(policy);require(not policy.is_symlink() and policy.stat().st_uid==0 and not policy.stat().st_mode&0o022,'root-owned policy required')
    config=json.loads(policy.read_text());root=Path(config['root']);site=site_origin(config['site']);target=release_target(target)
    require(re.fullmatch('[a-f0-9]{40}',source or '') and source==config.get('bootstrapSourceSha'),'manual source must equal reviewed bootstrap source')
    require(root.is_absolute() and root.resolve()==root,'unsafe root')
    for folder in [root,root/'releases',root/'records']:require(folder.is_dir() and not folder.is_symlink(),'unsafe deployment folder')
    rid=Path(target).name;record=root/'records'/('manual-'+rid+'.json');saved_manifest=root/'records'/('manifest-'+rid+'.json')
    legacy_path=root/'records'/('deploy-'+rid+'.json')
    legacy=None
    if legacy_record_sha256 is not None:
        from release_records import validate_legacy
        require(config.get('enabled') is False,'legacy import requires disabled receiver')
        legacy=validate_legacy(legacy_path,target,source,digest,legacy_record_sha256)
        record=root/'records'/('legacy-'+rid+'.json')
    # Installation must provision this lock for the deployment UID; root must not create a 0600 lock that blocks it.
    fd=os.open(root/'records'/'.ci.lock',os.O_RDWR|os.O_NOFOLLOW)
    with os.fdopen(fd,'w'):
        fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        require(os.readlink(root/'current')==target,'manual baseline is not current')
        absent=[record,saved_manifest,root/'records'/('manual-'+rid+'.json')] if legacy is not None else [record,saved_manifest,legacy_path,root/'records'/('legacy-'+rid+'.json')]
        for path in absent:require(not path.exists() and not path.is_symlink(),'existing record must not be overwritten')
        if legacy is not None:validate_legacy(legacy_path,target,source,digest,legacy_record_sha256)
        raw=Path(manifest_file).read_bytes();manifest,files=verify_manifest(root/target,raw,digest)
        critical=['index.html',next(n for n in files if n.endswith('.css')),next(n for n in files if n.endswith('.js'))]
        for name in critical:require(https_body(site,name)==files[name],'manual public HTTPS bytes differ')
        require(os.readlink(root/'current')==target,'current changed during baseline verification')
        value={'recordType':'OWNER_IMPORTED_MANUAL','ciAccepted':False,'current':target,'site':site,'sourceSha':source,'sourceAttribution':'OWNER_REVIEWED_BOOTSTRAP_POLICY','originalManifestSha256':digest,'manifestSha256':sha(json.dumps(manifest,sort_keys=True).encode()),'fullManifestVerified':True,'publicCriticalVerified':True,'filesVerified':len(files),'utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'applied':apply}
        if legacy is not None:
            value.update(recordType='OWNER_VERIFIED_LEGACY',legacyRecordSha256=legacy_record_sha256,archiveSha256=legacy['archiveSha256'])
        if apply:
            if legacy is not None:validate_legacy(legacy_path,target,source,digest,legacy_record_sha256)
            # Commit marker last. Interrupted partial writes remain visible and are never overwritten.
            exclusive(saved_manifest,json.dumps(manifest,sort_keys=True).encode())
            exclusive(record,json.dumps(value,sort_keys=True).encode())
            directory_fd=os.open(root/'records',os.O_RDONLY|os.O_DIRECTORY)
            try:os.fsync(directory_fd)
            finally:os.close(directory_fd)
        return value

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--policy',default='/etc/preview-deploy/policy.json');p.add_argument('--target',required=True);p.add_argument('--source-sha',required=True);p.add_argument('--manifest',required=True);p.add_argument('--manifest-sha256',required=True);p.add_argument('--apply',action='store_true');p.add_argument('--legacy-record-sha256');a=p.parse_args()
    print(json.dumps(import_manual(a.policy,a.target,a.source_sha,a.manifest,a.manifest_sha256,a.apply,a.legacy_record_sha256)))
