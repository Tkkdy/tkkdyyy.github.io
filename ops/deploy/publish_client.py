"""Uninstalled runner client. One SSH session; one serial request per public file."""
import json,os,queue,re,struct,subprocess,threading,urllib.parse
from pathlib import Path
from release_bundle import load_bundle,require,release_target,sha
def main():
    raw=Path('bundle.zip').read_bytes();digest=Path('bundle.zip.sha256').read_text().strip();site=os.environ['SITE_URL']
    metadata,manifest,data=load_bundle(raw,digest,site,os.environ['REVIEWED_WORKFLOW_SHA'])
    source=os.environ.get('SOURCE_SHA','');run_id=os.environ.get('GITHUB_RUN_ID','');attempt=os.environ.get('GITHUB_RUN_ATTEMPT','')
    require(re.fullmatch(r'[a-f0-9]{40}',source),'invalid runner source SHA')
    require(re.fullmatch(r'[1-9][0-9]{0,19}',run_id),'invalid runner run ID')
    require(re.fullmatch(r'[1-9][0-9]{0,2}',attempt),'invalid runner attempt')
    require(metadata['sourceSha']==source,'bundle source differs from runner source')
    require(metadata['releaseId']==f'ci-{source[:12]}-{run_id}-{attempt}','bundle release differs from runner run/attempt')
    expected=os.environ.get('EXPECTED_CURRENT');host=os.environ['VPS_SSH_HOST'];user=os.environ['VPS_SSH_USER']
    require(re.fullmatch(r'[a-z0-9][a-z0-9.-]*',host) and re.fullmatch(r'[a-z_][a-z0-9_-]*',user),'invalid SSH target')
    port=os.environ.get('VPS_SSH_PORT','22');require(port.isdigit() and 1<=int(port)<=65535,'invalid SSH port')
    p=subprocess.Popen(['ssh','-T','-p',port,'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+os.environ['VPS_KNOWN_HOSTS_FILE'],'-o','IdentitiesOnly=yes','-o','ConnectTimeout=15','-o','ConnectionAttempts=1','-i',os.environ['VPS_KEY_FILE'],user+'@'+host,'deploy-v1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
    log=[];metrics=[];token=None
    def receive(timeout):
        q=queue.Queue()
        threading.Thread(target=lambda:q.put(p.stdout.readline()),daemon=True).start()
        line=q.get(timeout=timeout);require(line and len(line)<1_000_000,'server response missing/oversized')
        obj=json.loads(line);log.append(obj);print(json.dumps(obj),flush=True);return obj
    def get(path,deadline):
        url=site+'/'+urllib.parse.quote(path,safe='/')
        r=subprocess.run(['curl','-q','--no-sessionid','--http1.1','-H','Connection: close','--noproxy','*','--silent','--show-error','--max-time',str(deadline),'--write-out','\nMETA:%{json}',url],capture_output=True,timeout=deadline+5)
        body,meta=r.stdout.rsplit(b'\nMETA:',1);native=json.loads(meta);metrics.append({'path':path,'networkPath':'GitHub hosted runner direct --noproxy *',**native})
        require(r.returncode==0 and native['ssl_verify_result']==0,'public TLS/transfer failed '+path)
        return body,native['http_code']
    try:
        current=receive(30);require(current.get('phase')=='READY_FOR_BUNDLE','receiver preflight missing')
        actual=release_target(current['current'])
        if expected:require(actual==release_target(expected),'explicit current differs')
        expected=actual
        header=json.dumps({'expectedCurrent':expected,'archiveBytes':len(raw),'archiveSha256':digest}).encode()
        p.stdin.write(struct.pack('!I',len(header))+header+raw);p.stdin.flush()
        ready=receive(180);require(ready.get('phase')=='WAIT_PUBLIC_VERDICT' and ready.get('releaseId')==metadata['releaseId'],'receiver not ready')
        token=ready['token']
        for item in manifest:
            if item['path']=='404.html':continue # Nginx internal error page verified below.
            body,status=get(item['path'],60 if item['bytes']>1_000_000 else 20)
            require(status==200 and len(body)==item['bytes'] and sha(body)==item['sha256'],'public file mismatch '+item['path'])
        for path in ['admin/','admin/config.yml','.env','.git/config','unknown-ci-'+metadata['releaseId']]:
            body,status=get(path,20);require(status==404 and sha(body)==sha(data['404.html']),'public error/admin isolation')
        # Trusted pipeline browser code executes before the public acceptance verdict.
        subprocess.run(['node',str(Path(__file__).with_name('browser_gate.mjs'))],check=True,timeout=120)
        p.stdin.write((json.dumps({'token':token,'passed':True,'browserAcceptance':json.loads(Path('browser-evidence.json').read_text(encoding='utf-8')),'resourceFiles':len(manifest)-1,'manifestSha256':sha(json.dumps(manifest,sort_keys=True).encode())})+'\n').encode());p.stdin.flush()
        require(receive(30).get('phase')=='COMMITTED','not committed')
        p.stdin.close();require(p.wait(timeout=15)==0,'SSH exit failed')
    except BaseException:
        if token and p.poll() is None:
            try:p.stdin.write((json.dumps({'token':token,'passed':False})+'\n').encode());p.stdin.flush();receive(40)
            except Exception:pass
        raise
    finally:
        if p.poll() is None:
            try:p.stdin.close();p.wait(timeout=60)
            except Exception:pass # EOF/timeout restores previous current at receiver.
        Path('deployment-evidence.json').write_text(json.dumps({'sourceSha':metadata['sourceSha'],'target':'vps','serverEvents':log,'downloads':metrics},indent=2),encoding='utf-8')
if __name__=='__main__':main()
