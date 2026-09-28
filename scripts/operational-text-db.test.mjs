import test from 'node:test';import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{readFileSync}from'node:fs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {hasPrivateOperationalText}=await importActualTypeScript(new URL('../src/lib/privacy/operational-text.ts',import.meta.url));
const sql=q=>execFileSync('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe']});
const migration=readFileSync('supabase/migrations/20260928000800_operational_text_guard.sql','utf8').replace(/^BEGIN;/m,'').replace(/COMMIT;\s*$/,'');
const setup=`CREATE TABLE public.talent_conversations(note text);CREATE TABLE public.ops_replacement_outreach(note text);CREATE TABLE public.ops_work_records(note text);CREATE TABLE public.ops_work_record_events(reason text,snapshot jsonb);`;
function guard(){assert.equal(sql("select obj_description('public.tasks'::regclass)").trim(),'BPS synthetic task-prefill fixture v1');assert.equal(sql("select to_regclass('public.ops_work_records') is null").trim(),'t');}
test('SQL matcher agrees with application on number forms and ordinary operations text',()=>{
 guard();const values=['', '0500 000 00 00','+90 (500) 000 00 00','5000000000','00000000000','28.09.2026 14:30','480 dakika; 2 kişi','1.500,00 TL','00000000-0000-4000-8000-000000000001','123456789012345','500/000/00/00','500\n000\n00\n00',...'\t\n\r \u00a0\u2000\u202f\ufeff'.split('').map(c=>'0500'+c+'0000000'),'０００００００００００'];
 const rows=values.map(v=>Buffer.from(v).toString('hex')).map(h=>`(convert_from(decode('${h}','hex'),'UTF8'))`).join(',');
 const result=sql(`BEGIN;${setup}${migration}SELECT public.operational_text_is_private(v) FROM (VALUES ${rows}) x(v);ROLLBACK;`).trim().split('\n');
 assert.deepEqual(result,values.map(v=>hasPrivateOperationalText(v)?'t':'f'));
});
test('all five storage boundaries reject insert; updates and audit snapshot are also guarded',()=>{
 guard();const rejected=["INSERT INTO talent_conversations VALUES ('00000000000')","INSERT INTO ops_replacement_outreach VALUES ('00000000000')","INSERT INTO ops_work_records VALUES ('00000000000')","INSERT INTO ops_messages(body) VALUES ('00000000000')","INSERT INTO ops_work_record_events VALUES ('00000000000','{}')",`INSERT INTO ops_work_record_events VALUES ('düzeltme','{"note":"0500 000 00 00"}')`,"UPDATE ops_work_records SET note='00000000000'"];
 const assertions=rejected.map(q=>`DO $test$ BEGIN BEGIN ${q};RAISE EXCEPTION 'unexpected success';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'OPERATION_TEXT_PRIVATE' THEN RAISE;END IF;END;END $test$;`).join('\n');
 assert.equal(sql(`BEGIN;${setup}${migration}INSERT INTO ops_work_records VALUES ('28.09.2026 14:30 görüşme');${assertions}SELECT note FROM ops_work_records;ROLLBACK;`).trim(),'28.09.2026 14:30 görüşme');
});
test('preflight conflict rolls back the complete migration and leaves historical row untouched',()=>{
 guard();const result=sql(`BEGIN;${setup}INSERT INTO talent_conversations VALUES('00000000000');DO $test$ DECLARE caught boolean:=false;BEGIN BEGIN EXECUTE $migration$${migration}$migration$;EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'OPERATION_TEXT_EXISTING:%' THEN RAISE;END IF;caught:=true;END;IF NOT caught OR to_regprocedure('public.operational_text_is_private(text)') IS NOT NULL THEN RAISE EXCEPTION 'Preflight failed to roll back';END IF;END $test$;SELECT count(*) FROM talent_conversations WHERE note='00000000000';ROLLBACK;`);
 assert.equal(result.trim(),'1');
});
