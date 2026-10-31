"""Read-only historical 0007 provenance. No publication, policy edits or privilege escalation."""
import json
from pathlib import Path
from release_bundle import release_target
from release_bundle import require,sha
NEW='https://tkkdy.me'
"""Root-side compact evidence checks; deployment policy/entrypoint unchanged."""
import hashlib,re
IMAGE='mcr.microsoft.com/playwright@sha256:d65108d1a8095d8b0c4a5e32bf1807a40a5ce90ff0c78473e1116b1c243235e8'
def validate_linux(value,proposal,approval,guarded=None):
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

def _owner(root,rid,value):
    from release_records import root_bytes,read_record
    from import_manual_release import verify_manifest
    """Historical owner identity is root-owned and tied to saved approval + derivation."""
    raw=root_bytes(root/'records'/('manual-'+rid+'.json'))
    require(json.loads(raw)==value,'owner record bytes differ')
    a_raw=root_bytes(root/'records'/('owner-approval-'+rid+'.json'))
    a=json.loads(a_raw)
    require(sha(a_raw)==value.get('approvalSha256') and a.get('enabled') is True,'owner approval invalid')
    require(value.get('recordType')=='OWNER_DERIVED_STATIC' and value.get('ciAccepted') is False,'owner provenance invalid')
    require(value.get('applied') is True and value.get('fullManifestVerified') is True and value.get('publicCriticalVerified') is True,'owner verification missing')
    require(value.get('current')==a.get('target')=='releases/'+rid and value.get('site')==NEW and value.get('indexingProfile')=='production','owner target/site differs')
    require(a.get('root')==str(root) and a.get('scope')=='ONE_OWNER_LIVE_DERIVED_PROMOTION','owner approval scope differs')
    require(value.get('manifestSha256')==a.get('candidateManifestSha256'),'owner manifest differs')
    require(value.get('baselineCurrent')==a.get('expectedCurrent') and value.get('sourceAttribution')=='DERIVED_FROM_OWNER_VERIFIED_LIVE_ARTIFACT','owner lineage missing')
    baseline=read_record(root,Path(release_target(a['expectedCurrent'])).name)
    require(baseline.get('recordType')=='OWNER_VERIFIED_LEGACY' and baseline['sourceSha']==value.get('sourceSha')==a.get('baselineSourceSha'),'owner baseline differs')
    require(sha(root_bytes(root/'records'/('legacy-'+Path(a['expectedCurrent']).name+'.json')))==a.get('baselineBridgeSha256'),'owner baseline bridge differs')
    require(sha(root_bytes(root/'records'/('manifest-'+rid+'.json'),2_000_000))==value['manifestSha256'],'owner saved manifest differs')
    require(sha(root_bytes(root/'records'/('derivation-'+rid+'.json'),2_000_000))==a.get('derivationSha256'),'owner derivation differs')
    verdict=value.get('publicAcceptance',{})
    require(verdict.get('passed') is True and verdict.get('scope')=='OWNER_GUARDED_PUBLIC_ACCEPTANCE' and verdict.get('candidateManifestSha256')==value['manifestSha256'],'owner public acceptance missing')
    require(verdict.get('gateSha256')==a.get('externalGateSha256') and all(verdict.get(k) is True for k in ['strictTls','canonical','searchAndClick','desktop','mobile','oldDomainNoindex','newDomainNoindex','pagesIndependent','editorEntry','friends']),'owner public evidence differs')
    require(a.get('attemptId')=='2026102900000007','unsupported owner attempt')
    require(rid=='owner-tkkdy-'+a['candidateManifestSha256'][:12]+'-'+a['attemptId'],'owner release ID differs')
    require(a.get('schema')==1 and a.get('site')==NEW and a.get('indexingProfile')=='production','owner approval profile differs')
    require(type(a.get('expiresEpoch')) is int and a['expiresEpoch']>0,'missing historical approval expiry')
    from datetime import datetime,timezone
    accepted=datetime.strptime(value['utc'],'%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc).timestamp()
    require(accepted<=a['expiresEpoch'],'owner approval expired at acceptance')
    derivation=json.loads(root_bytes(root/'records'/('derivation-'+rid+'.json'),2_000_000))
    require(derivation.get('candidateManifestSha256')==a['candidateManifestSha256'] and derivation.get('baselineManifestSha256')==a['baselineOriginalManifestSha256'],'owner derivation lineage differs')
    require(derivation.get('bodyBytesUnchanged') is True and derivation.get('assetsAndPagefindBytesUnchanged') is True and derivation.get('rssPayloadAndGuidsUnchanged') is True,'owner content preservation evidence missing')
    verify_manifest(root/a['target'],root_bytes(root/'records'/('manifest-'+rid+'.json'),2_000_000),a['candidateManifestSha256'])
    guard=validate_linux(verdict,{'scope':'OWNER_GUARDED_PUBLIC_ACCEPTANCE','token':verdict.get('token')},a)
    return a,guard

def validate_completion(value,approval,guarded):
    require(value.get('phase')=='COMPLETE' and value.get('status')=='PASS' and value.get('scope')=='ONE_OWNER_LIVE_DERIVED_PROMOTION','owner completion missing')
    require(value.get('launchId')=='owner-launch-linux-0007' and value.get('current')==approval['target'],'owner completion target differs')
    for key in ['indexingActivated','policyUnchanged','installedToolsUnchanged','otherNginxUnchanged','oldReleasesRetained']:
        require(value.get(key) is True,'incomplete owner final evidence: '+key)
    final=value.get('finalAcceptance',{})
    evidence=validate_linux(final,{'scope':'OWNER_INDEXABLE_PUBLIC_ACCEPTANCE','token':final.get('token')},approval,guarded)
    require(evidence['challengeSha256']!=guarded['challengeSha256'],'owner final challenge reused')
    return value

def validate_record(root,rid,value):
    from release_records import root_bytes
    approval,guarded=_owner(root,rid,value)
    final=json.loads(root_bytes(root/'records'/('owner-completion-'+rid+'.json'),65536))
    validate_completion(final,approval,guarded)
    return value
