"""Disposable GitHub Linux integration; never run on an actual server."""
import os,sys,json,secrets,tempfile,pathlib,subprocess,shutil,ssl,http.server,threading,socket,struct,time,zipfile,io
P=pathlib.Path
if sys.platform!='linux' or os.environ.get('GITHUB_ACTIONS')!='true' or os.environ.get('ISOLATED_RECEIVER_TEST')!='true':raise SystemExit('Only disposable GitHub Linux CI is allowed')
CODE=P(__file__).resolve().parent;REPO=CODE.parent.parent;sys.path.insert(0,str(CODE))
from release_bundle import sha,load_bundle
USER='site-receiver-test';SOURCE=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip();PUBLIC='https://preview.boenbot.top'
E=REPO/'integration-evidence';E.mkdir(exist_ok=False)
T=P('/var/lib')/('dual-site-integration-'+secrets.token_hex(8));subprocess.run(['sudo','-n','install','-d','-o',str(os.getuid()),'-g',str(os.getgid()),'-m','755',str(T)],check=True);DEPLOY=T/'deploy';DEPLOY.mkdir();(DEPLOY/'records').mkdir();(DEPLOY/'releases').mkdir()
def cmd(*a,**kw):return subprocess.run(list(a),check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,**kw)
def root(*a):return cmd('sudo','-n',*a)
def port():
 s=socket.socket();s.bind(('127.0.0.1',0));p=s.getsockname()[1];s.close();return p
HTTPS=port();SSH=port();SITE='https://127.0.0.1:'+str(HTTPS)
root('useradd','--create-home','--shell','/bin/sh',USER);root('usermod','--password','*',USER)
cmd('openssl','req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',str(T/'ca.key'),'-out',str(T/'ca.crt'),'-subj','/CN=Disposable Integration CA')
cmd('openssl','req','-newkey','rsa:2048','-nodes','-keyout',str(T/'tls.key'),'-out',str(T/'tls.csr'),'-subj','/CN=127.0.0.1')
(T/'tls.ext').write_text('subjectAltName=IP:127.0.0.1\nextendedKeyUsage=serverAuth\n')
cmd('openssl','x509','-req','-in',str(T/'tls.csr'),'-CA',str(T/'ca.crt'),'-CAkey',str(T/'ca.key'),'-CAcreateserial','-out',str(T/'tls.crt'),'-days','1','-extfile',str(T/'tls.ext'))
nss=P.home()/'.pki/nssdb';nss.mkdir(parents=True,exist_ok=True)
if not (nss/'cert9.db').exists():cmd('certutil','-N','--empty-password','-d','sql:'+str(nss))
cmd('certutil','-A','-d','sql:'+str(nss),'-n','disposable-dual-site-ca','-t','C,,','-i',str(T/'ca.crt'))
for name in ['ca.crt','tls.crt']:(T/name).chmod(0o644)
raw_data={p.relative_to(REPO/'dist').as_posix():p.read_bytes() for p in (REPO/'dist').rglob('*') if p.is_file()}
data={n:(b.replace(PUBLIC.encode(),SITE.encode()) if P(n).suffix in ['.html','.xml','.txt','.json'] else b) for n,b in raw_data.items()}
old=DEPLOY/'releases/old';old.mkdir()
for n,b in data.items():
 p=old/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b+(b'<!--old-->\n' if n=='index.html' else b''))
os.symlink('releases/old',DEPLOY/'current');original={n:sha((old/n).read_bytes()) for n in data}
modules=T/'receiver';modules.mkdir()
for n in ['receiver.py','release_bundle.py','source_authority.py']:shutil.copy2(CODE/n,modules/n)
policy=T/'policy.json';policy.write_text(json.dumps({'enabled':True,'root':str(DEPLOY),'site':SITE,'reviewedWorkflowSha':SOURCE,'sourceAuthority':'allowlist','approvedSourceShas':[SOURCE]}))
worker=T/'worker.py';worker.write_text('import sys\nsys.path.insert(0,'+repr(str(modules))+')\nimport receiver\nreceiver.main('+repr(str(policy))+')\n')
cmd('ssh-keygen','-q','-t','ed25519','-N','','-f',str(T/'host-key'));cmd('ssh-keygen','-q','-t','ed25519','-N','','-f',str(T/'client-key'))
auth=T/'authorized';auth.write_text('restrict '+(T/'client-key.pub').read_text());auth.chmod(0o644)
config=T/'sshd.conf';config.write_text(f'''Port {SSH}
ListenAddress 127.0.0.1
HostKey {T/'host-key'}
PidFile {T/'sshd.pid'}
AuthorizedKeysFile {auth}
AllowUsers {USER}
PasswordAuthentication no
KbdInteractiveAuthentication no
UsePAM no
PermitRootLogin no
StrictModes yes
AllowTcpForwarding no
AllowAgentForwarding no
X11Forwarding no
PermitTTY no
ForceCommand /usr/bin/env SSL_CERT_FILE={T/'ca.crt'} /usr/bin/python3 -I {worker}
LogLevel VERBOSE
''')
parts=(T/'host-key.pub').read_text().split();known=T/'known_hosts';known.write_text(f'[127.0.0.1]:{SSH} '+parts[0]+' '+parts[1]+'\n')
root('chown','-R',USER+':'+USER,str(DEPLOY));root('mkdir','-p','/run/sshd')
# The test UID cannot change policy, forced command, authorization or executable modules.
root('chown','root:root',str(T),str(auth),str(policy),str(worker),str(config),str(modules),*[str(p) for p in modules.iterdir()])
log=(E/'sshd.log').open('wb');daemon=subprocess.Popen(['sudo','-n','/usr/sbin/sshd','-D','-e','-f',str(config)],stdout=log,stderr=log)
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(DEPLOY/'current'),**kw)
 def log_message(self,*a):pass
 def list_directory(self,path):self.send_error(404);return None
 def send_error(self,code,message=None,explain=None):
  body=(DEPLOY/'current/404.html').read_bytes();self.send_response(code);self.send_header('Content-Type','text/html');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
server=http.server.ThreadingHTTPServer(('127.0.0.1',HTTPS),Handler);tls=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);tls.load_cert_chain(str(T/'tls.crt'),str(T/'tls.key'));server.socket=tls.wrap_socket(server.socket,server_side=True);threading.Thread(target=server.serve_forever,daemon=True).start()
def bundle(run):
 meta={'releaseId':f'ci-{SOURCE[:12]}-{run}-1','site':SITE,'sourceSha':SOURCE,'workflowSha':SOURCE,'lockfileSha256':sha((REPO/'package-lock.json').read_bytes()),'vpsConfigSha256':sha((REPO/'astro.config.vps.mjs').read_bytes())}
 manifest=[{'path':n,'bytes':len(b),'sha256':sha(b)} for n,b in sorted(data.items())];out=io.BytesIO()
 with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED) as z:
  z.writestr('release.json',json.dumps(meta));z.writestr('manifest.json',json.dumps(manifest))
  for n,b in sorted(data.items()):z.writestr('site/'+n,b)
 raw=out.getvalue();load_bundle(raw,sha(raw),SITE,SOURCE);return raw,meta
SSH_CMD=['ssh','-T','-p',str(SSH),'-o','BatchMode=yes','-o','ConnectTimeout=5','-o','ConnectionAttempts=1','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+str(known),'-o','IdentitiesOnly=yes','-i',str(T/'client-key'),USER+'@127.0.0.1','deploy-v1']
def begin(run,bad_hash=False):
 p=subprocess.Popen(SSH_CMD,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 first=p.stdout.readline();assert first,p.stderr.read().decode();ready=json.loads(first);assert ready['phase']=='READY_FOR_BUNDLE',ready
 raw,meta=bundle(run);header=json.dumps({'expectedCurrent':ready['current'],'archiveBytes':len(raw),'archiveSha256':'0'*64 if bad_hash else sha(raw)}).encode();p.stdin.write(struct.pack('!I',len(header))+header+raw);p.stdin.flush();return p,meta
def save(name,p,verdict=None):
 stdout,stderr=p.communicate(input=verdict,timeout=60);(E/(name+'.log')).write_bytes(stdout+b'\nSTDERR\n'+stderr);return stdout.decode()
checks=[]
try:
 for _ in range(100):
  if daemon.poll() is not None:raise RuntimeError('sshd startup failed')
  try:
   with socket.create_connection(('127.0.0.1',SSH),timeout=.2):break
  except OSError:time.sleep(.05)
 else:raise RuntimeError('sshd did not become ready')
 env=os.environ.copy();env.update(SITE_URL=SITE,REVIEWED_WORKFLOW_SHA=SOURCE,VPS_SSH_HOST='127.0.0.1',VPS_SSH_USER=USER,VPS_SSH_PORT=str(SSH),VPS_KEY_FILE=str(T/'client-key'),VPS_KNOWN_HOSTS_FILE=str(known),SSL_CERT_FILE=str(T/'ca.crt'),CURL_CA_BUNDLE=str(T/'ca.crt'))
 raw,meta=bundle(100);(E/'bundle.zip').write_bytes(raw);(E/'bundle.zip.sha256').write_text(sha(raw))
 client=subprocess.run([sys.executable,str(CODE/'publish_client.py')],cwd=E,env=env,capture_output=True,timeout=400);(E/'client.log').write_bytes(client.stdout+b'\nSTDERR\n'+client.stderr);assert client.returncode==0,client.stderr.decode()+client.stdout.decode()
 current='releases/'+meta['releaseId'];assert os.readlink(DEPLOY/'current')==current;checks.append('actual-client-trusted-TLS-full-manifest-browser-commit')
 for run,mode in [(101,'public-failure'),(102,'client-EOF')]:
  p,m=begin(run);ready=json.loads(p.stdout.readline());assert ready['phase']=='WAIT_PUBLIC_VERDICT',ready
  body=(json.dumps({'token':ready['token'],'passed':False})+'\n').encode() if mode=='public-failure' else b''
  result=save(mode,p,body);assert 'ROLLED_BACK' in result and os.readlink(DEPLOY/'current')==current;checks.append(mode+'-real-rollback')
 p,m=begin(103,True);result=save('bad-hash',p);assert p.returncode!=0 and os.readlink(DEPLOY/'current')==current;checks.append('bad-hash-rejected-before-switch')
 p,m=begin(104);ready=json.loads(p.stdout.readline());assert ready['phase']=='WAIT_PUBLIC_VERDICT'
 q=subprocess.run(SSH_CMD,input=b'',capture_output=True,timeout=15);assert q.returncode!=0 and b'READY_FOR_BUNDLE' not in q.stdout;checks.append('actual-exclusive-flock')
 save('lock-holder-rollback',p,(json.dumps({'token':ready['token'],'passed':False})+'\n').encode());assert os.readlink(DEPLOY/'current')==current
 p,m=begin(100);result=save('duplicate-release',p);assert p.returncode!=0 and os.readlink(DEPLOY/'current')==current;checks.append('existing-release-not-overwritten')
 for n,digest in original.items():assert sha((old/n).read_bytes())==digest
 assert len(list((DEPLOY/'releases').iterdir()))==5;checks.append('all-old-and-failed-releases-retained')
 for path in [policy,worker,auth,modules/'receiver.py']:assert subprocess.run(['sudo','-n','-u',USER,'test','-w',str(path)]).returncode!=0
 checks.append('test-UID-cannot-write-policy-executable-or-authorized-keys')
 root('truncate','-s','0',str(auth));revoked=subprocess.run(SSH_CMD,input=b'',capture_output=True,timeout=15);assert revoked.returncode==255;assert os.readlink(DEPLOY/'current')==current;checks.append('revoked-ephemeral-key-refused')
 report={'state':'PASS','scope':'DISPOSABLE_GITHUB_LINUX_REAL_SSH_TLS_FILESYSTEM','sourceSha':SOURCE,'checks':checks,'productionVpsChanged':False,'publicSiteChanged':False,'syntheticDomain':SITE,'realBrowser':True,'productionACLValidated':False}
 (E/'summary.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
except BaseException:
 print((E/'sshd.log').read_text(errors='replace'),flush=True)
 raise
finally:
 server.shutdown();server.server_close();daemon.terminate();log.close()
