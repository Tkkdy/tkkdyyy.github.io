"""Explicit record provenance for CI releases and owner-imported manual baselines."""
import json,os,re,stat
from release_bundle import require,sha,site_origin

def read_record(root,rid):
    paths=[root/'records'/('deploy-'+rid+'.json'),root/'records'/('manual-'+rid+'.json')]
    existing=[p for p in paths if p.exists() or p.is_symlink()]
    require(len(existing)==1,'missing or ambiguous release provenance')
    p=existing[0];require(not p.is_symlink() and p.is_file(),'unsafe release record')
    bridge=root/'records'/('legacy-'+rid+'.json')
    if bridge.exists() or bridge.is_symlink():
        require(p.name.startswith('deploy-'),'legacy/manual provenance ambiguous')
        return read_legacy_bridge(root,rid,p)
    value=json.loads(p.read_text())
    if p.name.startswith('manual-'):
        require(value.get('recordType')=='OWNER_IMPORTED_MANUAL' and value.get('fullManifestVerified') is True and value.get('publicCriticalVerified') is True,'manual verification missing')
        require(value.get('ciAccepted') is False,'manual record cannot claim CI acceptance')
    return value


def root_bytes(path,limit=65536):
    """Read the same root-owned inode we inspect; no symlink/TOCTOU fallback."""
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    with os.fdopen(fd,'rb') as stream:
        info=os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid==0 and not info.st_mode&0o022,'root-owned nonwritable record required')
        require(info.st_size<=limit,'record too large')
        raw=stream.read(limit+1)
        require(len(raw)<=limit,'record too large')
        return raw

def validate_legacy(path,target,source,manifest_digest,record_digest):
    require(isinstance(record_digest,str) and re.fullmatch('[a-f0-9]{64}',record_digest),'exact legacy record hash required')
    raw=root_bytes(path);require(sha(raw)==record_digest,'legacy record hash differs')
    value=json.loads(raw)
    require(isinstance(value,dict) and 'sourceSha' not in value and 'site' not in value,'not an eligible legacy record')
    require(value.get('mainSha')==source and value.get('current')==target and value.get('releaseId')==target.removeprefix('releases/'),'legacy identity differs')
    require(value.get('manifestSha256')==manifest_digest,'legacy manifest differs')
    require(isinstance(value.get('archiveSha256'),str) and re.fullmatch('[a-f0-9]{64}',value['archiveSha256']),'legacy archive hash missing')
    return value

def read_legacy_bridge(root,rid,path):
    bridge=json.loads(root_bytes(root/'records'/('legacy-'+rid+'.json')))
    require(bridge.get('recordType')=='OWNER_VERIFIED_LEGACY' and bridge.get('ciAccepted') is False,'legacy provenance invalid')
    require(bridge.get('fullManifestVerified') is True and bridge.get('publicCriticalVerified') is True and bridge.get('applied') is True,'legacy verification missing')
    require(isinstance(bridge.get('sourceSha'),str) and re.fullmatch('[a-f0-9]{40}',bridge['sourceSha']),'legacy source invalid')
    require(bridge.get('current')=='releases/'+rid,'legacy target differs')
    require(site_origin(bridge.get('site',''))==bridge['site'],'legacy site invalid')
    legacy=validate_legacy(path,bridge['current'],bridge['sourceSha'],bridge['originalManifestSha256'],bridge['legacyRecordSha256'])
    require(legacy['archiveSha256']==bridge.get('archiveSha256'),'legacy archive differs')
    raw=root_bytes(root/'records'/('manifest-'+rid+'.json'),2_000_000)
    require(sha(raw)==bridge.get('manifestSha256'),'legacy saved manifest differs')
    return bridge
