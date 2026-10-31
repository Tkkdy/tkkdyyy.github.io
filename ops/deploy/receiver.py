"""Uninstalled Linux forced-command receiver. No sudo, Nginx, shell or release deletion."""
import functools,http.server,json,os,re,secrets,select,signal,struct,sys,threading,time,urllib.parse,urllib.request
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from release_bundle import LIMIT,load_bundle,release_target,require,sha,site_origin,approve_source
def emit(**obj):print(json.dumps(obj),flush=True)
def exclusive(path,body,mode=0o644):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode)
    with os.fdopen(fd,'wb') as f:f.write(body);f.flush();os.fsync(f.fileno())
def atomic_link(root,new,expected):
    require(os.readlink(root/'current')==expected,'current drift')
    temp=root/('.ci-switch-'+secrets.token_hex(12));os.symlink(new,temp);os.replace(temp,root/'current')
    fd=os.open(root,os.O_DIRECTORY)
    try:os.fsync(fd)
    finally:os.close(fd)
def exact(stream,n):
    data=stream.read(n);require(len(data)==n,'truncated input');return data
def https_body(site,path):
    url=site+'/'+urllib.parse.quote(path)
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(url,timeout=20) as r:
        require(r.geturl()==url and r.status==200,'HTTPS status/redirect')
        return r.read(8_000_001)
def timeout_handler(signum,frame):raise TimeoutError('controlled receiver timeout')
def activate_transaction(root,new,previous,critical,data,old_hash,metadata,header,manifest,stream):
    rid=metadata['releaseId'];site=metadata['site'];committed=False
    signal.alarm(1000)
    try:
        atomic_link(root,new,previous)
        for name in critical:require(sha(https_body(site,name))==sha(data[name]),'server strict HTTPS posthealth')
        token=secrets.token_hex(24);emit(phase='WAIT_PUBLIC_VERDICT',token=token,releaseId=rid,current=new,previous=previous)
        require(select.select([stream],[],[],900)[0],'public verdict timeout')
        line=stream.readline(4097);require(0<len(line)<=4096,'invalid verdict size')
        verdict=json.loads(line);require(verdict.get('token')==token and verdict.get('passed') is True,'public verification failed')
        require(os.readlink(root/'current')==new,'current drift after public acceptance')
        record={**metadata,'recordType':'CI_ACCEPTED','ciAccepted':True,'archiveSha256':header['archiveSha256'],'manifestSha256':sha(json.dumps(manifest,sort_keys=True).encode()),'previousCurrent':previous,'current':new,'publicAcceptance':verdict,'utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
        exclusive(root/'records'/('deploy-'+rid+'.json'),json.dumps(record,indent=2).encode())
        committed=True;signal.alarm(0);emit(phase='COMMITTED',record=record)
    except BaseException:
        signal.alarm(60)
        if os.readlink(root/'current')==new and not committed:
            atomic_link(root,previous,new);require(sha(https_body(site,'index.html'))==old_hash,'rollback HTTPS verification failed')
            emit(phase='ROLLED_BACK',current=previous,allReleasesRetained=True)
        raise

def authorize_source(metadata,config,root,previous):
    """Fail closed: explicit allowlist, or the exact current public main + ancestry."""
    if config.get('sourceAuthority','allowlist')=='allowlist':
        approve_source(metadata,config.get('approvedSourceShas',[]));return
    require(config.get('sourceAuthority')=='github-main','unknown source authority')
    require(config.get('repository')=='Tkkdy/tkkdyyy.github.io','unexpected repository')
    from source_authority import verify_main
    from release_records import read_record
    rid=Path(previous).name
    has_record=any(path.exists() or path.is_symlink() for path in [root/'records'/(kind+'-'+rid+'.json') for kind in ['deploy','manual']])
    baseline=read_record(root,rid)['sourceSha'] if has_record else config['bootstrapSourceSha']
    verify_main(config['repository'],metadata['sourceSha'],baseline)

def main(policy_path=None):
    import fcntl
    require(os.getuid()!=0,'dedicated nonroot UID required')
    require(os.environ.get('SSH_ORIGINAL_COMMAND')=='deploy-v1','only deploy-v1 accepted')
    p=Path('/etc/preview-deploy/policy.json') if policy_path is None else Path(policy_path)
    require(not p.is_symlink() and p.stat().st_uid==0 and not p.stat().st_mode&0o022,'policy must be root-owned and nonwritable')
    config=json.loads(p.read_text());require(config['enabled'] is True,'receiver disabled')
    require(re.fullmatch('[a-f0-9]{40}',config['reviewedWorkflowSha']),'reviewed workflow not configured')
    site=site_origin(config['site']);root=Path(config['root'])
    require(root.is_absolute() and root.resolve()==root,'linked/relative root')
    for folder in [root,root/'releases',root/'records']:require(folder.is_dir() and not folder.is_symlink(),'unsafe deployment folder')
    signal.signal(signal.SIGALRM,timeout_handler);signal.signal(signal.SIGTERM,timeout_handler);signal.signal(signal.SIGHUP,timeout_handler);signal.alarm(120)
    lockfd=os.open(root/'records'/'.ci.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
    fcntl.flock(lockfd,fcntl.LOCK_EX|fcntl.LOCK_NB)
    with os.fdopen(lockfd,'w'):
        stream=sys.stdin.buffer;emit(phase='READY_FOR_BUNDLE',current=release_target(os.readlink(root/'current')));size=struct.unpack('!I',exact(stream,4))[0];require(0<size<=16384,'header limit')
        header=json.loads(exact(stream,size));size=header['archiveBytes'];require(type(size)==int and 0<size<=LIMIT,'archive limit')
        previous=release_target(header['expectedCurrent']);require(os.readlink(root/'current')==previous,'approved current differs')
        metadata,manifest,data=load_bundle(exact(stream,size),header['archiveSha256'],site,config['reviewedWorkflowSha'],config.get('indexingProfile','preview'))
        authorize_source(metadata,config,root,previous)
        rid=metadata['releaseId'];new=release_target('releases/'+rid);candidate=root/new
        require(not (root/'records'/('deploy-'+rid+'.json')).exists(),'existing record')
        candidate.mkdir(mode=0o755) # Exclusive; failed/incomplete versions also retained.
        for name,body in sorted(data.items()):
            target=candidate/name;target.parent.mkdir(parents=True,exist_ok=True);exclusive(target,body)
        for item in manifest:require(sha((candidate/item['path']).read_bytes())==item['sha256'],'disk hash')
        critical=['index.html',next(n for n in data if n.endswith('.css')),next(n for n in data if n.endswith('.js'))]
        class Quiet(http.server.SimpleHTTPRequestHandler):
            def log_message(self,*args):pass
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(candidate)))
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:
            opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
            for name in critical:
                with opener.open('http://127.0.0.1:'+str(server.server_port)+'/'+urllib.parse.quote(name),timeout=5) as r:require(r.status==200 and sha(r.read())==sha(data[name]),'candidate HTTP prehealth')
        finally:server.shutdown();server.server_close()
        old_hash=sha((root/previous/'index.html').read_bytes());committed=False
        exclusive(root/'records'/('manifest-'+rid+'.json'),json.dumps(manifest,sort_keys=True).encode())
        exclusive(root/'records'/('intent-'+rid+'.json'),json.dumps({'previous':previous,'new':new,'archiveSha256':header['archiveSha256'],'metadata':metadata}).encode())
        authorize_source(metadata,config,root,previous) # Recheck after extraction/prehealth, before activation.
        activate_transaction(root,new,previous,critical,data,old_hash,metadata,header,manifest,stream)

if __name__=='__main__':
    try:main()
    except BaseException as error:emit(phase='FAILED_NO_RETRY',errorType=type(error).__name__,message=str(error));sys.exit(1)
