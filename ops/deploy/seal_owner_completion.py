"""Owner-only one-time sealing of existing 0007 final evidence. Dry run by default.
No lineage rewrite, permission expansion, current switch, network or deployment.
"""
import argparse,json,os,fcntl,re
from pathlib import Path
from release_bundle import require,sha
from release_records import root_bytes
from owner_records import _owner,validate_completion

def seal(root,result_path,result_sha256,record_sha256,reader_gid,apply=False):
    require(os.geteuid()==0,'completion seal requires root owner')
    root=Path(root);require(root.is_absolute() and root.resolve()==root,'unsafe root')
    require(type(reader_gid) is int and reader_gid>0,'dedicated reader gid required')
    target=os.readlink(root/'current')
    require(re.fullmatch('releases/owner-tkkdy-[a-f0-9]{12}-2026102900000007',target),'unsupported owner current')
    rid=Path(target).name
    record=root/'records'/('manual-'+rid+'.json');output=root/'records'/('owner-completion-'+rid+'.json')
    require(not output.exists() and not output.is_symlink(),'completion must never be overwritten')
    fd=os.open(root/'records/.ci.lock',os.O_RDWR|os.O_NOFOLLOW)
    with os.fdopen(fd,'w'):
        fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        require(os.readlink(root/'current')==target,'owner baseline no longer current')
        raw=root_bytes(record);require(sha(raw)==record_sha256,'exact owner record pin differs')
        approval,guarded=_owner(root,rid,json.loads(raw))
        final=root_bytes(Path(result_path));require(sha(final)==result_sha256,'exact completion pin differs')
        validate_completion(json.loads(final),approval,guarded)
        result={'scope':'SEAL_EXISTING_0007_COMPLETION_ONLY','recordSha256':record_sha256,'completionSha256':sha(final),'output':str(output),'ownerUid':0,'readerGid':reader_gid,'mode':'0640','applied':False}
        if apply:
            fd=os.open(output,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o640)
            with os.fdopen(fd,'wb') as stream:
                os.fchown(stream.fileno(),0,reader_gid);os.fchmod(stream.fileno(),0o640);stream.write(final);stream.flush();os.fsync(stream.fileno())
            directory=os.open(root/'records',os.O_DIRECTORY)
            try:os.fsync(directory)
            finally:os.close(directory)
            result['applied']=True
        return result

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for key in ['root','result-path','result-sha256','record-sha256']:p.add_argument('--'+key,required=True)
    p.add_argument('--reader-gid',type=int,required=True);p.add_argument('--apply',action='store_true')
    a=vars(p.parse_args());print(json.dumps(seal(a.pop('root'),a.pop('result_path'),a.pop('result_sha256'),a.pop('record_sha256'),**a)))
