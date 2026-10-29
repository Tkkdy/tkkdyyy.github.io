"""Prepare an owner-review candidate from a verified live artifact, never a CI release.
No SSH, deployment, policy edit, or current switch. Output must be a new directory.
"""
import argparse,hashlib,json,re,xml.etree.ElementTree as ET
from pathlib import Path
from release_bundle import validate_site,safe_name,require

def sha(raw):return hashlib.sha256(raw).hexdigest()
def prepare(live,manifest_file,manifest_sha256,output):
 live=Path(live).resolve();output=Path(output).absolute();raw=Path(manifest_file).read_bytes()
 require(sha(raw)==manifest_sha256,'baseline manifest hash differs')
 require(not output.exists() and not output.is_symlink(),'output must not exist')
 require(output!=live and live not in output.parents,'output cannot be inside baseline')
 manifest=json.loads(raw);files={}
 require(isinstance(manifest,list) and 0<len(manifest)<=5000,'invalid baseline manifest')
 for item in manifest:
  n=safe_name(item['path']);require(n not in files,'duplicate baseline path');p=live/n
  require(p.resolve()==p and p.is_file() and not p.is_symlink(),'unsafe baseline file')
  body=p.read_bytes();require(len(body)==item['bytes'] and sha(body)==item['sha256'],'baseline file differs');files[n]=body
 require(all(not p.is_symlink() for p in live.rglob('*')),'linked baseline')
 require(set(files)=={p.relative_to(live).as_posix() for p in live.rglob('*') if p.is_file()},'unlisted baseline file')
 require('deployment.json' not in files and 'vps-build.json' not in files,'this tool only handles the reviewed legacy baseline without modern identity')
 old='https://preview.boenbot.top';new='https://tkkdy.me';validate_site(files,old,'preview');candidate=dict(files)
 for n,body in files.items():
  if n.endswith('.html'):
   parts=body.split(b'</head>');require(len(parts)==2,'ambiguous head '+n);head,tail=parts
   head=head.replace(old.encode(),new.encode())
   if n not in ['404.html','search/index.html']:
    head,count=re.subn(rb'<meta\s+name="robots"\s+content="noindex"\s*/?>',b'',head);require(count==1,'unexpected robots markup '+n)
   candidate[n]=head+b'</head>'+tail
  elif n in ['robots.txt','sitemap-index.xml','sitemap-0.xml']:candidate[n]=body.replace(old.encode(),new.encode())
  elif n=='rss.xml':
   candidate[n]=re.sub(rb'<link>(.*?)</link>',lambda m:b'<link>'+m[1].replace(old.encode(),new.encode())+b'</link>',body)
 candidate['vps-build.json']=json.dumps({'schema':1,'site':new,'indexingProfile':'production'},sort_keys=True).encode()
 stats=validate_site(candidate,new,'production')
 oldrss=ET.fromstring(files['rss.xml']);newrss=ET.fromstring(candidate['rss.xml'])
 require([x.text for x in oldrss.iter('guid')]==[x.text for x in newrss.iter('guid')],'RSS GUID drift')
 for a,b in zip(oldrss.iter('item'),newrss.iter('item')):
  for field in ['title','description','pubDate','guid']:require(ET.tostring(a.find(field))==ET.tostring(b.find(field)),'RSS payload drift')
 frozen=[{'path':n,'bytes':len(body),'sha256':sha(body)} for n,body in sorted(candidate.items())];saved=json.dumps(frozen,sort_keys=True).encode()
 report={'scope':'LIVE_ARTIFACT_DERIVED_CANDIDATE_NOT_CI_RELEASE','releaseApproved':False,'sourceAttribution':'EXACT_LIVE_ARTIFACT_MANIFEST_NOT_MAIN_BUILD','baselineManifestSha256':manifest_sha256,'candidateManifestSha256':sha(saved),'validation':stats,'bodyBytesUnchanged':True,'assetsAndPagefindBytesUnchanged':True,'rssPayloadAndGuidsUnchanged':True,'addedRoutes':[],'removedRoutes':[],'changes':[{'path':n,'before':sha(files[n]) if n in files else None,'after':sha(body)} for n,body in sorted(candidate.items()) if files.get(n)!=body]}
 output.mkdir(parents=True)
 for n,body in candidate.items():
  p=output/'site'/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(body)
 (output/'manifest.json').write_bytes(saved);(output/'derivation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
 return report
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__)
 for name in ['live','manifest','manifest-sha256','output']:p.add_argument('--'+name,required=True)
 a=p.parse_args();print(json.dumps(prepare(a.live,a.manifest,a.manifest_sha256,a.output)))
