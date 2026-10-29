"""Explicit owner bridge + copied-live rollback rehearsal. Never changes live current."""
import sys
sys.dont_write_bytecode=True
import os,json,hashlib,shutil,time,threading,urllib.request,http.server,stat
from pathlib import Path
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE/'tools'))
from import_manual_release import import_manual,verify_manifest
from release_records import read_record
from rollback_release import rollback
from receiver import atomic_link
ROOT=Path('/srv/www/preview.boenbot.top')
TARGET='releases/preview-main-88ac30aa-f4f1c891-20261024T035620Z'
RID=Path(TARGET).name
SOURCE='88ac30aa31d4c806e6af9a71b955db2f0dd16967'
MANIFEST='bdbd0dff0af30ac2b7c3631f22b3228ef501a0f5dcfe6203ed4055c3a5ebd6a0'
RECORD='072089625d5efbe781ee3467bd4ef10de9590ccea71d2c33c0765f1732deeb51'
POLICY=Path('/etc/preview-deploy/policy.json')
POLICY_SHA='4d08942872df7b95454d389453c41b7b3b7399720272049dc556cf5d50461bbc'
def sha(b):return hashlib.sha256(b).hexdigest()
def check(ok,msg):
 if not ok:raise ValueError(msg)
def filemap(path):
 result={}
 for p in sorted(path.rglob('*')):
  if p.is_symlink():result[str(p.relative_to(path))]='link:'+os.readlink(p)
  elif p.is_file():result[str(p.relative_to(path))]=sha(p.read_bytes())
 return result
def protected():
 return {'current':os.readlink(ROOT/'current'),'files':filemap(ROOT/TARGET),'releaseNames':sorted(p.name for p in (ROOT/'releases').iterdir()),'nginx':filemap(Path('/etc/nginx')),'policy':sha(POLICY.read_bytes()),'installedTools':filemap(Path('/usr/local/lib/preview-deploy')),'legacyRecord':sha((ROOT/'records'/('deploy-'+RID+'.json')).read_bytes())}
check(os.geteuid()==0,'root owner session required')
check(HERE.stat().st_uid==0 and not HERE.stat().st_mode&0o022,'unsafe tools directory')
check(os.readlink(ROOT/'current')==TARGET,'current drift')
check(sha(POLICY.read_bytes())==POLICY_SHA,'policy drift')
config=json.loads(POLICY.read_bytes());check(config['enabled'] is False and config['bootstrapSourceSha']==SOURCE,'policy identity changed')
check(sha((ROOT/'records'/('deploy-'+RID+'.json')).read_bytes())==RECORD,'legacy record drift')
for p in [ROOT/'records'/('legacy-'+RID+'.json'),ROOT/'records'/('manifest-'+RID+'.json')]:check(not p.exists() and not p.is_symlink(),'bridge already/partially exists; stop and inspect')
raw=(HERE/'original-manifest.json').read_bytes();check(sha(raw)==MANIFEST,'input manifest differs')
manifest,files=verify_manifest(ROOT/TARGET,raw,MANIFEST)
before=protected()
backup=Path('/var/backups')/('tkkdy-legacy-bridge-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+os.urandom(3).hex());backup.mkdir(mode=0o700)
(backup/'protected-before.json').write_text(json.dumps(before,sort_keys=True));shutil.copy2(POLICY,backup/'preview-policy.snapshot.json');shutil.copy2(ROOT/'records'/('deploy-'+RID+'.json'),backup/'original-record.json');(backup/'original-manifest.json').write_bytes(raw)
result={'scope':'OWNER_BRIDGE_AND_COPIED_LIVE_REHEARSAL','backup':str(backup),'liveCurrentSwitched':False,'livePolicyChanged':False,'status':'FAIL'}
try:
 print('PHASE COPIED_LIVE_REHEARSAL',flush=True)
 fixture=backup/'rehearsal';(fixture/'records').mkdir(parents=True);(fixture/'records/.ci.lock').touch()
 old=fixture/TARGET;old.parent.mkdir();shutil.copytree(ROOT/TARGET,old)
 future='releases/rehearsal-future';shutil.copytree(ROOT/TARGET,fixture/future)
 (fixture/future/'index.html').write_bytes(files['index.html']+b'<!-- rehearsal only -->')
 shutil.copy2(ROOT/'records'/('deploy-'+RID+'.json'),fixture/'records'/('deploy-'+RID+'.json'))
 (fixture/'current').symlink_to(TARGET)
 fp=fixture/'preview-policy.json';fp.write_text(json.dumps({**config,'root':str(fixture)}))
 # Import uses unmodified strict public HTTPS against the real old host.
 fixture_import=import_manual(fp,TARGET,SOURCE,HERE/'original-manifest.json',MANIFEST,True,RECORD)
 atomic_link(fixture,future,TARGET)
 dry=rollback(fp,future,TARGET,False);check(not dry['applied'] and os.readlink(fixture/'current')==future,'dry-run mutated current')
 pp=fixture/'production-policy.json';pp.write_text(json.dumps({**config,'root':str(fixture),'site':'https://tkkdy.me','indexingProfile':'production'}))
 try:rollback(pp,future,TARGET,False)
 except ValueError as e:check('identity differs' in str(e),'unexpected policy rejection')
 else:raise ValueError('wrong-site policy accepted')
 state={'corrupt':False}
 class Handler(http.server.BaseHTTPRequestHandler):
  def log_message(self,*args):pass
  def do_GET(self):
   from urllib.parse import unquote
   name=unquote(self.path).lstrip('/');check(name in files,'unexpected rehearsal HTTP path')
   current=os.readlink(fixture/'current');body=(fixture/current/name).read_bytes()
   if state['corrupt'] and current==TARGET:body=b'rehearsal intentional mismatch'
   self.send_response(200);self.end_headers();self.wfile.write(body)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
 def loopback(site,name):
  from urllib.parse import quote
  with urllib.request.build_opener(urllib.request.ProxyHandler({})).open('http://127.0.0.1:'+str(server.server_port)+'/'+quote(name),timeout=10) as r:return r.read()
 # Transport-only substitution is restricted to fixture rollback, never production import.
 with patch('rollback_release.https_body',side_effect=loopback):
  applied=rollback(fp,future,TARGET,True);check(applied['applied'] and os.readlink(fixture/'current')==TARGET,'fixture rollback apply failed')
  atomic_link(fixture,future,TARGET);state['corrupt']=True
  try:rollback(fp,future,TARGET,True)
  except ValueError as e:check('HTTPS verification failed' in str(e),'unexpected failure')
  else:raise ValueError('corrupt transport accepted')
  check(os.readlink(fixture/'current')==future,'failure did not restore fixture current')
 server.shutdown();server.server_close()
 result['rehearsal']={'fullLiveFilesVerified':len(files),'dryRun':dry,'wrongSitePolicyRejected':True,'atomicApplyInFixture':True,'postcheckFailureRestoredFixture':True,'transport':'REAL_LOOPBACK_HTTP_NOT_PUBLIC_HTTPS','publicHttpsImportChecks':True}
 check(protected()==before,'protected production drift before import')
 print('PHASE LIVE_BRIDGE_DRY_RUN',flush=True)
 result['bridgeDryRun']=import_manual(POLICY,TARGET,SOURCE,HERE/'original-manifest.json',MANIFEST,False,RECORD)
 print('PHASE LIVE_BRIDGE_APPLY_RECORDS_ONLY',flush=True)
 result['bridge']=import_manual(POLICY,TARGET,SOURCE,HERE/'original-manifest.json',MANIFEST,True,RECORD)
 record=read_record(ROOT,RID);saved=(ROOT/'records'/('manifest-'+RID+'.json')).read_bytes();verify_manifest(ROOT/TARGET,saved,record['manifestSha256'])
 check(record['recordType']=='OWNER_VERIFIED_LEGACY' and record['ciAccepted'] is False,'bridge provenance invalid')
 check(protected()==before,'protected production drift')
 result.update(status='PASS',productionUnchanged=True,bridgeRecordVerified=True,originalRecordRetained=True)
except BaseException as e:
 result['error']=type(e).__name__+': '+str(e)
 raise
finally:
 result['protectedUnchanged']=protected()==before
 path=backup/'result.json';path.write_text(json.dumps(result,indent=2));os.chmod(path,0o644)
 public=Path('/var/tmp')/(backup.name+'-result.json');fd=os.open(public,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o644)
 with os.fdopen(fd,'w') as f:json.dump(result,f,indent=2)
 print('RESULT '+str(public),flush=True);print(json.dumps(result),flush=True)
