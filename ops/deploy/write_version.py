"""Write public, nonsecret build identity; generated artifacts remain ignored by Git."""
import argparse,hashlib,json,pathlib,re,subprocess

from indexing_profile import indexing_profile

def write(source,dist,target,workflow,profile='preview'):
 source=pathlib.Path(source).resolve();dist=pathlib.Path(dist).resolve()
 if subprocess.check_output(['git','status','--porcelain'],cwd=source,text=True).strip():raise ValueError('Dirty checkout cannot claim exact source SHA')
 sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip()
 if target not in ['pages','vps'] or not re.fullmatch('[a-f0-9]{40}',workflow):raise ValueError('Invalid build identity')
 if not dist.is_dir() or dist.is_symlink():raise ValueError('Invalid dist')
 profile=indexing_profile(profile)
 if target=='vps':
  marker=json.loads((dist/'vps-build.json').read_text())
  if marker.get('indexingProfile')!=profile:raise ValueError('Build profile differs from trusted identity writer')
 elif profile!='preview':raise ValueError('VPS production profile cannot be used for Pages')
 config=source/('astro.config.vps.mjs' if target=='vps' else 'astro.config.mjs')
 record={'schema':1,'sourceSha':sha,'target':target,'pipelineSha':workflow,'configSha256':hashlib.sha256(config.read_bytes()).hexdigest(),'lockfileSha256':hashlib.sha256((source/'package-lock.json').read_bytes()).hexdigest()}
 if target=='vps':record['indexingProfile']=profile
 with (dist/'deployment.json').open('x',encoding='utf-8') as f:json.dump(record,f,sort_keys=True)
 return record
if __name__=='__main__':
 p=argparse.ArgumentParser()
 for x in ['source','dist','target','workflow']:p.add_argument('--'+x,required=True)
 p.add_argument('--profile',default='preview',choices=['preview','production'])
 print(json.dumps(write(**vars(p.parse_args()))))
