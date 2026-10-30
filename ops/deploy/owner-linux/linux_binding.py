"""Root-side compact evidence checks; deployment policy/entrypoint unchanged."""
import hashlib,re
IMAGE='mcr.microsoft.com/playwright@sha256:d65108d1a8095d8b0c4a5e32bf1807a40a5ce90ff0c78473e1116b1c243235e8'
def validate(value,proposal,approval,guarded=None):
 def need(ok,msg):
  if not ok:raise RuntimeError('Linux evidence: '+msg)
 need(value.get('passed') is True and value.get('token')==proposal['token'] and value.get('scope')==proposal['scope'],'scope/token/verdict')
 need(value.get('gateSha256')==approval['externalGateSha256'] and value.get('candidateManifestSha256')==approval['candidateManifestSha256'],'candidate/tool')
 e=value.get('linuxEvidence',{});phase='guarded' if proposal['scope']=='OWNER_GUARDED_PUBLIC_ACCEPTANCE' else 'indexable'
 need(e.get('phase')==phase and e.get('challengeSha256')==hashlib.sha256(proposal['token'].encode()).hexdigest(),'challenge/phase')
 need(e.get('observerCodeCommit')==approval['observerCodeCommit'] and e.get('workflowSha256')==approval['observerWorkflowSha256'],'reviewed observer')
 need(type(e.get('runId')) is int and e['runId']>0 and e.get('runAttempt')==1,'run identity/rerun')
 need(e.get('url')=='https://github.com/Tkkdy/tkkdyyy.github.io/actions/runs/'+str(e['runId']),'run URL')
 for key,n in [('sourceSha',40),('artifactSha256',64),('reportSha256',64)]:need(re.fullmatch('[a-f0-9]{'+str(n)+'}',e.get(key,'')),'invalid '+key)
 need(re.fullmatch('owner-0007-'+phase+'-[a-f0-9]{24}',e.get('requestId','')),'request ID')
 r=e.get('runtime',{});expected={'node':'v24.19.0','openssl':'3.5.7','image':IMAGE,'browser':'156.0.8078.4','browserChannel':'chrome-for-testing','directFlagVerified':True,'runId':str(e['runId']),'runAttempt':'1','sourceSha':e['sourceSha']}
 need(all(r.get(k)==v for k,v in expected.items()),'runtime identity')
 need(value.get('newDomainNoindex')==(phase=='guarded') and value.get('indexable')==(phase=='indexable'),'indexing stage')
 for k in ['strictTls','canonical','searchAndClick','desktop','mobile','oldDomainNoindex','pagesIndependent','editorEntry','friends','fullManifest','searchAnd404Noindex']:need(value.get(k) is True,'missing '+k)
 if phase=='guarded':need(e.get('previousEvidence') is None,'unexpected previous evidence')
 else:need(guarded is not None and e.get('previousEvidence')=={'runId':guarded['runId'],'reportSha256':guarded['reportSha256']} and e['runId']!=guarded['runId'],'guarded chain')
 return e
