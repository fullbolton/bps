"""Offline release reconciliation. No database writes or automatic resume."""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
PROJECT = 'dffdzbmnmnokbftbujsy'


def versions(value):
    if not isinstance(value, list) or not value:
        raise ValueError('Migration list missing or empty')
    if any(not isinstance(v, str) or not re.fullmatch(r'\d{14}', v) for v in value):
        raise ValueError('Invalid migration version')
    if value != sorted(set(value)):
        raise ValueError('Migration versions must be unique and sorted')
    return value


def reconcile(current, baseline, rehearsal, root=ROOT, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    if current.get('project') != PROJECT or baseline.get('project') != PROJECT:
        raise ValueError('Unexpected project identity')
    stamp = dt.datetime.fromisoformat(current['measuredAt'].replace('Z', '+00:00'))
    if stamp.tzinfo is None or not 0 <= (now - stamp).total_seconds() <= 3600:
        raise ValueError('Ledger measurement must be no older than one hour, with timezone')
    base = versions(baseline['migrations'])
    actual = versions(current['migrations'])
    if any(rehearsal.get(k) is not True for k in ('success', 'cleaned', 'barrierRemoved', 'emptySnapshotVerified')):
        raise ValueError('Full rehearsal incomplete')
    entries = rehearsal['applied']
    candidate_versions = versions([e['file'].split('_', 1)[0] for e in entries])
    if candidate_versions[0] <= base[-1]:
        raise ValueError('Candidate overlaps historical baseline')
    paths = sorted(p for p in (root / 'supabase/migrations').glob('*.sql') if p.name[:14] > base[-1])
    expected = [(e['file'], e['sha256']) for e in entries]
    measured = [(p.name, hashlib.sha256(p.read_bytes()).hexdigest()) for p in paths]
    if measured != expected or any(e.get('exit') != 0 for e in entries):
        raise ValueError('Candidate source differs from successful full rehearsal')
    if actual[:len(base)] != base:
        raise ValueError('Historical ledger changed')
    applied = actual[len(base):]
    if applied != candidate_versions[:len(applied)] or len(applied) > len(entries):
        raise ValueError('Ledger is not an exact candidate prefix; stop and investigate')
    remaining = entries[len(applied):]
    return {
        'inputChecksPassed': True, 'productionReady': False,
        'scope': 'offline ledger and local file integrity only; no schema or deployment verification',
        'state': 'not_started' if not applied else ('complete' if not remaining else 'partial'),
        'baselineCount': len(base), 'appliedCandidateCount': len(applied),
        'remainingCount': len(remaining), 'nextCandidate': remaining[0]['file'] if remaining else None,
        'automaticResumeAllowed': False,
        'requiredBeforeMutation': ['Fresh schema compatibility check', 'Maintenance and barrier verification',
                                   'Resolve any interrupted transaction and confirm ledger matches schema'],
    }


if __name__ == '__main__':
    try:
        parser = argparse.ArgumentParser(description=__doc__)
        parser.add_argument('ledger', type=Path)
        args = parser.parse_args()
        qa = Path(__file__).parent
        print(json.dumps(reconcile(json.loads(args.ledger.read_text()),
            json.loads((qa / 'production-ledger.json').read_text()),
            json.loads((qa / 'full-barrier/result.json').read_text())), indent=2))
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(json.dumps({'inputChecksPassed': False, 'productionReady': False, 'error': str(error)}))
        sys.exit(1)
