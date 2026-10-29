"""One-use root-only, approved live-artifact promotion. Dry-run default.
Never edits policy, Nginx, certificates or installed modules. Public verdict mandatory.
"""
import argparse,json,os,re,secrets,select,sys,tempfile,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from release_bundle import require,sha,release_target,validate_site
from release_records import root_bytes,read_record
from import_manual_release import verify_manifest
from receiver import exclusive,atomic_link,https_body
from prepare_live_domain_candidate import prepare

OLD='https://preview.boenbot.top'
NEW='https://tkkdy.me'
NGINX_ROOT=Path('/etc/nginx')
INSTALLED_ROOT=Path('/usr/local/lib/preview-deploy')

def tree_digest(root):
    require(root.is_dir() and root.resolve()==root,'unsafe protected tree')
    values={}
    for p in sorted(root.rglob('*')):
        if p.is_symlink():values[p.relative_to(root).as_posix()]='link:'+os.readlink(p)
        elif p.is_file():values[p.relative_to(root).as_posix()]=sha(root_bytes(p,2_000_000))
    return sha(json.dumps(values,sort_keys=True).encode())

def validate_record(root,rid,value):
    """Historical owner identity is root-owned and tied to saved approval + derivation."""
    raw=root_bytes(root/'records'/('manual-'+rid+'.json'))
    require(json.loads(raw)==value,'owner record bytes differ')
    a_raw=root_bytes(root/'records'/('owner-approval-'+rid+'.json'))
    a=json.loads(a_raw)
    require(sha(a_raw)==value.get('approvalSha256') and a.get('enabled') is True,'owner approval invalid')
    require(value.get('recordType')=='OWNER_DERIVED_STATIC' and value.get('ciAccepted') is False,'owner provenance invalid')
    require(value.get('applied') is True and value.get('fullManifestVerified') is True and value.get('publicCriticalVerified') is True,'owner verification missing')
    require(value.get('current')==a.get('target')=='releases/'+rid and value.get('site')==NEW and value.get('indexingProfile')=='production','owner target/site differs')
    require(a.get('root')==str(root) and a.get('scope')=='ONE_OWNER_LIVE_DERIVED_PROMOTION','owner approval scope differs')
    require(value.get('manifestSha256')==a.get('candidateManifestSha256'),'owner manifest differs')
    require(value.get('baselineCurrent')==a.get('expectedCurrent') and value.get('sourceAttribution')=='DERIVED_FROM_OWNER_VERIFIED_LIVE_ARTIFACT','owner lineage missing')
    baseline=read_record(root,Path(release_target(a['expectedCurrent'])).name)
    require(baseline.get('recordType')=='OWNER_VERIFIED_LEGACY' and baseline['sourceSha']==value.get('sourceSha')==a.get('baselineSourceSha'),'owner baseline differs')
    require(sha(root_bytes(root/'records'/('legacy-'+Path(a['expectedCurrent']).name+'.json')))==a.get('baselineBridgeSha256'),'owner baseline bridge differs')
    require(sha(root_bytes(root/'records'/('manifest-'+rid+'.json'),2_000_000))==value['manifestSha256'],'owner saved manifest differs')
    require(sha(root_bytes(root/'records'/('derivation-'+rid+'.json'),2_000_000))==a.get('derivationSha256'),'owner derivation differs')
    verdict=value.get('publicAcceptance',{})
    require(verdict.get('passed') is True and verdict.get('scope')=='OWNER_GUARDED_PUBLIC_ACCEPTANCE' and verdict.get('candidateManifestSha256')==value['manifestSha256'],'owner public acceptance missing')
    require(verdict.get('gateSha256')==a.get('externalGateSha256') and all(verdict.get(k) is True for k in ['strictTls','canonical','searchAndClick','desktop','mobile','oldDomainNoindex','newDomainNoindex','pagesIndependent','editorEntry','friends']),'owner public evidence differs')
    return value

def frozen_config(a,policy):
    require(sha(root_bytes(Path(policy)))==a['policySha256'],'policy drift')
    config=json.loads(root_bytes(Path(policy)))
    require(config.get('enabled') is False and config.get('site')==OLD and config.get('sourceAuthority')=='github-main','disabled legacy policy required')
    require(config['root']==a['root'] and config['bootstrapSourceSha']==a['baselineSourceSha'],'policy root/source differs')
    require(a.get('protectedFilesSha256') and a.get('toolFilesSha256'),'protected files/tools required')
    require(str(Path(policy)) in a['protectedFilesSha256'],'policy must be frozen')
    require(tree_digest(NGINX_ROOT)==a.get('nginxTreeSha256'),'Nginx tree drift')
    require(tree_digest(INSTALLED_ROOT)==a.get('installedToolsTreeSha256'),'installed tools drift')
    for name,digest in a['protectedFilesSha256'].items():
        require(Path(name).is_absolute() and sha(root_bytes(Path(name),2_000_000))==digest,'protected configuration drift '+name)
    tools=Path(__file__).resolve().parent
    for name,digest in a['toolFilesSha256'].items():
        require(Path(name).name==name and name.endswith('.py'),'unsafe tool name')
        require(sha(root_bytes(tools/name,2_000_000))==digest,'unreviewed tool '+name)
    # All local Python modules, including this entrypoint, must be covered.
    require(set(a['toolFilesSha256'])=={p.name for p in tools.glob('*.py')},'unlisted tool module')
    return config

def promote(approval,approval_sha256,policy,candidate,baseline_manifest,apply=False,verdict_reader=None):
    import fcntl
    require(os.geteuid()==0,'root owner only; never deployment SSH identity')
    a_raw=root_bytes(Path(approval));require(sha(a_raw)==approval_sha256,'approval digest differs');a=json.loads(a_raw)
    require(a.get('schema')==1 and a.get('scope')=='ONE_OWNER_LIVE_DERIVED_PROMOTION' and a.get('enabled') is True,'explicit owner approval required')
    require(type(a.get('expiresEpoch')) is int and time.time()<a['expiresEpoch']<=time.time()+86400,'approval expired or exceeds 24h')
    config=frozen_config(a,policy);root=Path(a['root']);require(root.is_absolute() and root.resolve()==root,'unsafe deployment root')
    for p in [root,root/'records',root/'releases']:require(p.is_dir() and p.resolve()==p,'unsafe deployment folder')
    expected=release_target(a['expectedCurrent']);target=release_target(a['target']);rid=Path(target).name
    require(re.fullmatch('[a-f0-9]{16}',a.get('attemptId','')),'invalid one-use attempt ID')
    require(re.fullmatch('[a-f0-9]{64}',a.get('externalGateSha256','')),'reviewed external gate required')
    require(target=='releases/owner-tkkdy-'+a['candidateManifestSha256'][:12]+'-'+a['attemptId'] and target!=expected,'target identity differs')
    require(a.get('site')==NEW and a.get('indexingProfile')=='production','owner site/profile differs')
    fd=os.open(root/'records/.ci.lock',os.O_RDWR|os.O_NOFOLLOW)
    with os.fdopen(fd,'w'):
        fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        require(os.readlink(root/'current')==expected,'current drift')
        baseline=read_record(root,Path(expected).name)
        require(baseline.get('recordType')=='OWNER_VERIFIED_LEGACY' and baseline.get('sourceSha')==a['baselineSourceSha'],'baseline provenance differs')
        require(sha(root_bytes(root/'records'/('legacy-'+Path(expected).name+'.json')))==a['baselineBridgeSha256'],'baseline bridge drift')
        original=root_bytes(Path(baseline_manifest),2_000_000)
        require(sha(original)==a['baselineOriginalManifestSha256']==baseline['originalManifestSha256'],'original manifest identity differs')
        _,old_files=verify_manifest(root/expected,original,a['baselineOriginalManifestSha256'])
        candidate=Path(candidate);raw=root_bytes(candidate/'manifest.json',2_000_000)
        _,files=verify_manifest((candidate/'site').resolve(),raw,a['candidateManifestSha256'])
        derivation=root_bytes(candidate/'derivation.json',2_000_000);require(sha(derivation)==a['derivationSha256'],'derivation digest differs')
        # Recompute from actual baseline with trusted tool; the artifact cannot self-attest parity.
        with tempfile.TemporaryDirectory(prefix='owner-derive-') as tmp:
            replay=Path(tmp)/'candidate';report=prepare(root/expected,baseline_manifest,a['baselineOriginalManifestSha256'],replay)
            require(report==json.loads(derivation),'derivation report differs')
            replay_files={p.relative_to(replay/'site').as_posix():p.read_bytes() for p in (replay/'site').rglob('*') if p.is_file()}
            require(files==replay_files,'candidate differs from exact live derivation')
        validate_site(files,NEW,'production')
        outputs=[root/'records'/(kind+'-'+rid+'.json') for kind in ['manual','deploy','legacy','manifest','owner-approval','derivation','owner-claim']]
        require(not (root/target).exists() and not (root/target).is_symlink(),'release already exists')
        require(all(not p.exists() and not p.is_symlink() for p in outputs),'one-use record already exists')
        frozen_config(a,policy)
        result={'scope':a['scope'],'target':target,'expectedCurrent':expected,'candidateManifestSha256':a['candidateManifestSha256'],'filesVerified':len(files),'applied':False,'ciAccepted':False}
        if not apply:return result
        # A failed attempt is consumed too. Never retry or overwrite its evidence.
        exclusive(root/'records'/('owner-claim-'+rid+'.json'),json.dumps(result,sort_keys=True).encode())
        folder=root/target;folder.mkdir(mode=0o755)
        for name,body in files.items():
            p=folder/name;p.parent.mkdir(parents=True,exist_ok=True);exclusive(p,body)
        verify_manifest(folder,raw,a['candidateManifestSha256'])
        exclusive(root/'records'/('owner-approval-'+rid+'.json'),a_raw)
        exclusive(root/'records'/('derivation-'+rid+'.json'),derivation)
        exclusive(root/'records'/('manifest-'+rid+'.json'),raw)
        critical=['index.html',next(n for n in files if n.endswith('.css')),next(n for n in files if n.endswith('.js'))]
        committed=False
        try:
            frozen_config(a,policy)
            require(time.time()<a['expiresEpoch'],'approval expired before switch')
            atomic_link(root,target,expected)
            for host in [NEW,OLD]:
                for name in critical:require(https_body(host,name)==files[name],'server strict HTTPS bytes differ')
            token=secrets.token_hex(24)
            proposal={**result,'phase':'WAIT_PUBLIC_VERDICT','token':token,'scope':'OWNER_GUARDED_PUBLIC_ACCEPTANCE','externalGateSha256':a['externalGateSha256']}
            if verdict_reader is None:
                print(json.dumps(proposal),flush=True)
                require(select.select([sys.stdin],[],[],900)[0],'public verdict timeout')
                line=sys.stdin.readline(65537);require(0<len(line)<=65536,'public verdict size');verdict=json.loads(line)
            else:verdict=verdict_reader(proposal)
            require(verdict.get('token')==token and verdict.get('passed') is True and verdict.get('scope')==proposal['scope'] and verdict.get('candidateManifestSha256')==a['candidateManifestSha256'],'public verdict differs')
            require(verdict.get('gateSha256')==a['externalGateSha256'],'unreviewed external gate')
            for key in ['strictTls','canonical','searchAndClick','desktop','mobile','oldDomainNoindex','newDomainNoindex','pagesIndependent','editorEntry','friends']:
                require(verdict.get(key) is True,'public acceptance missing '+key)
            frozen_config(a,policy);require(os.readlink(root/'current')==target,'current drift after verdict')
            require(time.time()<a['expiresEpoch'] and sha(root_bytes(Path(approval)))==sha(a_raw),'approval changed or expired during public acceptance')
            record={'recordType':'OWNER_DERIVED_STATIC','ciAccepted':False,'applied':True,'site':NEW,'indexingProfile':'production','current':target,'baselineCurrent':expected,'sourceSha':baseline['sourceSha'],'sourceAttribution':'DERIVED_FROM_OWNER_VERIFIED_LIVE_ARTIFACT','manifestSha256':a['candidateManifestSha256'],'approvalSha256':sha(a_raw),'fullManifestVerified':True,'publicCriticalVerified':True,'publicAcceptance':verdict,'utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
            exclusive(root/'records'/('manual-'+rid+'.json'),json.dumps(record,sort_keys=True).encode())
            directory=os.open(root/'records',os.O_RDONLY|os.O_DIRECTORY)
            try:os.fsync(directory)
            finally:os.close(directory)
            committed=True
            return {**result,'applied':True,'guardedPublicAcceptance':True,'indexingActivated':False}
        except BaseException:
            if os.readlink(root/'current')==target and not committed:
                atomic_link(root,expected,target)
                for host in [OLD,NEW]:require(https_body(host,'index.html')==old_files['index.html'],'restore HTTPS verification failed')
            raise

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['approval','approval-sha256','policy','candidate','baseline-manifest']:p.add_argument('--'+name,required=True)
    p.add_argument('--apply',action='store_true');a=p.parse_args()
    print(json.dumps(promote(a.approval,a.approval_sha256,a.policy,a.candidate,a.baseline_manifest,a.apply)))
