"""Independent read-only health/version samples. One request per URL, no retry."""
import argparse,json,urllib.request,urllib.error,datetime

def sample(site):
 result={'site':site,'health':'UNKNOWN','version':'UNKNOWN'}
 opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
 try:
  with opener.open(site.rstrip('/')+'/',timeout=20) as response:result['health']='PASS' if response.status==200 else 'FAIL'
 except Exception as error:result['health']='FAIL';result['healthError']=str(error)
 try:
  with opener.open(site.rstrip('/')+'/deployment.json',timeout=20) as response:
   raw=response.read(8193)
   if len(raw)>8192:raise ValueError('Oversized identity')
   identity=json.loads(raw);result['identity']=identity;result['version']=identity['sourceSha']
 except Exception as error:result['versionError']=str(error)
 return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--pages',required=True);p.add_argument('--vps',required=True);p.add_argument('--expected-sha');p.add_argument('--output',required=True);a=p.parse_args()
 targets={k:sample(getattr(a,k)) for k in ['pages','vps']}
 for key,item in targets.items():item['deployment']='VERIFIED' if a.expected_sha and item['health']=='PASS' and item['version']==a.expected_sha and item.get('identity',{}).get('target')==key else 'NOT_VERIFIED'
 report={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'READ_ONLY_SAMPLE','expectedSha':a.expected_sha,'sameVersion':all(v['version']!='UNKNOWN' for v in targets.values()) and targets['pages']['version']==targets['vps']['version'],'targets':targets}
 with open(a.output,'x',encoding='utf-8') as f:json.dump(report,f,indent=2)
 print(json.dumps(report))
