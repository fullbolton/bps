import test from 'node:test';import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{readFileSync}from'node:fs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {blockedPersonCode}=await importActualTypeScript(new URL('../src/lib/project-reporting/person-code.ts',import.meta.url));
const sql=q=>execFileSync('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe']});
const migration=readFileSync('supabase/migrations/20260928000700_reporting_person_code_guard.sql','utf8').replace(/^BEGIN;/m,'').replace(/COMMIT;\s*$/,'');
const setup=`CREATE TABLE public.reporting_person_codes(code text);CREATE TABLE public.reporting_person_code_events(code text);CREATE TABLE public.reporting_imports(rows jsonb,resolved jsonb,previous_rows jsonb);`;
function guard(){assert.equal(sql("select obj_description('public.tasks'::regclass)").trim(),'BPS synthetic task-prefill fixture v1');assert.equal(sql("select to_regclass('public.reporting_imports') is null").trim(),'t');}
test('SQL and application rules agree on Unicode spacing and ordinary codes',()=>{
 guard();const values=['007','P-00000000000','000000000000',...'\t\n\r\f\v \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff'.split('').map(c=>'00000'+c+'000000'),'０００００００００００'];
 const rows=values.map(v=>Buffer.from(v).toString('hex')).map(h=>`(convert_from(decode('${h}','hex'),'UTF8'))`).join(',');
 const result=sql(`BEGIN;${setup}${migration}SELECT public.reporting_person_code_is_private(v) FROM (VALUES ${rows}) x(v);ROLLBACK;`).trim().split('\n');
 assert.deepEqual(result,values.map(v=>blockedPersonCode(v)?'t':'f'));
});
test('existing prohibited code aborts the migration without installing any guard',()=>{
 guard();const result=sql(`BEGIN;${setup}INSERT INTO reporting_person_codes VALUES('00000000000');DO $test$ DECLARE caught boolean:=false;BEGIN BEGIN EXECUTE $migration$${migration}$migration$;EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'REPORT_PERSON_CODE_EXISTING:%' THEN RAISE;END IF;caught:=true;END;IF NOT caught OR to_regprocedure('public.reporting_person_code_is_private(text)') IS NOT NULL THEN RAISE EXCEPTION 'Preflight failed to roll back';END IF;END $test$;SELECT count(*) FROM reporting_person_codes;ROLLBACK;`);
 assert.equal(result.trim(),'1');
});
