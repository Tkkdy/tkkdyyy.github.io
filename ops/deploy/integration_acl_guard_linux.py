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


def fixture():
    base=Path(tempfile.mkdtemp(prefix='acl-guard-ci-',dir='/var/lib'));base.chmod(0o755)
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

output={'state':'PASS','scope':'DISPOSABLE_REAL_ROOT_ACL_PROCESS_SESSIONS','sourceSha':os.environ.get('GITHUB_SHA'),'checks':checks,'productionInstalled':False,'productionACLChanged':False,'realSSHTransportTested':False,'realSessionSIGHUPTested':True,'powerLossOrGuardianSIGKILLCovered':False,'allFixtureEvidenceRetained':True}
E=CODE.parent.parent/'integration-evidence';E.mkdir(exist_ok=True);(E/'acl-guard.json').write_text(json.dumps(output,indent=2));print(json.dumps(output))
