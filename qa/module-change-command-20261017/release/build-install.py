"""Emit this exact reviewed three-migration transaction; never connects to production."""
from pathlib import Path
import json, hashlib, re
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
plan=json.loads((HERE/'preflight-plan.json').read_text())
def literal(value): return "'"+value.replace("'","''")+"'"
def build():
    versions=plan['versions']
    assert len(versions)==182 and len(plan['pending'])==3
    parts=["BEGIN; SET LOCAL lock_timeout='15s'; SET LOCAL statement_timeout='60s';",
           'LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;',
           "DO $ledger$ BEGIN IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY["+','.join(map(literal,versions))+ "]::text[] THEN RAISE EXCEPTION 'MODULE_RELEASE_LEDGER_DRIFT'; END IF; END $ledger$;"]
    for item in plan['pending']:
        raw=(ROOT/'supabase/migrations'/item['file']).read_bytes()
        assert hashlib.sha256(raw).hexdigest()==item['sha256'], 'Migration hash drift'
        sql=raw.decode(); lines=sql.splitlines()
        # Fixed reviewed files only; refuse different transaction layout.
        assert sum(line=='BEGIN;' for line in lines)==1
        assert sum(line=='COMMIT;' for line in lines)==1 and lines[-1]=='COMMIT;'
        body='\n'.join(line for line in lines if line not in ['BEGIN;','COMMIT;'])
        version,name=item['file'][:-4].split('_',1)
        assert re.fullmatch(r'\d{14}',version)
        parts += [body, 'INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('+literal(version)+','+literal(name)+',ARRAY['+literal(sql)+']);']
    parts += ["NOTIFY pgrst,'reload schema';",'COMMIT;']
    return '\n'.join(parts)+'\n'
if __name__=='__main__':
    output=build();(HERE/'install.sql').write_text(output)
    print(json.dumps({'migrations':3,'sha256':hashlib.sha256(output.encode()).hexdigest(),'productionExecuted':False}))
