"""Local fault-injection simulation. Does not prove Linux SSH/ACL/fsync integration."""
import io,json,unittest
from pathlib import Path
from unittest.mock import patch
import receiver as r
class TransactionTests(unittest.TestCase):
    def setUp(self):
        self.old='releases/old';self.new='releases/new';self.state={'current':self.old}
        self.calls=[];self.events=[];self.records={}
        self.data={'index.html':b'new','a.css':b'css','a.js':b'js'}
        self.meta={'releaseId':'new'};self.token='fixed-token'
        self.public=True;self.wait=True;self.badtoken=False;self.corrupt=False
        self.drift=False;self.failrecord=False;self.failack=False;self.failafterswitch=False
        self.failfirstswitch=False;self.signalAtWait=False
    def link(self,root,new,expected):
        r.require(self.state['current']==expected,'unexpected current')
        if self.failfirstswitch and new==self.new:raise OSError('injected before switch')
        self.state['current']=new;self.calls.append((new,expected))
        if self.failafterswitch and new==self.new:raise OSError('injected fsync after switch')
    def body(self,site,path):
        if self.state['current']==self.old:return b'old'
        return b'corrupt' if self.corrupt else self.data[path]
    def emit(self,**obj):
        if self.failack and obj.get('phase')=='COMMITTED':raise BrokenPipeError('injected ACK loss')
        self.events.append(obj)
    def write(self,path,data):
        if self.failrecord:raise OSError('injected record failure')
        self.records[str(path)]=json.loads(data)
    def readable(self,*args):
        if self.signalAtWait:raise TimeoutError('injected alarm')
        if self.drift:self.state['current']='releases/UNKNOWN'
        return ([self.stream],[],[]) if self.wait else ([],[],[])
    def run_transaction(self,raw=None):
        verdict={'token':'wrong' if self.badtoken else self.token,'passed':self.public}
        self.stream=io.BytesIO(raw if raw is not None else (json.dumps(verdict)+'\n').encode())
        self.meta['site']='https://unit-test.invalid'
        with patch.object(r,'atomic_link',self.link),patch.object(r,'https_body',self.body),patch.object(r,'emit',self.emit),patch.object(r,'exclusive',self.write),patch.object(r.os,'readlink',lambda p:self.state['current']),patch.object(r.signal,'alarm',lambda n:None,create=True),patch.object(r.select,'select',self.readable),patch.object(r.secrets,'token_hex',lambda n:self.token):
            r.activate_transaction(Path('SIMULATED_ROOT'),self.new,self.old,list(self.data),self.data,r.sha(b'old'),self.meta,{'archiveSha256':'x'},[],self.stream)
    def assert_rollback(self):
        self.assertEqual(self.state['current'],self.old)
        self.assertEqual(self.calls,[(self.new,self.old),(self.old,self.new)])
        self.assertTrue(any(x.get('phase')=='ROLLED_BACK' for x in self.events))
        self.assertFalse(self.records)
    def test_success(self):
        self.run_transaction()
        self.assertEqual(self.state['current'],self.new);self.assertEqual(len(self.records),1)
        self.assertEqual(self.events[-1]['phase'],'COMMITTED')
    def test_public_failure(self):
        self.public=False
        with self.assertRaises(ValueError):self.run_transaction()
        self.assert_rollback()
    def test_missing_verdict_eof(self):
        with self.assertRaises(ValueError):self.run_transaction(b'')
        self.assert_rollback()
    def test_wrong_token(self):
        self.badtoken=True
        with self.assertRaises(ValueError):self.run_transaction()
        self.assert_rollback()
    def test_https_hash_failure(self):
        self.corrupt=True
        with self.assertRaises(ValueError):self.run_transaction()
        self.assert_rollback()
    def test_public_wait_timeout(self):
        self.wait=False
        with self.assertRaises(ValueError):self.run_transaction()
        self.assert_rollback()
    def test_signal_timeout(self):
        self.signalAtWait=True
        with self.assertRaises(TimeoutError):self.run_transaction()
        self.assert_rollback()
    def test_unknown_current_preserved(self):
        self.drift=True
        with self.assertRaises(ValueError):self.run_transaction()
        self.assertEqual(self.state['current'],'releases/UNKNOWN')
        self.assertEqual(self.calls,[(self.new,self.old)])
    def test_record_failure(self):
        self.failrecord=True
        with self.assertRaises(OSError):self.run_transaction()
        self.assert_rollback()
    def test_ack_loss_after_commit_preserves_verified_new(self):
        self.failack=True
        with self.assertRaises(BrokenPipeError):self.run_transaction()
        self.assertEqual(self.state['current'],self.new)
        self.assertEqual(len(self.records),1);self.assertEqual(len(self.calls),1)
    def test_failure_after_link_before_fsync(self):
        self.failafterswitch=True
        with self.assertRaises(OSError):self.run_transaction()
        self.assert_rollback()
    def test_failure_before_link_does_not_roll_back_unchanged(self):
        self.failfirstswitch=True
        with self.assertRaises(OSError):self.run_transaction()
        self.assertEqual(self.state['current'],self.old);self.assertFalse(self.calls)
if __name__=='__main__':unittest.main(verbosity=2)
