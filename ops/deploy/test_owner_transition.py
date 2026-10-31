"""Linux-only temp fixtures: real UID997/GID987, ACL/inodes/flock/HTTP/protocol.
GitHub authority and server-side HTTPS are isolated test doubles, never production.
One full protocol run also invokes the actual Chrome browser gate over loopback.
"""
import copy,hashlib,io,json,os,select,shutil,stat,struct,subprocess,sys,tempfile,time,unittest,zipfile
from pathlib import Path
from unittest.mock import patch
from release_bundle import sha
UID=997;GID=987
REPO=Path(__file__).resolve().parents[2]

def worker(root,mode):
    import receiver as r,source_authority as authority
    root=Path(root);fixture=json.loads((root/'fixture.json').read_text());source=fixture['source']
    print('ACTUAL_FIXTURE_UID='+str(os.getuid())+' GID='+str(os.getgid()),file=sys.stderr,flush=True)
    assert os.getuid()==UID and os.getgid()==GID
    os.environ['SSH_ORIGINAL_COMMAND']='deploy-v1'
    def fetch(path):
        if path.endswith('/commits/main'):return {'sha':'f'*40 if mode=='main-mismatch' else source}
        return {'status':'ahead','merge_base_commit':{'sha':fixture['baseline']}}
    original=authority.verify_main
    authority.verify_main=lambda repo,source,baseline:original(repo,source,baseline,fetch=fetch)
    r.https_body=lambda site,name:(root/os.readlink(root/'current')/name).read_bytes()
    if mode=='timeout':r.select.select=lambda *args:([],[],[])
    try:
        if mode=='read':
            from release_records import read_record
            value=read_record(root,Path(os.readlink(root/'current')).name);print(json.dumps({'phase':'READ_OK','recordType':value['recordType']}),flush=True)
        elif mode=='seal':
            from seal_owner_completion import seal
            seal(root,root/'root-result.json','a'*64,'b'*64,GID,True)
        elif mode=='rollback':
            import rollback_release as rollback
            rollback.https_body=r.https_body
            value=rollback.rollback(root/'policy.json',fixture['new'],fixture['owner'],True);print(json.dumps({'phase':'ROLLBACK_OK',**value}),flush=True)
        else:r.main(root/'policy.json')
    except BaseException as e:
        print(json.dumps({'phase':'FAILED_NO_RETRY','type':type(e).__name__,'error':str(e)}),flush=True);return 1
    return 0

@unittest.skipUnless(sys.platform=='linux' and getattr(os,'geteuid',lambda:-1)()==0,'requires isolated Linux root with genuine child UID997')
class OwnerTransitionTests(unittest.TestCase):
    def write(self,name,value,mode=0o644):
        p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(value if isinstance(value,bytes) else json.dumps(value,sort_keys=True).encode());p.chmod(mode);return p
    def manifest(self,target,data):
        for n,b in data.items():self.write(target+'/'+n,b)
        raw=json.dumps([{'path':n,'bytes':len(b),'sha256':sha(b)} for n,b in sorted(data.items())],sort_keys=True).encode()
        return self.write('records/manifest-'+Path(target).name+'.json',raw)
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='dual-site-uid-');self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name);self.root.chmod(0o755)
        runtime=self.root/'runtime';runtime.mkdir(mode=0o755)
        for code in Path(__file__).resolve().parent.glob('*.py'):
            shutil.copyfile(code,runtime/code.name);(runtime/code.name).chmod(0o644)
        self.bundle=Path(os.environ['VPS_PRODUCTION_BUNDLE']).read_bytes()
        with zipfile.ZipFile(io.BytesIO(self.bundle)) as z:self.meta=json.loads(z.read('release.json'))
        self.source=self.meta['sourceSha'];self.baseline='8'*40;self.new='releases/'+self.meta['releaseId']
        base='releases/preview-old';old={'index.html':b'old preview','404.html':b'404','a.css':b'css','a.js':b'js'}
        raw=self.manifest(base,old).read_bytes();legacy={'releaseId':'preview-old','mainSha':self.baseline,'current':base,'manifestSha256':sha(raw),'archiveSha256':'9'*64}
        lp=self.write('records/deploy-preview-old.json',legacy)
        bridge={'recordType':'OWNER_VERIFIED_LEGACY','ciAccepted':False,'sourceSha':self.baseline,'current':base,'site':'https://preview.boenbot.top','originalManifestSha256':sha(raw),'manifestSha256':sha(raw),'legacyRecordSha256':sha(lp.read_bytes()),'archiveSha256':'9'*64,'fullManifestVerified':True,'publicCriticalVerified':True,'applied':True}
        bp=self.write('records/legacy-preview-old.json',bridge)
        owner_data={'index.html':b'old production indexable','404.html':b'404','a.css':b'css','a.js':b'js'}
        manifest=json.dumps([{'path':n,'bytes':len(b),'sha256':sha(b)} for n,b in sorted(owner_data.items())],sort_keys=True).encode();digest=sha(manifest)
        self.rid='owner-tkkdy-'+digest[:12]+'-2026102900000007';self.owner='releases/'+self.rid;self.manifest(self.owner,owner_data)
        derivation={'candidateManifestSha256':digest,'baselineManifestSha256':sha(raw),'bodyBytesUnchanged':True,'assetsAndPagefindBytesUnchanged':True,'rssPayloadAndGuidsUnchanged':True}
        dp=self.write('records/derivation-'+self.rid+'.json',derivation)
        self.approval={'schema':1,'scope':'ONE_OWNER_LIVE_DERIVED_PROMOTION','enabled':True,'expiresEpoch':int(time.time())+3600,'root':str(self.root),'attemptId':'2026102900000007','target':self.owner,'expectedCurrent':base,'site':'https://tkkdy.me','indexingProfile':'production','baselineOriginalManifestSha256':sha(raw),'baselineBridgeSha256':sha(bp.read_bytes()),'baselineSourceSha':self.baseline,'candidateManifestSha256':digest,'derivationSha256':sha(dp.read_bytes()),'externalGateSha256':'a'*64,'observerCodeCommit':'b'*40,'observerWorkflowSha256':'c'*64}
        self.ap=self.write('records/owner-approval-'+self.rid+'.json',self.approval)
        self.guarded=self.verdict('guarded',101,None)
        self.value={'recordType':'OWNER_DERIVED_STATIC','ciAccepted':False,'applied':True,'fullManifestVerified':True,'publicCriticalVerified':True,'current':self.owner,'site':'https://tkkdy.me','indexingProfile':'production','manifestSha256':digest,'approvalSha256':sha(self.ap.read_bytes()),'baselineCurrent':base,'sourceAttribution':'DERIVED_FROM_OWNER_VERIFIED_LIVE_ARTIFACT','sourceSha':self.baseline,'publicAcceptance':self.guarded,'utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
        self.record=self.write('records/manual-'+self.rid+'.json',self.value)
        self.final=self.verdict('indexable',102,{'runId':101,'reportSha256':'d'*64})
        self.completion={'phase':'COMPLETE','status':'PASS','scope':'ONE_OWNER_LIVE_DERIVED_PROMOTION','launchId':'owner-launch-linux-0007','current':self.owner,'indexingActivated':True,'policyUnchanged':True,'installedToolsUnchanged':True,'otherNginxUnchanged':True,'oldReleasesRetained':True,'finalAcceptance':self.final}
        self.result=self.write('root-result.json',self.completion,0o600)
        (self.root/'current').symlink_to(self.owner)
        self.lock=self.write('records/.ci.lock',b'',0o600)
        self.policy={'root':str(self.root),'site':'https://tkkdy.me','indexingProfile':'production','reviewedWorkflowSha':self.meta['workflowSha'],'sourceAuthority':'github-main','repository':'Tkkdy/tkkdyyy.github.io','bootstrapSourceSha':self.baseline,'enabled':True}
        self.policyfile=self.write('policy.json',self.policy)
        self.write('fixture.json',{'source':self.source,'baseline':self.baseline,'owner':self.owner,'new':self.new})
        # Reproduce the actual production ownership and modes, then apply only proposed named ACLs.
        for p in [self.root,self.root/'records',self.root/'releases',self.lock]:os.chown(p,1001,1001)
        self.grant()
        from seal_owner_completion import seal
        result=seal(self.root,self.result,sha(self.result.read_bytes()),sha(self.record.read_bytes()),GID)
        self.assertFalse(result['applied']);self.assertFalse(Path(result['output']).exists())
        seal(self.root,self.result,sha(self.result.read_bytes()),sha(self.record.read_bytes()),GID,True)
    def grant(self):
        subprocess.run(['setfacl','-m','u:'+str(UID)+':rwx',str(self.root),str(self.root/'records'),str(self.root/'releases')],check=True)
        subprocess.run(['setfacl','-m','u:'+str(UID)+':rw',str(self.lock)],check=True)
    def verdict(self,phase,run,previous):
        from owner_records import IMAGE
        token=('1' if phase=='guarded' else '2')*48;source=('e' if phase=='guarded' else 'f')*40
        value={'scope':'OWNER_GUARDED_PUBLIC_ACCEPTANCE' if phase=='guarded' else 'OWNER_INDEXABLE_PUBLIC_ACCEPTANCE','passed':True,'token':token,'candidateManifestSha256':self.approval['candidateManifestSha256'],'gateSha256':'a'*64,'newDomainNoindex':phase=='guarded','indexable':phase=='indexable'}
        value.update({k:True for k in ['strictTls','canonical','searchAndClick','desktop','mobile','oldDomainNoindex','pagesIndependent','editorEntry','friends','fullManifest','searchAnd404Noindex']})
        value['linuxEvidence']={'phase':phase,'challengeSha256':sha(token.encode()),'observerCodeCommit':'b'*40,'workflowSha256':'c'*64,'runId':run,'runAttempt':1,'sourceSha':source,'artifactSha256':'d'*64,'reportSha256':'d'*64,'url':'https://github.com/Tkkdy/tkkdyyy.github.io/actions/runs/'+str(run),'requestId':'owner-0007-'+phase+'-'+'a'*24,'previousEvidence':previous,'runtime':{'node':'v24.19.0','openssl':'3.5.7','image':IMAGE,'browser':'156.0.8078.4','browserChannel':'chrome-for-testing','directFlagVerified':True,'runId':str(run),'runAttempt':'1','sourceSha':source}}
        return value
    def start(self,mode='normal'):
        def drop():os.setgroups([]);os.setgid(GID);os.setuid(UID)
        return subprocess.Popen([sys.executable,'-B',str(self.root/'runtime/test_owner_transition.py'),'worker',str(self.root),mode],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=0,preexec_fn=drop)
    def line(self,p):
        self.assertTrue(select.select([p.stdout],[],[],45)[0],'fixture process deadline');raw=p.stdout.readline()
        if not raw:
            p.stdin.close();p.stdin=None;out,err=p.communicate(timeout=10);self.fail('fixture unexpected EOF: '+err.decode(errors='replace'))
        return json.loads(raw)
    def run_receiver(self,mode='normal',passed=True,browser=False):
        p=self.start(mode);events=[];first=self.line(p);events.append(first)
        if first['phase']=='READY_FOR_BUNDLE':
            header=json.dumps({'archiveBytes':len(self.bundle),'archiveSha256':sha(self.bundle),'expectedCurrent':self.owner}).encode();p.stdin.write(struct.pack('!I',len(header))+header+self.bundle);p.stdin.flush()
            item=self.line(p);events.append(item)
            if item['phase']=='WAIT_PUBLIC_VERDICT':
                if browser:
                    evidence=Path(os.environ.get('TRANSITION_EVIDENCE_DIR',str(self.root/'browser')));evidence.mkdir(parents=True,exist_ok=True)
                    command=['node',str(REPO/'scripts/verify-local-profile.mjs'),str(self.root/'current'),'production']
                    r=subprocess.run(command,cwd=evidence,capture_output=True,timeout=180);(evidence/'browser.stdout.log').write_bytes(r.stdout);(evidence/'browser.stderr.log').write_bytes(r.stderr);self.assertEqual(r.returncode,0,r.stderr.decode(errors='replace'))
                    command[-1]='shared-preview';r=subprocess.run(command,cwd=evidence,capture_output=True,timeout=180);(evidence/'shared-preview.stdout.log').write_bytes(r.stdout);(evidence/'shared-preview.stderr.log').write_bytes(r.stderr);self.assertEqual(r.returncode,0,r.stderr.decode(errors='replace'))
                if mode!='timeout':p.stdin.write((json.dumps({'token':item['token'],'passed':passed})+'\n').encode());p.stdin.flush()
        p.stdin.close();p.stdin=None;out,err=p.communicate(timeout=60);events.extend(json.loads(x) for x in out.splitlines() if x);self.assertIn(b'ACTUAL_FIXTURE_UID=997 GID=987',err)
        print(json.dumps({'case':self._testMethodName,'uid':UID,'gid':GID,'receiverExit':p.returncode,'phases':[x['phase'] for x in events],'current':os.readlink(self.root/'current'),'stderr':err.decode(errors='replace')[:400]}),flush=True)
        return p.returncode,events
    def reject(self,mode='normal'):
        rc,events=self.run_receiver(mode);self.assertNotEqual(rc,0);self.assertEqual(os.readlink(self.root/'current'),self.owner);self.assertFalse((self.root/'records'/('deploy-'+self.meta['releaseId']+'.json')).exists())
    def test_real_nonroot_transaction_browser_and_rollback(self):
        rc,events=self.run_receiver(browser=True);self.assertEqual(rc,0);self.assertEqual(events[-1]['phase'],'COMMITTED');record=events[-1]['record'];self.assertEqual(record['recordType'],'CI_ACCEPTED');self.assertTrue(record['ciAccepted']);self.assertEqual(record['sourceSha'],self.source)
        p=self.start('rollback');p.stdin.close();p.stdin=None;out,err=p.communicate(timeout=60);self.assertEqual(p.returncode,0,out+err);self.assertEqual(os.readlink(self.root/'current'),self.owner)
    def test_missing_production_acl_fails_before_write(self):
        for q in [self.root,self.root/'records',self.root/'releases',self.lock]:subprocess.run(['setfacl','-b',str(q)],check=True)
        self.root.chmod(0o755);(self.root/'records').chmod(0o755);(self.root/'releases').chmod(0o755);self.lock.chmod(0o600);self.reject()
    def test_unreadable_approval_fails(self):self.ap.chmod(0o600);self.reject()
    def test_tampered_approval_fails(self):self.ap.write_bytes(b'{}');self.reject()
    def test_tampered_manifest_fails(self):self.write('records/manifest-'+self.rid+'.json',b'[]');self.reject()
    def test_wrong_owner_source_fails(self):v=copy.deepcopy(self.value);v['sourceSha']='f'*40;self.record.write_text(json.dumps(v));self.reject()
    def test_nonroot_owned_record_fails(self):os.chown(self.record,UID,GID);self.reject()
    def test_illegal_record_schema_fails(self):self.record.write_text('{}');self.reject()
    def test_wrong_policy_profile_fails(self):self.policy['indexingProfile']='preview';self.policyfile.write_text(json.dumps(self.policy));self.reject()
    def test_old_domain_artifact_fails(self):self.bundle=Path(os.environ['VPS_PREVIEW_BUNDLE']).read_bytes();self.reject()
    def test_superseded_main_fails(self):self.reject('main-mismatch')
    def test_duplicate_release_fails(self):(self.root/self.new).mkdir();self.reject()
    def test_verdict_timeout_restores_owner_current(self):self.reject('timeout')
    def test_browser_fail_restores_owner_current(self):
        rc,events=self.run_receiver(passed=False);self.assertNotEqual(rc,0);self.assertTrue(any(x['phase']=='ROLLED_BACK' for x in events));self.assertEqual(os.readlink(self.root/'current'),self.owner)
    def test_missing_final_seal_fails(self):(self.root/'records'/('owner-completion-'+self.rid+'.json')).unlink();self.reject()
    def test_unreadable_final_seal_fails(self):(self.root/'records'/('owner-completion-'+self.rid+'.json')).chmod(0o600);self.reject()
    def test_forged_indexable_evidence_fails(self):v=copy.deepcopy(self.completion);v['finalAcceptance']['linuxEvidence']['previousEvidence']['runId']=999;self.write('records/owner-completion-'+self.rid+'.json',v,0o640);self.reject()
    def test_seal_wrong_pin_does_not_write(self):
        from seal_owner_completion import seal
        output=self.root/'records'/('owner-completion-'+self.rid+'.json');output.unlink()
        for result_pin,record_pin in [('a'*64,sha(self.record.read_bytes())),(sha(self.result.read_bytes()),'b'*64)]:
            with self.assertRaisesRegex(ValueError,'pin differs'):seal(self.root,self.result,result_pin,record_pin,GID,True)
            self.assertFalse(output.exists())
    def test_nonroot_cannot_seal(self):
        p=self.start('seal');p.stdin.close();p.stdin=None;out,err=p.communicate(timeout=20)
        self.assertNotEqual(p.returncode,0);self.assertIn(b'completion seal requires root owner',out)
    def test_seal_replay_is_rejected(self):
        from seal_owner_completion import seal
        with self.assertRaisesRegex(ValueError,'overwritten'):seal(self.root,self.result,sha(self.result.read_bytes()),sha(self.record.read_bytes()),GID,True)

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='worker':sys.exit(worker(sys.argv[2],sys.argv[3]))
    unittest.main(verbosity=2)
