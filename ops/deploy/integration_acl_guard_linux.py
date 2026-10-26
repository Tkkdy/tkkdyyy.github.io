"""Real root/ACL/process-session evidence in disposable GitHub Ubuntu only."""
import hashlib,json,os,pwd,signal,subprocess,sys,tempfile,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import acl_guard as guard
assert sys.platform=='linux' and os.getuid()==0 and os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('ACL_GUARD_FIXTURE')=='true'
CODE=Path(__file__).resolve().parent
account='acl-guard-fixture'
subprocess.run(['/usr/sbin/useradd','--system','--user-group','--no-create-home','--shell','/usr/sbin/nologin',account],check=True)
uid=pwd.getpwnam(account).pw_uid
checks=[]
BASES=[]


def fixture():
    base=Path(tempfile.mkdtemp(prefix='acl-guard-ci-',dir='/var/lib'));base.chmod(0o755);BASES.append(base)
    site=base/'site'
    for p in [site,site/'releases',site/'records']:
        p.mkdir();p.chmod(0o755);os.chown(p,1001,1001)
    (site/'releases/old.txt').write_bytes(b'old-release-retained')
    os.symlink('releases',site/'current')
    return base


def events(state):
    try:return [json.loads(l) for l in (state/'journal.jsonl').read_text().splitlines()]
    except FileNotFoundError:return []


def wait(state,phase,timeout=12):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        if any(e['phase']==phase for e in events(state)):return
        time.sleep(.05)
    raise AssertionError('missing '+phase+' '+str(events(state)))


def start(base,state,ttl=4,hold=False):
    # Launcher occupies its own simulated SSH/PTY session. Guardian detaches again.
    args=[sys.executable,'-I','-B',str(CODE/'acl_guard.py'),'launch',str(base),str(state),str(uid),str(ttl)]
    if hold:
        code='import subprocess,sys,time;subprocess.run(sys.argv[1:],check=True);time.sleep(30)'
        args=[sys.executable,'-I','-c',code,*args]
    p=subprocess.Popen(args,start_new_session=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    reply=json.loads(p.stdout.readline());return p,reply['guardianPid']


def unchanged(base,state):
    for path in [base/'site',base/'site/releases',base/'site/records']:
        assert guard.entries(guard.acl(path))==guard.BASIC
        assert subprocess.run(['/usr/sbin/runuser','-u',account,'--','/usr/bin/test','-w',str(path)]).returncode==1
    assert (base/'site/releases/old.txt').read_bytes()==b'old-release-retained'
    assert os.readlink(base/'site/current')=='releases'
    assert (state/'original-acls.txt').stat().st_uid==0 and (state/'original-acls.txt').stat().st_mode&0o777==0o600

# Session/PTY death must leave the independent guardian alive and rollback on time.
base=fixture();state=base/'lease-disconnect';parent,pid=start(base,state,ttl=4,hold=True);wait(state,'GRANTED')
assert os.getsid(pid)!=os.getsid(parent.pid)
os.killpg(parent.pid,signal.SIGHUP);parent.wait(timeout=3)
os.kill(pid,0);wait(state,'ROLLED_BACK');unchanged(base,state)
checks.append('real-invoking-session-SIGHUP-does-not-kill-guardian-exact-ACL-restore')

# A success acknowledgement bound to this lease is the only path retaining ACLs.
base=fixture();state=base/'lease-commit';parent,pid=start(base,state);wait(state,'GRANTED')
lease=json.loads((state/'lease.json').read_bytes());guard.exclusive(state/'verdict.json',json.dumps({'nonce':lease['nonce'],'passed':True}).encode());wait(state,'COMMITTED');parent.wait(timeout=3)
assert all('user:'+str(uid)+':rwx' in guard.entries(guard.acl(p)) for p in [base/'site',base/'site/releases',base/'site/records'])
subprocess.run(['/usr/bin/setfacl','--restore='+str(state/'original-acls.txt')],check=True);unchanged(base,state)
checks.append('exact-success-verdict-commits-only-this-lease-and-fixture-ACL-cleanup-retains-evidence')

for label,verdict in [('negative',lambda n:{'nonce':n,'passed':False}),('wrong-nonce',lambda n:{'nonce':'0'*64,'passed':True}),('nonboolean',lambda n:{'nonce':n,'passed':1})]:
    base=fixture();state=base/('lease-'+label);parent,pid=start(base,state);wait(state,'GRANTED');nonce=json.loads((state/'lease.json').read_bytes())['nonce'];guard.exclusive(state/'verdict.json',json.dumps(verdict(nonce)).encode());wait(state,'ROLLED_BACK');unchanged(base,state);parent.wait(timeout=3)
    checks.append(label+'-verdict-restores-real-ACL')

base=fixture();state=base/'lease-signal';parent,pid=start(base,state);wait(state,'GRANTED');os.kill(pid,signal.SIGTERM);wait(state,'ROLLED_BACK');unchanged(base,state);parent.wait(timeout=3)
checks.append('guardian-SIGTERM-restores-real-ACL-with-persistent-journal')

base=fixture();state=base/'lease-linked-verdict';parent,pid=start(base,state);wait(state,'GRANTED');os.symlink(state/'lease.json',state/'verdict.json');wait(state,'ROLLED_BACK');unchanged(base,state);parent.wait(timeout=3)
checks.append('symlink-verdict-rejected-and-real-ACL-restored')

base=fixture();state=base/'lease-lock';parent,pid=start(base,state);wait(state,'GRANTED')
other=subprocess.run([sys.executable,'-I','-B',str(CODE/'acl_guard.py'),'supervise',str(base),str(base/'lease-concurrent'),str(uid),'4'],capture_output=True,timeout=3)
assert other.returncode!=0 and not (base/'lease-concurrent').exists();wait(state,'ROLLED_BACK');unchanged(base,state);parent.wait(timeout=3)
checks.append('concurrent-root-transaction-refused-without-new-state-or-ACL-mutation')

base=fixture();state=base/'lease-unknown';subprocess.run(['/usr/bin/setfacl','-m','u:33:r-x',str(base/'site')],check=True);before=guard.acl(base/'site')
p=subprocess.run([sys.executable,'-I','-B',str(CODE/'acl_guard.py'),'supervise',str(base),str(state),str(uid),'3'],capture_output=True,timeout=3)
assert p.returncode!=0 and not state.exists() and guard.acl(base/'site')==before
checks.append('unreviewed-existing-ACL-refused-before-mutation')


# One real OpenSSH session via a loopback-only resettable TCP path. No real host.
import select,socket,struct,threading,shlex
base=fixture();state=base/'lease-ssh-reset'
transport=base/'ssh-fixture';transport.mkdir(mode=0o700)
for name in ['host','client']:
    subprocess.run(['ssh-keygen','-q','-t','ed25519','-N','','-f',str(transport/name)],check=True)
auth=transport/'authorized';auth.write_text('restrict '+(transport/'client.pub').read_text());auth.chmod(0o600)
def freeport():
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));return sock.getsockname()[1]
serverport=freeport()
proxy=socket.socket();proxy.bind(('127.0.0.1',0));proxy.listen(1);proxyport=proxy.getsockname()[1]
worker=transport/'worker.py';worker.write_text('import sys,time\nsys.path.insert(0,'+repr(str(CODE))+')\nimport acl_guard\nfrom pathlib import Path\nacl_guard.launch(Path('+repr(str(base))+'),Path('+repr(str(state))+'),'+str(uid)+',6)\ntime.sleep(30)\n')
conf=transport/'sshd.conf'
conf.write_text(f'''Port {serverport}
ListenAddress 127.0.0.1
HostKey {transport/'host'}
PidFile {transport/'sshd.pid'}
AuthorizedKeysFile {auth}
AllowUsers root
PermitRootLogin prohibit-password
PasswordAuthentication no
KbdInteractiveAuthentication no
UsePAM no
StrictModes yes
AllowTcpForwarding no
AllowAgentForwarding no
X11Forwarding no
PermitTTY no
ForceCommand /usr/bin/env GITHUB_ACTIONS=true ACL_GUARD_FIXTURE=true /usr/bin/python3 -I -B {worker}
LogLevel VERBOSE
''')
key=(transport/'host.pub').read_text().split();known=transport/'known_hosts';known.write_text('[127.0.0.1]:'+str(proxyport)+' '+key[0]+' '+key[1]+'\n')
Path('/run/sshd').mkdir(exist_ok=True)
log=(transport/'sshd.log').open('wb');daemon=subprocess.Popen(['/usr/sbin/sshd','-D','-e','-f',str(conf)],stdout=log,stderr=log)
reset=threading.Event();closed=threading.Event();proxy_errors=[];reset_sockets=[]
def relay():
    sockets=[]
    try:
        client,_=proxy.accept();backend=socket.create_connection(('127.0.0.1',serverport),timeout=3);sockets=[client,backend]
        while not reset.is_set():
            ready,_,_=select.select(sockets,[],[],.05)
            for sock in ready:
                data=sock.recv(65536)
                if not data:return
                (backend if sock is client else client).sendall(data)
    except BaseException as error:proxy_errors.append(str(error))
    finally:
        for sock in sockets:
            if reset.is_set():
                sock.setsockopt(socket.SOL_SOCKET,socket.SO_LINGER,struct.pack('ii',1,0))
                assert struct.unpack('ii',sock.getsockopt(socket.SOL_SOCKET,socket.SO_LINGER,8))==(1,0)
                reset_sockets.append(True)
            sock.close()
        proxy.close();closed.set()
try:
    for i in range(100):
        assert daemon.poll() is None,'fixture sshd exited'
        try:
            with socket.create_connection(('127.0.0.1',serverport),timeout=.1):break
        except OSError:time.sleep(.05)
    else:raise AssertionError('fixture sshd startup timeout')
    threading.Thread(target=relay,daemon=True).start()
    ssh=subprocess.Popen(['ssh','-T','-p',str(proxyport),'-o','BatchMode=yes','-o','ConnectionAttempts=1','-o','ConnectTimeout=5','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+str(known),'-o','IdentitiesOnly=yes','-i',str(transport/'client'),'root@127.0.0.1','ignored-by-fixed-fixture-command'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    assert select.select([ssh.stdout],[],[],10)[0],'SSH launcher did not respond'
    line=ssh.stdout.readline()
    assert line,'SSH root fixture denied: '+ssh.stderr.read()
    guardian_pid=json.loads(line)['guardianPid'];wait(state,'GRANTED')
    reset.set();assert closed.wait(3),'TCP reset relay did not close'
    stdout,stderr=ssh.communicate(timeout=6)
    assert ssh.returncode==255 and not proxy_errors and len(reset_sockets)==2,(ssh.returncode,stderr,proxy_errors,reset_sockets)
    os.kill(guardian_pid,0);wait(state,'ROLLED_BACK');unchanged(base,state)
    # OpenSSH can report EPIPE when writing after the injected RST. The gate is
    # both sockets' checked SO_LINGER(1,0), SSH exit255 and exact real ACL recovery.
    assert any(message in stderr.lower() for message in ['reset','closed','broken pipe']),stderr
    checks.append('real-OpenSSH-TCP-reset-detached-root-guardian-survives-and-restores-exact-ACL')
    (transport/'client-result.json').write_text(json.dumps({'sshExit':ssh.returncode,'stderr':stderr,'tcpReset':True,'resetSockets':len(reset_sockets),'guardianSurvived':True,'realPAMSessionCovered':False}))
finally:
    reset.set();daemon.terminate();daemon.wait(timeout=5);log.close()

output={'state':'PASS','scope':'DISPOSABLE_REAL_ROOT_ACL_PROCESS_SESSIONS','sourceSha':os.environ.get('GITHUB_SHA'),'checks':checks,'productionInstalled':False,'productionACLChanged':False,'realSSHTransportTested':True,'realTCPResetTested':True,'realPAMSessionCovered':False,'realSessionSIGHUPTested':True,'powerLossOrGuardianSIGKILLCovered':False,'allFixtureEvidenceRetained':True}
E=CODE.parent.parent/'integration-evidence';E.mkdir(exist_ok=True);
for i,base in enumerate(BASES):
    for state in base.glob('lease-*'):
        if not state.is_dir():continue
        for name in ['journal.jsonl','original-acls.txt']:
            source=state/name
            if source.is_file():(E/(str(i)+'-'+state.name+'-'+name)).write_bytes(source.read_bytes())
    source=base/'ssh-fixture/client-result.json'
    if source.exists():(E/'ssh-tcp-reset-client.json').write_bytes(source.read_bytes())
(E/'acl-guard.json').write_text(json.dumps(output,indent=2));print(json.dumps(output))
