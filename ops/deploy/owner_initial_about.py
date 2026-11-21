"""Owner-only policy update for the initial tkkdy.me release. Defaults to inspection."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import tempfile
import urllib.request

OLD = 'd369df7888d491a7c2bbec0179293f79fe7d8c50'
NEW = '8ee403305f4ed58a97edcba1120c366bb15cfe4c'
DIGESTS = {OLD: '477ecded9aa855dd4d28a77a7b48e388bfbb1f351a3f916237ef4e516102e05f',
           NEW: '9e59d944f72fa9c3aaffb190a88f448c69be097bf69f4bd0dd2d850fc2be5b14'}
MODULE = Path('/usr/local/lib/preview-deploy/release_bundle.py')
POLICY = Path('/etc/preview-deploy/policy.json')
BACKUP = Path('/var/backups/tkkdy-about-policy-8ee4033')

def check(ok, message):
    if not ok:
        raise SystemExit(message)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def protected(path):
    check(path.resolve(strict=True) == path, 'Unexpected symbolic link: '+str(path))
    info = path.stat()
    check(info.st_uid == 0 and not info.st_mode & 0o022, 'Unsafe ownership or mode: '+str(path))

def replace(path, data):
    fd, name = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as handle:
            handle.write(data)
            os.fsync(handle.fileno())
        info = path.stat()
        os.chown(name, info.st_uid, info.st_gid)
        shutil.copystat(path, name)
        os.utime(name, None)
        os.replace(name, path)
        fd = os.open(path.parent, os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    finally:
        Path(name).unlink(missing_ok=True)

def main():
    p = argparse.ArgumentParser(description=__doc__)
    mode = p.add_mutually_exclusive_group()
    mode.add_argument('--apply', action='store_true')
    mode.add_argument('--rollback', action='store_true')
    args = p.parse_args()
    for path in (MODULE.parent, MODULE, POLICY.parent, POLICY):
        protected(path)
    policy = json.loads(POLICY.read_bytes())
    check(policy['site'].rstrip('/') == 'https://tkkdy.me' and policy['repository'] == 'Tkkdy/tkkdyyy.github.io'
          and policy['enabled'] and policy['sourceAuthority'] == 'github-main', 'Unexpected site policy')
    check(policy['reviewedWorkflowSha'] in DIGESTS, 'Unexpected pipeline SHA')
    check(digest(MODULE.read_bytes()) in DIGESTS.values(), 'Unexpected installed module digest')
    print('Current pipeline:', policy['reviewedWorkflowSha'], 'module:', digest(MODULE.read_bytes()))
    if not (args.apply or args.rollback):
        return
    check(os.geteuid() == 0, 'Owner sudo required')
    root = Path(policy['root'])
    check(root.is_absolute() and root.resolve(strict=True) == root, 'Unexpected release root')
    lock = os.open(root/'records'/'.ci.lock', os.O_RDWR | os.O_NOFOLLOW)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        current = POLICY.read_bytes()
        check(json.loads(current) == policy, 'Policy drift; rerun inspection')
        module = MODULE.read_bytes()
        check(digest(module) in DIGESTS.values(), 'Module drift')
        target = OLD if args.rollback else NEW
        if digest(module) == DIGESTS[target] and policy['reviewedWorkflowSha'] == target:
            print('Already applied:', target)
            return
        protected(BACKUP.parent)
        if not BACKUP.exists():
            check(not args.rollback and digest(module) == DIGESTS[OLD] and policy['reviewedWorkflowSha'] == OLD, 'Missing original backup')
            temp = Path(tempfile.mkdtemp(dir=BACKUP.parent))
            try:
                (temp/'module').write_bytes(module)
                (temp/'policy').write_bytes(current)
                temp.rename(BACKUP)
            finally:
                if temp.exists():
                    shutil.rmtree(temp)
        protected(BACKUP)
        for name in ['module','policy']:
            protected(BACKUP/name)
        original = (BACKUP/'module').read_bytes()
        original_policy = (BACKUP/'policy').read_bytes()
        check(digest(original) == DIGESTS[OLD], 'Backup digest mismatch')
        expected = {**policy, 'reviewedWorkflowSha': OLD}
        check(json.loads(original_policy) == expected, 'Original policy differs beyond the approved pin')
        if args.rollback:
            data, config = original, original_policy
        else:
            url = 'https://raw.githubusercontent.com/Tkkdy/tkkdyyy.github.io/'+NEW+'/ops/deploy/release_bundle.py'
            with urllib.request.urlopen(url, timeout=25) as response:
                data = response.read(100_000)
            check(digest(data) == DIGESTS[NEW], 'New module digest mismatch')
            compile(data, str(MODULE), 'exec')
            config = json.dumps({**policy, 'reviewedWorkflowSha': NEW}, indent=2, sort_keys=True).encode()+b'\n'
        try:
            replace(MODULE, data)
            replace(POLICY, config)
        except BaseException:
            replace(MODULE, module)
            replace(POLICY, current)
            raise
        check(digest(MODULE.read_bytes()) == DIGESTS[target] and json.loads(POLICY.read_bytes())['reviewedWorkflowSha'] == target, 'Readback failed')
        print('Verified site receiver pin:', target)
    finally:
        os.close(lock)

if __name__ == '__main__':
    main()
