"""Readiness input checks only. Never connects, applies SQL, or approves a release."""
from pathlib import Path
import datetime, hashlib, json, sys
ROOT = Path(__file__).resolve().parents[2]
def validate(evidence, manifest, baseline, root=ROOT, now=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    stamp = datetime.datetime.fromisoformat(evidence['measuredAt'].replace('Z','+00:00'))
    if stamp.tzinfo is None or not 0 <= (now-stamp).total_seconds() <= 3600:
        raise ValueError('Catalog measurement must be timezone-aware and at most one hour old')
    if evidence['migrations'] != baseline['migrations']:
        raise ValueError('Production ledger differs from the 129-migration baseline: replan before applying')
    for key in ('functions','tables','policies'):
        if not isinstance(evidence.get(key),list) or not evidence[key]:
            raise ValueError('Missing catalog section: '+key)
    files = sorted(p for p in (root/'supabase/migrations').glob('*.sql') if p.name[:14] > baseline['migrations'][-1])
    actual = [{'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
    if not actual or actual != manifest['candidates']:
        raise ValueError('Candidate files differ from rehearsed manifest: repeat rehearsal')
    if manifest.get('success') is not True or manifest.get('cleaned') is not True:
        raise ValueError('Local incremental rehearsal incomplete')
    return {'inputChecksPassed':True,'productionReady':False,'candidateCount':len(actual),
      'remaining':['Verify connection project identity independently','Compare current catalog to clean schema snapshot','Replay all candidates on that clean snapshot','Review rollout ordering and application compatibility']}
if __name__ == '__main__':
    try:
        if len(sys.argv)!=2: raise ValueError('Usage: python3 check-preflight.py /path/to/read-only-catalog.json')
        out=validate(json.loads(Path(sys.argv[1]).read_text()),
          json.loads((Path(__file__).parent/'result.json').read_text()),
          json.loads((ROOT/'qa/module-hotfix-first-20261005/production-preflight.json').read_text()))
        print(json.dumps(out,indent=2))
    except Exception as error:
        print(json.dumps({'inputChecksPassed':False,'productionReady':False,'error':str(error)}))
        sys.exit(1)
