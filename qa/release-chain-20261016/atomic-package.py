"""Compose only hash-pinned, rehearsed SQL. Does not connect or execute SQL."""
import hashlib
import json
from pathlib import Path
import re

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[1]


def body(sql, begin='BEGIN;'):
    # Limited to this reviewed manifest, not a general SQL parser.
    starts = list(re.finditer(r'^' + re.escape(begin) + r'[ \t]*$', sql, re.M))
    ends = list(re.finditer(r'^COMMIT;[ \t]*$', sql, re.M))
    if len(starts) != 1 or len(ends) != 1 or starts[0].end() >= ends[0].start():
        raise ValueError('Unexpected transaction envelope')
    prefix = sql[:starts[0].start()]
    if any(line.strip() and not line.lstrip().startswith('--') for line in prefix.splitlines()):
        raise ValueError('Non-comment before BEGIN')
    if sql[ends[0].end():].strip():
        raise ValueError('Trailing SQL after COMMIT')
    return sql[starts[0].end():ends[0].start()]


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def compose(path):
    report = json.loads((BASE / 'full-barrier/result.json').read_text())
    entries = report['applied']
    if report.get('success') is not True or report.get('barrierRemoved') is not True:
        raise ValueError('Successful full rehearsal required')
    raw = path.read_text()
    matches = [e for e in entries if e['file'] == path.name]
    if len(matches) != 1 or matches[0]['sha256'] != hashlib.sha256(path.read_bytes()).hexdigest():
        raise ValueError('Migration is not the exact rehearsed candidate')
    index = entries.index(matches[0])
    baseline = json.loads((BASE / 'production-ledger.json').read_text())['migrations']
    prior = baseline + [e['file'][:14] for e in entries[:index]]
    array = 'ARRAY[' + ','.join(literal(v) for v in prior) + ']::text[]'
    version, name = path.stem.split('_', 1)
    guard = """
SELECT pg_advisory_xact_lock(87001620261017);
DO $ledger_guard$ BEGIN
 IF (SELECT array_agg(version::text ORDER BY version) FROM supabase_migrations.schema_migrations)
    IS DISTINCT FROM %s THEN RAISE EXCEPTION 'RELEASE_LEDGER_PREFIX_CHANGED'; END IF;
END $ledger_guard$;
""" % array
    insert = ('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('
              + literal(version) + ',' + literal(name) + ',ARRAY[' + literal(raw) + ']::text[]);\n')
    return ('BEGIN;\nSET LOCAL lock_timeout=\'5s\';\nSET LOCAL statement_timeout=\'120s\';\n' + guard
            + body(raw) + '\n' + body((BASE / 'barrier/extend.sql').read_text())
            + '\n' + body((BASE / 'barrier/verify.sql').read_text(), 'BEGIN READ ONLY;')
            + '\n' + insert + 'COMMIT;\n')
