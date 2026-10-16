import copy
import datetime as dt
import importlib.util
import json
from pathlib import Path
import unittest

QA = Path(__file__).parent
spec = importlib.util.spec_from_file_location('ledger', QA / 'reconcile-ledger.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.base = json.loads((QA / 'production-ledger.json').read_text())
        self.rehearsal = json.loads((QA / 'full-barrier/result.json').read_text())
        self.current = copy.deepcopy(self.base)
        self.now = dt.datetime.now(dt.timezone.utc)
        self.current['measuredAt'] = self.now.isoformat()
        self.candidates = [e['file'][:14] for e in self.rehearsal['applied']]

    def check(self):
        return module.reconcile(self.current, self.base, self.rehearsal, now=self.now)

    def test_all_prefixes(self):
        for count in range(len(self.candidates) + 1):
            with self.subTest(count=count):
                self.current['migrations'] = self.base['migrations'] + self.candidates[:count]
                result = self.check()
                self.assertEqual(result['remainingCount'], len(self.candidates) - count)
                self.assertFalse(result['productionReady'])
                self.assertFalse(result['automaticResumeAllowed'])

    def test_gap(self):
        self.current['migrations'] += self.candidates[1:3]
        with self.assertRaises(ValueError): self.check()

    def test_missing_baseline(self):
        self.current['migrations'].pop(2)
        with self.assertRaises(ValueError): self.check()

    def test_foreign_migration(self):
        self.current['migrations'] += ['20990101000000']
        with self.assertRaises(ValueError): self.check()

    def test_duplicate(self):
        self.current['migrations'].append(self.current['migrations'][-1])
        with self.assertRaises(ValueError): self.check()

    def test_wrong_project(self):
        self.current['project'] = 'other'
        with self.assertRaises(ValueError): self.check()

    def test_stale_or_future(self):
        for seconds in (-3601, 1):
            self.current['measuredAt'] = (self.now + dt.timedelta(seconds=seconds)).isoformat()
            with self.assertRaises(ValueError): self.check()

    def test_failed_rehearsal(self):
        self.rehearsal['success'] = False
        with self.assertRaises(ValueError): self.check()

    def test_changed_file_hash(self):
        self.rehearsal['applied'][0]['sha256'] = '0' * 64
        with self.assertRaises(ValueError): self.check()

    def test_failed_migration(self):
        self.rehearsal['applied'][0]['exit'] = 1
        with self.assertRaises(ValueError): self.check()


if __name__ == '__main__': unittest.main()
