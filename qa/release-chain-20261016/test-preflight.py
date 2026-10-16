import copy, datetime, importlib.util, pathlib, tempfile, unittest, hashlib
spec=importlib.util.spec_from_file_location('preflight',pathlib.Path(__file__).with_name('check-preflight.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class PreflightTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.root=pathlib.Path(self.tmp.name);folder=self.root/'supabase/migrations';folder.mkdir(parents=True)
  self.file=folder/'20261005000100_example.sql';self.file.write_text('SELECT 1;')
  self.now=datetime.datetime(2026,10,16,tzinfo=datetime.timezone.utc)
  self.baseline={'migrations':['20261004001400']}
  self.e={'measuredAt':self.now.isoformat(),'migrations':self.baseline['migrations'][:],'functions':[{}],'tables':[{}],'policies':[{}]}
  self.man={'success':True,'cleaned':True,'candidates':[{'file':self.file.name,'sha256':hashlib.sha256(self.file.read_bytes()).hexdigest()}]}
 def run_check(self): return m.validate(self.e,self.man,self.baseline,self.root,self.now)
 def test_valid_inputs_never_approve_release(self): self.assertFalse(self.run_check()['productionReady'])
 def test_old(self):
  self.e['measuredAt']=(self.now-datetime.timedelta(hours=2)).isoformat()
  with self.assertRaises(ValueError):self.run_check()
 def test_future(self):
  self.e['measuredAt']=(self.now+datetime.timedelta(seconds=1)).isoformat()
  with self.assertRaises(ValueError):self.run_check()
 def test_ledger_changed(self):
  self.e['migrations'].append('20261005000100')
  with self.assertRaises(ValueError):self.run_check()
 def test_missing_catalog(self):
  del self.e['policies']
  with self.assertRaises(ValueError):self.run_check()
 def test_source_changed(self):
  self.file.write_text('SELECT 2;')
  with self.assertRaises(ValueError):self.run_check()
 def test_candidate_removed(self):
  self.file.unlink()
  with self.assertRaises(ValueError):self.run_check()
 def test_failed_rehearsal(self):
  self.man['success']=False
  with self.assertRaises(ValueError):self.run_check()
if __name__=='__main__':unittest.main()
