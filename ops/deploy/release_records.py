"""Explicit record provenance for CI releases and owner-imported manual baselines."""
import json
from release_bundle import require

def read_record(root,rid):
    paths=[root/'records'/('deploy-'+rid+'.json'),root/'records'/('manual-'+rid+'.json')]
    existing=[p for p in paths if p.exists() or p.is_symlink()]
    require(len(existing)==1,'missing or ambiguous release provenance')
    p=existing[0];require(not p.is_symlink() and p.is_file(),'unsafe release record')
    value=json.loads(p.read_text())
    if p.name.startswith('manual-'):
        require(value.get('recordType')=='OWNER_IMPORTED_MANUAL' and value.get('fullManifestVerified') is True and value.get('publicCriticalVerified') is True,'manual verification missing')
        require(value.get('ciAccepted') is False,'manual record cannot claim CI acceptance')
    return value
