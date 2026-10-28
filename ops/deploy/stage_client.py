"""One candidate SSH session, pinned artifact, no public activation claim or retries."""
import argparse
import json
import os
import queue
import re
import struct
import subprocess
import threading
from pathlib import Path
from release_bundle import load_bundle, require, sha


def validate_receipt(receipt, expected, metadata, manifest):
    fields = {'phase': 'STAGE_FILES_READ', 'releaseId': metadata['releaseId'],
              'sourceSha': metadata['sourceSha'], 'workflowSha': metadata['workflowSha'],
              'archiveSha256': expected['archiveSha256'],
              'manifestSha256': sha(json.dumps(manifest, sort_keys=True).encode()),
              'files': len(manifest), 'bytes': sum(item['bytes'] for item in manifest),
              'protectedCurrent': expected['expectedProtectedCurrent'], 'productionActivated': False,
              'networkPath': 'VPS loopback HTTP; candidate only'}
    require(all(receipt.get(key) == value for key, value in fields.items()), 'stage receipt differs')
    nonce = receipt.get('nonce', '')
    require(re.fullmatch('[a-f0-9]{32}', nonce), 'invalid stage nonce')
    require(receipt.get('candidate') == metadata['releaseId'] + '-' + nonce, 'invalid candidate path')
    return nonce


def run(bundle, pins, disconnect=False):
    raw = Path(bundle).read_bytes()
    expected = json.loads(Path(pins).read_text(encoding='utf-8-sig'))
    metadata, manifest, _ = load_bundle(raw, expected['archiveSha256'], expected['site'], expected['reviewedWorkflowSha'])
    require(metadata['releaseId'] == expected['releaseId'] and metadata['sourceSha'] == expected['sourceSha'],
            'unapproved build identity')
    host, user = os.environ['STAGE_SSH_HOST'], os.environ['STAGE_SSH_USER']
    require(host == '203.55.176.11' and user == 'preview-deploy', 'unapproved SSH destination')
    process = subprocess.Popen(['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
                                '-o', 'IdentitiesOnly=yes', '-o', 'ConnectTimeout=15', '-o', 'ConnectionAttempts=1',
                                '-o', 'UserKnownHostsFile=' + os.environ['STAGE_KNOWN_HOSTS_FILE'],
                                '-i', os.environ['STAGE_KEY_FILE'], user + '@' + host, 'stage-v1'],
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    events = []
    def receive(seconds):
        result = queue.Queue()
        threading.Thread(target=lambda: result.put(process.stdout.readline(16385)), daemon=True).start()
        line = result.get(timeout=seconds)
        require(0 < len(line) <= 16384, 'stage response missing/oversized')
        event = json.loads(line)
        events.append(event)
        return event
    try:
        ready = receive(30)
        require(ready == {'phase': 'STAGE_READY', 'protectedCurrent': expected['expectedProtectedCurrent']}, 'unexpected stage ready')
        header = json.dumps({'archiveBytes': len(raw), 'archiveSha256': expected['archiveSha256']}).encode()
        process.stdin.write(struct.pack('!I', len(header)) + header + raw)
        process.stdin.flush()
        receipt = receive(240)
        nonce = validate_receipt(receipt, expected, metadata, manifest)
        if disconnect:
            process.stdin.close()
            failure = receive(15)
            require(failure.get('phase') == 'STAGE_FAILED_NO_RETRY', 'disconnect did not fail closed')
            require(process.wait(timeout=15) != 0, 'disconnect unexpectedly succeeded')
        else:
            process.stdin.write((json.dumps({'nonce': nonce, 'accepted': True}) + '\n').encode())
            process.stdin.flush()
            done = receive(15)
            require(done == {'phase': 'STAGE_COMPLETE', 'nonce': nonce, 'productionActivated': False,
                             'protectedCurrent': expected['expectedProtectedCurrent']}, 'unexpected stage completion')
            process.stdin.close()
            require(process.wait(timeout=15) == 0, 'stage SSH failed')
        return {'state': 'EXPECTED_DISCONNECT' if disconnect else 'CANDIDATE_ONLY_PASS', 'events': events,
                'buildRunId': expected['buildRunId'], 'integrationRunId': os.environ.get('GITHUB_RUN_ID'),
                'integrationAttempt': os.environ.get('GITHUB_RUN_ATTEMPT'), 'productionActivated': False}
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=10)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--bundle', required=True)
    parser.add_argument('--pins', required=True)
    parser.add_argument('--disconnect-after-read', action='store_true')
    args = parser.parse_args()
    print(json.dumps(run(args.bundle, args.pins, args.disconnect_after_read)))
