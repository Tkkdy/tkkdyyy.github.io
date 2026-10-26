"""Real nonroot receiver failure recovery using synthetic static files and strict TLS.
Disposable CI only. No production host, credentials, build or publication.
"""
import functools,hashlib,http.server,io,json,os,pwd,select,shutil,signal,socket,ssl,struct,subprocess,sys,tempfile,threading,time,zipfile
from pathlib import Path
assert sys.platform=='linux' and os.getuid()==0 and os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('RECEIVER_DISCONNECT_FIXTURE')=='true'
CODE=Path(__file__).resolve().parent;sys.path.insert(0,str(CODE))
from release_bundle import load_bundle,sha
E=CODE.parent.parent/'integration-evidence';E.mkdir(exist_ok=True)
T=Path(tempfile.mkdtemp(prefix='receiver-disconnect-ci-',dir='/var/lib'));T.chmod(0o755)
USER='receiver-disconnect-fixture'
subprocess.run(['useradd','--system','--user-group','--no-create-home','--shell','/bin/sh',USER],check=True)
subprocess.run(['usermod','--password','*',USER],check=True)
u=pwd.getpwnam(USER)
def cmd(args):return subprocess.run(args,capture_output=True,check=True,timeout=15)
def port():
    with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
httpsport=port();sshport=port();SITE='https://127.0.0.1:'+str(httpsport);SOURCE=os.environ['GITHUB_SHA']
cmd(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',str(T/'tls.key'),'-out',str(T/'tls.crt'),'-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'])
(T/'tls.crt').chmod(0o644)
html=('<meta name="robots" content="noindex"><link rel="canonical" href="'+SITE+'/"><link rel="stylesheet" href="/a.css"><script src="/a.js"></script>new').encode()
data={'index.html':html,'404.html':b'<meta name="robots" content="noindex">missing','a.css':b'body{}','a.js':b'void 0;','pagefind/pagefind.js':b'/* synthetic fixture, not search acceptance */','pagefind/pagefind-entry.json':b'{}','rss.xml':('<rss><channel><link>'+SITE+'/</link></channel></rss>').encode(),'sitemap-index.xml':b'<sitemapindex/>','sitemap-0.xml':('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+SITE+'/</loc></url></urlset>').encode(),'robots.txt':('User-agent: *\nDisallow: /\nSitemap: '+SITE+'/sitemap-index.xml\n').encode(),'deployment.json':json.dumps({'target':'vps','sourceSha':SOURCE,'pipelineSha':SOURCE,'lockfileSha256':'c'*64,'configSha256':'d'*64}).encode()}
root=T/'site';(root/'records').mkdir(parents=True);old=root/'releases/old';old.mkdir(parents=True)
for n,b in data.items():
    p=old/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b+(b'-OLD' if n=='index.html' else b''))
os.symlink('releases/old',root/'current')
old_hashes={n:sha((old/n).read_bytes()) for n in data}
for p in [root,root/'records',root/'releases']:
    os.chown(p,u.pw_uid,u.pw_gid);p.chmod(0o755)
os.lchown(root/'current',u.pw_uid,u.pw_gid)
modules=T/'modules';modules.mkdir()
for name in ['receiver.py','release_bundle.py','source_authority.py','release_records.py']:
    shutil.copyfile(CODE/name,modules/name);(modules/name).chmod(0o644)
policy=T/'policy.json';policy.write_text(json.dumps({'enabled':True,'root':str(root),'site':SITE,'reviewedWorkflowSha':SOURCE,'sourceAuthority':'allowlist','approvedSourceShas':[SOURCE],'bootstrapSourceSha':SOURCE}));policy.chmod(0o644)
worker=T/'worker.py';worker.write_text('import os,json,sys\nsys.path.insert(0,'+repr(str(modules))+')\nimport receiver\nprint(json.dumps({"fixtureReceiverPid":os.getpid()}),flush=True)\nreceiver.main('+repr(str(policy))+')\n');worker.chmod(0o644)
for name in ['host','client']:cmd(['ssh-keygen','-q','-t','ed25519','-N','','-f',str(T/name)])
auth=T/'authorized';auth.write_text('restrict '+(T/'client.pub').read_text());auth.chmod(0o644)
config=T/'sshd.conf';config.write_text(f'''Port {sshport}
ListenAddress 127.0.0.1
HostKey {T/'host'}
PidFile {T/'sshd.pid'}
AuthorizedKeysFile {auth}
AllowUsers {USER}
PasswordAuthentication no
KbdInteractiveAuthentication no
UsePAM no
PermitRootLogin no
StrictModes yes
PermitTTY no
AllowTcpForwarding no
AllowAgentForwarding no
X11Forwarding no
ForceCommand /usr/bin/env SSL_CERT_FILE={T/'tls.crt'} /usr/bin/python3 -I -B {worker}
LogLevel VERBOSE
''')
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(root/'current'),**kw)
    def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',httpsport),Handler);context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);context.load_cert_chain(str(T/'tls.crt'),str(T/'tls.key'));server.socket=context.wrap_socket(server.socket,server_side=True);threading.Thread(target=server.serve_forever,daemon=True).start()
Path('/run/sshd').mkdir(exist_ok=True);sshd_log=(E/'receiver-disconnect-sshd.log').open('wb');daemon=subprocess.Popen(['/usr/sbin/sshd','-D','-e','-f',str(config)],stdout=sshd_log,stderr=sshd_log)
checks=[];case_results=[]
def line(p):
    assert select.select([p.stdout],[],[],10)[0],'receiver protocol timeout'
    raw=p.stdout.readline();assert raw,'receiver output closed unexpectedly';return json.loads(raw)
def case(mode,run):
    proxy=socket.socket();proxy.bind(('127.0.0.1',0));proxy.listen(1);proxyport=proxy.getsockname()[1]
    reset=threading.Event();closed=threading.Event();reset_sockets=[]
    def relay():
        sockets=[]
        try:
            client,_=proxy.accept();upstream=socket.create_connection(('127.0.0.1',sshport),timeout=3);sockets=[client,upstream]
            while not reset.is_set():
                ready,_,_=select.select(sockets,[],[],.05)
                for sock in ready:
                    data=sock.recv(65536)
                    if not data:return
                    (upstream if sock is client else client).sendall(data)
        except (ConnectionResetError,BrokenPipeError):pass
        finally:
            for sock in sockets:
                if reset.is_set():
                    sock.setsockopt(socket.SOL_SOCKET,socket.SO_LINGER,struct.pack('ii',1,0));assert struct.unpack('ii',sock.getsockopt(socket.SOL_SOCKET,socket.SO_LINGER,8))==(1,0);reset_sockets.append(True)
                sock.close()
            proxy.close();closed.set()
    threading.Thread(target=relay,daemon=True).start()
    pub=(T/'host.pub').read_text().split();known=T/('known-'+mode);known.write_text('[127.0.0.1]:'+str(proxyport)+' '+pub[0]+' '+pub[1]+'\n')
    ssh=subprocess.Popen(['ssh','-T','-p',str(proxyport),'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+str(known),'-o','IdentitiesOnly=yes','-o','ConnectTimeout=5','-i',str(T/'client'),USER+'@127.0.0.1','deploy-v1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        receiver_pid=line(ssh)['fixtureReceiverPid'];ready=line(ssh);assert ready['phase']=='READY_FOR_BUNDLE'
        rid='ci-'+SOURCE[:12]+'-'+str(run)+'-1'
        meta={'releaseId':rid,'site':SITE,'sourceSha':SOURCE,'workflowSha':SOURCE,'lockfileSha256':'c'*64,'vpsConfigSha256':'d'*64}
        manifest=[{'path':n,'bytes':len(b),'sha256':sha(b)} for n,b in sorted(data.items())]
        out=io.BytesIO()
        with zipfile.ZipFile(out,'w') as z:
            z.writestr('release.json',json.dumps(meta));z.writestr('manifest.json',json.dumps(manifest))
            for n,b in data.items():z.writestr('site/'+n,b)
        bundle=out.getvalue();load_bundle(bundle,sha(bundle),SITE,SOURCE)
        header=json.dumps({'expectedCurrent':'releases/old','archiveBytes':len(bundle),'archiveSha256':sha(bundle)}).encode();ssh.stdin.write(struct.pack('!I',len(header))+header+bundle);ssh.stdin.flush()
        pending=line(ssh);assert pending['phase']=='WAIT_PUBLIC_VERDICT' and os.readlink(root/'current')=='releases/'+rid
        if mode=='tcp-reset':
            reset.set();assert closed.wait(3) and len(reset_sockets)==2,'dual socket RST not proven'
        else:os.kill(receiver_pid,signal.SIGHUP)
        deadline=time.monotonic()+8
        while time.monotonic()<deadline and os.readlink(root/'current')!='releases/old':time.sleep(.05)
        actual=os.readlink(root/'current');stdout,stderr=ssh.communicate(timeout=5)
        result={'mode':mode,'sshExit':ssh.returncode,'stderr':stderr.decode('utf-8','replace'),'protocolTail':stdout.decode('utf-8','replace'),'current':actual,'rootReceiver':False,'receiverUid':u.pw_uid,'resetSockets':len(reset_sockets),'rollback':actual=='releases/old'}
        case_results.append(result);(E/('receiver-'+mode+'.json')).write_text(json.dumps(result,indent=2))
        assert actual=='releases/old','receiver did not rollback '+mode+': '+json.dumps(result)
        assert not (root/'records'/('deploy-'+rid+'.json')).exists(),'failed transaction recorded as committed'
        assert (root/'records'/('intent-'+rid+'.json')).is_file(),'intent evidence missing'
        assert all(sha((old/n).read_bytes())==h for n,h in old_hashes.items())
        assert (root/'releases'/rid).is_dir(),'failed release deleted'
        checks.append('real-nonroot-receiver-'+mode+'-restores-old-release-retains-intent-and-all-files')
    finally:
        reset.set()
        if ssh.poll() is None:ssh.kill();ssh.wait(timeout=3)
try:
    for i in range(100):
        assert daemon.poll() is None,'fixture sshd failed'
        try:
            with socket.create_connection(('127.0.0.1',sshport),timeout=.1):break
        except OSError:time.sleep(.05)
    case('tcp-reset',101);case('sighup',102)
    report={'state':'PASS','scope':'DISPOSABLE_REAL_NONROOT_RECEIVER_SSH_STRICT_TLS_SYNTHETIC_CONTENT','sourceSha':SOURCE,'checks':checks,'cases':case_results,'productionChanged':False,'realPublicSearchCovered':False,'realProductionPAMCovered':False}
    (E/'receiver-disconnect.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
finally:
    server.shutdown();server.server_close();daemon.terminate();daemon.wait(timeout=5);sshd_log.close()
