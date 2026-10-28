"""Candidate-only forced command. Never opens a production write path or current link."""
import functools
import http.server
import json
import os
import re
import secrets
import signal
import struct
import stat
import sys
import threading
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from receiver import emit, exact, exclusive, timeout_handler
from release_bundle import LIMIT, load_bundle, require, sha


def guard_current(config):
    link = Path(config['protectedCurrent'])
    require(link.is_symlink() and os.readlink(link) == config['expectedProtectedCurrent'],
            'observed current drift')


def read_policy(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'r', encoding='utf-8') as file:
        info = os.fstat(file.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022, 'unsafe stage policy')
        config = json.load(file)
    require(config.get('enabled') is True, 'stage receiver disabled')
    require(os.getuid() != 0 and os.getuid() == config['uid'], 'wrong stage UID')
    for key, length in [('sourceSha', 40), ('reviewedWorkflowSha', 40), ('archiveSha256', 64)]:
        require(re.fullmatch('[a-f0-9]{' + str(length) + '}', config.get(key, '')), 'invalid pin')
    require(re.fullmatch(r'ci-[a-f0-9]{12}-[0-9]{1,20}-[0-9]{1,3}', config['releaseId']), 'invalid release pin')
    root = Path(config['root'])
    protected = Path(config['protectedCurrent']).parent
    require(root.is_absolute() and root.resolve() == root, 'unsafe stage root')
    require(protected.is_absolute() and protected.resolve() == protected, 'unsafe protected root')
    require(root != protected and root not in protected.parents and protected not in root.parents,
            'stage and production roots overlap')
    require(root.stat().st_uid == 0 and not root.stat().st_mode & 0o022, 'unsafe stage parent')
    for name in ['releases', 'records']:
        folder = root / name
        require(folder.is_dir() and not folder.is_symlink() and folder.stat().st_uid == config['uid']
                and not folder.stat().st_mode & 0o022, 'unsafe stage directory')
    require(type(config['maxCandidates']) is int and 1 <= config['maxCandidates'] <= 4, 'candidate limit')
    guard_current(config)
    return config, root


def read_all_http(candidate, manifest):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
    server = http.server.ThreadingHTTPServer(
        ('127.0.0.1', 0), functools.partial(Quiet, directory=str(candidate)))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    total = 0
    try:
        for item in manifest:
            url = 'http://127.0.0.1:' + str(server.server_port) + '/' + urllib.parse.quote(item['path'], safe='/')
            with opener.open(url, timeout=20) as response:
                body = response.read(item['bytes'] + 1)
                require(response.status == 200 and response.geturl() == url
                        and len(body) == item['bytes'] and sha(body) == item['sha256'],
                        'candidate full HTTP read failed')
                total += len(body)
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=2)
    return total


def stage(config, root, stream, output=emit):
    guard_current(config)
    output(phase='STAGE_READY', protectedCurrent=config['expectedProtectedCurrent'])
    size = struct.unpack('!I', exact(stream, 4))[0]
    require(0 < size <= 16384, 'header limit')
    header = json.loads(exact(stream, size))
    require(type(header['archiveBytes']) is int and 0 < header['archiveBytes'] <= LIMIT, 'archive limit')
    require(header['archiveSha256'] == config['archiveSha256'], 'unapproved stage archive')
    raw = exact(stream, header['archiveBytes'])
    metadata, manifest, data = load_bundle(raw, config['archiveSha256'], config['site'], config['reviewedWorkflowSha'])
    require(metadata['sourceSha'] == config['sourceSha'] and metadata['releaseId'] == config['releaseId'],
            'unapproved source/run identity')
    guard_current(config)
    require(len(list((root / 'releases').iterdir())) < config['maxCandidates'], 'candidate quota reached')
    nonce = secrets.token_hex(16)
    candidate = root / 'releases' / (metadata['releaseId'] + '-' + nonce)
    candidate.mkdir(mode=0o750)  # Exclusive; interrupted candidates remain for inspection.
    for name, body in sorted(data.items()):
        target = candidate / name
        target.parent.mkdir(parents=True, exist_ok=True)
        exclusive(target, body, mode=0o640)
    for item in manifest:
        body = (candidate / item['path']).read_bytes()
        require(len(body) == item['bytes'] and sha(body) == item['sha256'], 'candidate disk differs')
    total = read_all_http(candidate, manifest)
    guard_current(config)
    receipt = {'phase': 'STAGE_FILES_READ', 'nonce': nonce, 'releaseId': metadata['releaseId'],
               'sourceSha': metadata['sourceSha'], 'workflowSha': metadata['workflowSha'],
               'archiveSha256': config['archiveSha256'],
               'manifestSha256': sha(json.dumps(manifest, sort_keys=True).encode()),
               'files': len(manifest), 'bytes': total,
               'protectedCurrent': config['expectedProtectedCurrent'], 'candidate': candidate.name,
               'networkPath': 'VPS loopback HTTP; candidate only', 'productionActivated': False}
    output(**receipt)
    line = stream.readline(4097)
    require(0 < len(line) <= 4096, 'missing/oversized stage acknowledgment')
    ack = json.loads(line)
    require(ack == {'nonce': nonce, 'accepted': True}, 'stage acknowledgment refused')
    guard_current(config)
    exclusive(root / 'records' / ('stage-' + nonce + '.json'), json.dumps(receipt, sort_keys=True).encode(), 0o640)
    output(phase='STAGE_COMPLETE', nonce=nonce, productionActivated=False,
           protectedCurrent=config['expectedProtectedCurrent'])
    return receipt


def main():
    import fcntl
    require(os.environ.get('SSH_ORIGINAL_COMMAND') == 'stage-v1', 'only stage-v1 accepted')
    config, root = read_policy('/etc/preview-deploy/stage-policy.json')
    for sig in [signal.SIGALRM, signal.SIGTERM, signal.SIGHUP]:
        signal.signal(sig, timeout_handler)
    signal.alarm(300)
    fd = os.open(root / 'records' / '.stage.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w'):
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        stage(config, root, sys.stdin.buffer)
    signal.alarm(0)


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        emit(phase='STAGE_FAILED_NO_RETRY', errorType=type(error).__name__)
        sys.exit(1)
