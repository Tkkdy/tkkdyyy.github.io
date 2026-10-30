"""Owner-operated rollback proposal. Dry run by default; never exposed by deploy SSH key."""
import argparse,fcntl,json,os,stat,sys,time,secrets
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from release_bundle import require,release_target,sha
from receiver import atomic_link,https_body,exclusive
from release_records import read_record
from indexing_profile import indexing_profile

def rollback(policy,expected,target,apply=False):
 p=Path(policy);require(not p.is_symlink() and p.stat().st_uid==0 and not p.stat().st_mode&0o022,'root-owned policy required')
 config=json.loads(p.read_text());root=Path(config['root']);require(root.is_absolute() and root.resolve()==root,'unsafe root')
 expected=release_target(expected);target=release_target(target);require(expected!=target,'target already current')
 fd=os.open(root/'records'/'.ci.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'w'):
  fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB);require(os.readlink(root/'current')==expected,'current drift')
  candidate=root/target;require(candidate.is_dir() and candidate.resolve()==candidate,'unsafe target release')
  rid=Path(target).name;record_path=root/'records'/('deploy-'+rid+'.json');manifest_path=root/'records'/('manifest-'+rid+'.json')
  require(not record_path.is_symlink() and not manifest_path.is_symlink(),'linked record')
  record=read_record(root,rid);raw=manifest_path.read_bytes();require(sha(raw)==record['manifestSha256'],'manifest identity differs')
  from import_manual_release import verify_manifest
  manifest,files=verify_manifest(candidate,raw,record['manifestSha256'])
  require(record['current']==target and record['site']==config['site'],'rollback identity differs')
  require(indexing_profile(record.get('indexingProfile','preview'))==indexing_profile(config.get('indexingProfile','preview')),'rollback indexing profile differs')
  result={'scope':'OWNER_OPERATED','expected':expected,'target':target,'sourceSha':record['sourceSha'],'recordType':record.get('recordType','CI_ACCEPTED'),'filesVerified':len(files),'applied':False}
  if not apply:return result
  old_hash=sha((root/expected/'index.html').read_bytes())
  try:
   atomic_link(root,target,expected)
   critical=['index.html',next(n for n in files if n.endswith('.css')),next(n for n in files if n.endswith('.js'))]
   for name in critical:require(sha(https_body(config['site'],name))==sha(files[name]),'rollback HTTPS verification failed')
   result.update(applied=True,serverHttpsVerified=True,allReleasesRetained=True)
   exclusive(root/'records'/('rollback-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+secrets.token_hex(6)+'.json'),json.dumps(result,sort_keys=True).encode())
  except BaseException:
   if os.readlink(root/'current')==target:
    atomic_link(root,expected,target);require(sha(https_body(config['site'],'index.html'))==old_hash,'restore after rollback failure failed')
   raise
  return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--policy',default='/etc/preview-deploy/policy.json');p.add_argument('--expected-current',required=True);p.add_argument('--target',required=True);p.add_argument('--apply',action='store_true');a=p.parse_args();print(json.dumps(rollback(a.policy,a.expected_current,a.target,a.apply)))
