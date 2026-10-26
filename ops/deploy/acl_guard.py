"""Candidate ACL lease guardian. CLI restricted to disposable GitHub Linux fixtures.

Not installed in production. Deliberately has no production CLI or installer.
A detached session and root-owned fsynced journal survive the invoking SSH/PTY.
Power loss, guardian SIGKILL and host shutdown still require owner recovery.
"""
import argparse,fcntl,hashlib,json,os,pwd,secrets,signal,stat,subprocess,sys,time
from pathlib import Path


def require(value,message):
    if not value:raise ValueError(message)


def exclusive(path,data):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
    syncdir(path.parent)


def syncdir(path):
    fd=os.open(path,os.O_RDONLY|os.O_DIRECTORY)
    try:os.fsync(fd)
    finally:os.close(fd)


def journal(state,phase,**data):
    # stdout and the original PTY are never a prerequisite for recovery.
    fd=os.open(state/'journal.jsonl',os.O_WRONLY|os.O_APPEND|os.O_CREAT|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'ab') as f:
        f.write((json.dumps({'phase':phase,'utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),**data},sort_keys=True)+'\n').encode());f.flush();os.fsync(f.fileno())
    syncdir(state)


def acl(path):
    return subprocess.check_output(['/usr/bin/getfacl','-n','-p',str(path)],text=True,timeout=10)


def entries(text):return {s for s in text.splitlines() if s and not s.startswith('#')}
BASIC={'user::rwx','group::r-x','other::r-x'}


def safe_read(path,limit):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    with os.fdopen(fd,'rb') as f:
        s=os.fstat(f.fileno())
        require(stat.S_ISREG(s.st_mode) and s.st_uid==0 and stat.S_IMODE(s.st_mode)==0o600,'unsafe verdict/plan file')
        value=f.read(limit+1);require(len(value)<=limit,'oversized file');return value


def valid_verdict(obj,nonce):
    return type(obj) is dict and set(obj)=={'nonce','passed'} and obj['nonce']==nonce and type(obj['passed']) is bool and obj['passed']


def stop_signal(number,frame):raise InterruptedError('guardian signal '+str(number))


def fixture_gate(base):
    require(sys.platform=='linux' and os.getuid()==0 and os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('ACL_GUARD_FIXTURE')=='true','disposable root CI only; production CLI unavailable')
    require(base.parent==Path('/var/lib') and base.name.startswith('acl-guard-ci-'),'fixture root outside approved test parent')
    require(base.resolve()==base,'linked fixture root')
    for path in [base,*base.parents]:
        s=path.stat();require(s.st_uid==0 and not s.st_mode&0o022,'unprotected ancestor')


def guard(base,state,uid,ttl):
    fixture_gate(base)
    require(state.parent==base and state.name.startswith('lease-') and state.resolve()==state,'invalid transaction path')
    require(type(uid) is int and uid not in (0,33,1001) and pwd.getpwuid(uid).pw_uid==uid,'invalid grant UID')
    require(1<=ttl<=30,'fixture lease must be bounded')
    lock=os.open(base/'guard.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
    try:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        # Only one three-directory transaction per fixture root. No caller command.
        paths=[base/'site',base/'site/releases',base/'site/records']
        before={}
        for path in paths:
            s=path.lstat();require(path.resolve()==path and stat.S_ISDIR(s.st_mode) and s.st_uid==s.st_gid==1001 and stat.S_IMODE(s.st_mode)==0o755,'site identity/mode drift')
            value=acl(path);require(entries(value)==BASIC,'unknown existing ACL');before[str(path)]=value
        state.mkdir(mode=0o700)
        backup=''.join(before.values()).encode();exclusive(state/'original-acls.txt',backup)
        nonce=secrets.token_hex(32);plan={'nonce':nonce,'uid':uid,'paths':[str(p) for p in paths],'originalAclSha256':hashlib.sha256(backup).hexdigest(),'ttlSeconds':ttl}
        exclusive(state/'lease.json',json.dumps(plan).encode())
        # Arm BEFORE any grant. Deadline includes the entire grant/check interval.
        deadline=time.monotonic()+ttl
        journal(state,'ARMED',guardianPid=os.getpid(),sessionId=os.getsid(0),**{k:v for k,v in plan.items() if k!='nonce'})
        touched=False;committed=False
        for number in [signal.SIGHUP,signal.SIGTERM,signal.SIGINT]:signal.signal(number,stop_signal)
        try:
            touched=True
            for path in paths:subprocess.run(['/usr/bin/setfacl','-m','u:'+str(uid)+':rwx',str(path)],check=True,timeout=10)
            for path in paths:require(entries(acl(path))==BASIC|{'user:'+str(uid)+':rwx','mask::rwx'},'grant readback differs')
            journal(state,'GRANTED')
            while True:
                require(time.monotonic()<deadline,'public verdict deadline expired')
                verdict=state/'verdict.json'
                if verdict.exists() or verdict.is_symlink():
                    obj=json.loads(safe_read(verdict,1024))
                    require(valid_verdict(obj,nonce),'public verdict rejected')
                    require(time.monotonic()<deadline,'verdict arrived after deadline')
                    for path in paths:require(entries(acl(path))==BASIC|{'user:'+str(uid)+':rwx','mask::rwx'},'ACL drift before commit')
                    journal(state,'COMMITTED');committed=True;return
                time.sleep(0.05)
        except BaseException as error:
            # A second termination signal must not interrupt the bounded restore.
            for number in [signal.SIGHUP,signal.SIGTERM,signal.SIGINT]:signal.signal(number,signal.SIG_IGN)
            if touched and not committed:
                try:
                    require(hashlib.sha256(safe_read(state/'original-acls.txt',16384)).hexdigest()==plan['originalAclSha256'],'ACL backup drift')
                    subprocess.run(['/usr/bin/setfacl','--restore='+str(state/'original-acls.txt')],check=True,timeout=10)
                    for path in paths:require(acl(path)==before[str(path)],'exact ACL restore differs')
                except BaseException as rollback_error:
                    journal(state,'ROLLBACK_FAILED',reason=str(error),rollbackError=str(rollback_error));raise
                journal(state,'ROLLED_BACK',reason=str(error),exactRestore=True)
            raise
    finally:os.close(lock)


def launch(base,state,uid,ttl):
    fixture_gate(base)
    # Detached before any root ACL mutation. No output pipe to the caller remains.
    child=subprocess.Popen([sys.executable,'-I','-B',str(Path(__file__).resolve()),'supervise',str(base),str(state),str(uid),str(ttl)],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True,close_fds=True)
    print(json.dumps({'guardianPid':child.pid}),flush=True)


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('operation',choices=['launch','supervise']);p.add_argument('base',type=Path);p.add_argument('state',type=Path);p.add_argument('uid',type=int);p.add_argument('ttl',type=int);a=p.parse_args()
    (launch if a.operation=='launch' else guard)(a.base,a.state,a.uid,a.ttl)
if __name__=='__main__':main()
