"""Owner-approved one-shot Actions relay. No SSH or production mutations.
Raw owner tokens stay local; Git sees SHA256 challenges only. No retry or fallback.
"""
import argparse,hashlib,io,json,pathlib,secrets,subprocess,time,urllib.request,urllib.error,zipfile
REPO='Tkkdy/tkkdyyy.github.io'
BRANCH='codex/owner-linux-observer-0007'
MARKER='.github/owner-observation-run.json'
WORKFLOW='.github/workflows/owner-linux-observation.yml'
IMAGE='mcr.microsoft.com/playwright@sha256:d65108d1a8095d8b0c4a5e32bf1807a40a5ce90ff0c78473e1116b1c243235e8'
CANDIDATE='d3b094b33d246ebebce03a897ded8b5970545e3a0413f862cd796165a54d823d'
def sha(b):return hashlib.sha256(b).hexdigest()
def need(v,m):
 if not v:raise RuntimeError(m)
def validate(run,report,request,expected_sha,gate_sha):
 need(time.time()<request['expiresEpoch'],'Observation expired')
 need(run['head_sha']==expected_sha and run['head_branch']==BRANCH and run['event']=='push' and run['path']==WORKFLOW and run['run_attempt']==1 and run['conclusion']=='success' and run['status']=='completed','Untrusted or failed Actions run')
 need(run['repository']['full_name']==REPO,'Wrong repository')
 scope='OWNER_GUARDED_PUBLIC_ACCEPTANCE' if request['phase']=='guarded' else 'OWNER_INDEXABLE_PUBLIC_ACCEPTANCE'
 need(report.get('passed') is True and report.get('scope')==scope and report.get('requestId')==request['requestId'],'Report verdict/request differs')
 for key in ['phase','attemptId','challengeSha256','observerCodeCommit','previousEvidence']:
  need(report.get(key)==request[key],'Report binding differs: '+key)
 need(report.get('manifestSha256')==CANDIDATE and report.get('completeManifestFiles')==116 and report.get('completeManifestDomains')==2,'Full candidate identity missing')
 need(report.get('strictTls') is True and report.get('timeoutMs')==30000 and report.get('retries')==0 and report.get('transport')=='DIRECT','Transport checks weakened')
 runtime=report['runtime']
 expected={'node':'v24.19.0','openssl':'3.5.7','image':IMAGE,'browser':'156.0.8078.4','browserChannel':'chrome-for-testing','directFlagVerified':True,'runId':str(run['id']),'runAttempt':'1','sourceSha':expected_sha}
 for k,v in expected.items():need(runtime.get(k)==v,'Runtime drift: '+k)
 required=['entries-and-neighbour-sites','full-original-content-both-domains','sitemap-rss-robots-original-identity','desktop:tkkdy.me','desktop:preview.boenbot.top','mobile:tkkdy.me','mobile:preview.boenbot.top','utility-noindex-and-certificate']
 if request['phase']=='indexable':required.insert(3,'existing-browser-gate-new-production')
 need(len(report['steps'])==len(required) and {x['name'] for x in report['steps']}==set(required) and all(x['status']=='PASS' for x in report['steps']),'Missing or failed steps')
 need(report.get('newDomainNoindex')==(request['phase']=='guarded') and report.get('indexable')==(request['phase']=='indexable'),'Indexing phase differs')
 for k in ['canonical','searchAndClick','desktop','mobile','oldDomainNoindex','pagesIndependent','editorEntry','friends','fullManifest','searchAnd404Noindex']:
  need(report.get(k) is True,'Missing acceptance: '+k)
 need(report.get('certificate') and all(x.get('completed') is True and not x.get('error') for x in report.get('requests',[])) and len(report.get('requests',[]))>=241,'Missing complete requests/certificate')
 return {'scope':scope,'candidateManifestSha256':CANDIDATE,'gateSha256':gate_sha,'passed':True,'strictTls':True,**{k:report[k] for k in ['canonical','searchAndClick','desktop','mobile','oldDomainNoindex','newDomainNoindex','pagesIndependent','editorEntry','friends','fullManifest','indexable','searchAnd404Noindex','certificate']}}
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args):return None
class Api:
 def __init__(self):
  c=dict(x.split('=',1) for x in subprocess.check_output(['git','credential','fill'],input=b'protocol=https\nhost=github.com\n\n').decode().splitlines() if '=' in x);self.token=c['password']
 def get(self,path,binary=False):
  req=urllib.request.Request('https://api.github.com/repos/'+REPO+'/'+path,headers={'Authorization':'Bearer '+self.token,'Accept':'application/vnd.github+json','User-Agent':'Owner-readonly-Linux-observer'})
  try:
   with urllib.request.build_opener(NoRedirect).open(req,timeout=20) as r:body=r.read()
  except urllib.error.HTTPError as e:
   if e.code!=302:raise
   with urllib.request.urlopen(e.headers['Location'],timeout=30) as r:body=r.read()
  return body if binary else json.loads(body)
def git(*args):return subprocess.check_output(['git',*args],text=True).strip()
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--review',required=True);ap.add_argument('--review-sha256',required=True);ap.add_argument('--proposal',required=True);ap.add_argument('--out',required=True);ap.add_argument('--previous-evidence');ap.add_argument('--owner-approved',action='store_true');a=ap.parse_args()
 need(a.owner_approved,'Requires owner launch confirmation; preparation is not authorization')
 raw=pathlib.Path(a.review).read_bytes();need(sha(raw)==a.review_sha256,'Review digest differs');review=json.loads(raw)
 need(git('branch','--show-current')==BRANCH and not git('status','--porcelain'),'Wrong/dirty observer worktree')
 need(git('rev-parse','HEAD')==review['expectedHead'],'Observer branch moved unexpectedly')
 proposal=json.loads(pathlib.Path(a.proposal).read_bytes());phase={'OWNER_GUARDED_PUBLIC_ACCEPTANCE':'guarded','OWNER_INDEXABLE_PUBLIC_ACCEPTANCE':'indexable'}.get(proposal.get('scope'))
 need(phase and len(proposal.get('token',''))==48 and all(c in '0123456789abcdef' for c in proposal['token']),'Invalid live proposal')
 need(proposal.get('candidateManifestSha256')==CANDIDATE,'Proposal candidate mismatch')
 if phase=='guarded':need(proposal.get('target')==review['target'] and proposal.get('externalGateSha256')==review['gateSha256'],'Guarded identity mismatch')
 previous=json.loads(pathlib.Path(a.previous_evidence).read_bytes()) if a.previous_evidence else None
 need((phase=='guarded' and previous is None) or (phase=='indexable' and previous and previous['scope']=='OWNER_GUARDED_PUBLIC_ACCEPTANCE' and previous['passed'] is True),'Missing guarded chain')
 request={'enabled':True,'scope':'OWNER_LINUX_OBSERVATION','attemptId':'2026102900000007','phase':phase,'challengeSha256':sha(proposal['token'].encode()),'requestId':'owner-0007-'+phase+'-'+secrets.token_hex(12),'candidateManifestSha256':CANDIDATE,'observerCodeCommit':review['observerCodeCommit'],'expiresEpoch':int(time.time())+720,'expectedNode':'24.19.0','expectedPlaywright':'1.64.1','expectedChrome':'156.0.8078.4','previousEvidence':({'runId':previous['linuxEvidence']['runId'],'reportSha256':previous['linuxEvidence']['reportSha256']} if previous else None)}
 out=pathlib.Path(a.out);need(not out.exists(),'Output exists; never rerun');out.mkdir(parents=True)
 verdict={'scope':proposal['scope'],'token':proposal['token'],'candidateManifestSha256':CANDIDATE,'gateSha256':review['gateSha256'],'passed':False}
 try:
  pathlib.Path(MARKER).write_text(json.dumps(request,indent=2)+'\n',encoding='utf-8',newline='\n');subprocess.run(['git','add','--',MARKER],check=True)
  need(git('diff','--cached','--name-only')==MARKER,'Unexpected staged files');subprocess.run(['git','commit','-m','ci: observe owner 0007 '+phase+' once'],check=True);source=git('rev-parse','HEAD')
  need(git('diff','--name-only',review['observerCodeCommit'],'HEAD')==MARKER,'Observer code drift')
  subprocess.run(['git','push','origin',BRANCH],check=True)
  api=Api();deadline=time.monotonic()+600;run=None
  while time.monotonic()<deadline:
   runs=api.get('actions/runs?branch='+BRANCH+'&head_sha='+source+'&per_page=10')['workflow_runs'];matching=[r for r in runs if r['path']==WORKFLOW and r['head_sha']==source]
   need(len(matching)<=1,'Ambiguous observer run')
   if matching:
    run=matching[0];need(run['run_attempt']==1,'Workflow rerun forbidden')
    if run['status']=='completed':break
   time.sleep(5)
  need(run is not None and run['status']=='completed','Observer deadline; stop and rollback')
  (out/'run.json').write_text(json.dumps(run,indent=2),encoding='utf-8')
  artifacts=api.get('actions/runs/'+str(run['id'])+'/artifacts')['artifacts'];name='owner-linux-'+str(run['id'])+'-1';items=[x for x in artifacts if x['name']==name and not x['expired']];need(len(items)==1,'Missing/ambiguous evidence artifact')
  archive=api.get('actions/artifacts/'+str(items[0]['id'])+'/zip',True);(out/'evidence.zip').write_bytes(archive)
  with zipfile.ZipFile(io.BytesIO(archive)) as z:
   need(z.namelist().count('report.json')==1,'Missing/duplicate report');report_raw=z.read('report.json')
  (out/'report.json').write_bytes(report_raw);report=json.loads(report_raw)
  verdict['observationFailure']=report.get('failure')
  verdict.update(validate(run,report,request,source,review['gateSha256']))
  verdict['linuxEvidence']={'runId':run['id'],'runAttempt':1,'sourceSha':source,'observerCodeCommit':review['observerCodeCommit'],'requestId':request['requestId'],'challengeSha256':request['challengeSha256'],'phase':phase,'workflowSha256':review['workflowSha256'],'artifactSha256':sha(archive),'reportSha256':sha(report_raw),'previousEvidence':request['previousEvidence'],'url':run['html_url'],'runtime':report['runtime']}
  review['expectedHead']=source;(out/'next-review.json').write_text(json.dumps(review,indent=2),encoding='utf-8')
 except Exception as e:verdict.update(passed=False,error=str(e))
 (out/'verdict.json').write_text(json.dumps(verdict,indent=2),encoding='utf-8');print(json.dumps({'passed':verdict['passed'],'run':verdict.get('linuxEvidence',{}).get('url'),'error':verdict.get('error')}))
 raise SystemExit(0 if verdict['passed'] else 1)
if __name__=='__main__':main()
