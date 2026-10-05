import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=f=>readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8');
export function extract(file,name,signature){const sql=read(file),start=sql.indexOf('CREATE FUNCTION public.'+name+'('),b=sql.indexOf('AS $$',start)+5,e=sql.indexOf('$$;',b);if(start<0||b<5||e<b)throw Error(name+' source missing');return {signature,body:sql.slice(b,e),declaration:sql.slice(start,e+3)};}
const source='20260928000200_project_reporting_actual_import.sql';
export const entries=[
 extract(source,'reporting_import_validate','public.reporting_import_validate(uuid,uuid,date,text,jsonb)'),
 extract(source,'reporting_person_code_set','public.reporting_person_code_set(uuid,uuid,uuid,integer,text,text,uuid)'),
 extract(source,'reporting_import_prepare','public.reporting_import_prepare(uuid,uuid,uuid,uuid,text,text,jsonb)'),
 extract(source,'reporting_import_finish','public.reporting_import_finish(uuid,uuid,uuid,boolean)'),
 extract(source,'reporting_import_people','public.reporting_import_people(uuid,uuid,uuid,text,text[],text)'),
 extract('20260928000300_project_reporting_monthly_report.sql','reporting_monthly_report','public.reporting_monthly_report(uuid,uuid,uuid,text,integer)'),
 extract('20260928000400_project_reporting_work_details.sql','reporting_work_details','public.reporting_work_details(uuid,uuid,uuid,text,uuid,integer)'),
 extract('20260927000500_pool_merge_and_contacts.sql','talent_merge_apply','public.talent_merge_apply(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,boolean,boolean)')
];
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Reporting patch anchor drift: '+a);return s.replace(a,()=>b);};
const canonical=expr=>`public.talent_canonical_person(p_tenant,${expr})`;
export const patched=entries.map((entry,i)=>{
 let body=entry.body;
 if(i===0){
  body=once(body,'SELECT m.person_id,p.name','SELECT p.id,p.name');
  body=once(body,'p.id=m.person_id','p.id='+canonical('m.person_id'));
  body=once(body,'item.person_id<>person',canonical('item.person_id')+' IS DISTINCT FROM person');
  body=once(body,'AND person_id=person AND day=', 'AND '+canonical('person_id')+'=person AND day=');
 }
 if(i===1){
  body=once(body,' PERFORM 1 FROM public.talent_people p WHERE', ' p_person:='+canonical('p_person')+';\n PERFORM 1 FROM public.talent_people p WHERE');
  body=once(body,'AND person_id=p_person)', 'AND '+canonical('person_id')+'=p_person)');
 }
 if([1,2,3].includes(i)){
  body=once(body,' PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);',` PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'REPORT_CONFLICT';END IF;
 -- Serialize identity resolution against merge before taking project/person locks.
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('bps:reporting-merge:'||p_tenant::text,0));`);
 }
 if(i===4)body=once(body,'p.id=m.person_id','p.id='+canonical('m.person_id'));
 if(i===5){body=once(body,'count(DISTINCT person_id)','count(DISTINCT '+canonical('person_id')+')');body=once(body,'count(DISTINCT a.person_id)','count(DISTINCT '+canonical('a.person_id')+')');}
 if(i===6){body=once(body,'a.person_id AS "personId"','p.id AS "personId"');body=once(body,'p.id=a.person_id','p.id='+canonical('a.person_id'));body=once(body,'ORDER BY a.day DESC,a.person_id,','ORDER BY a.day DESC,p.id,');}
 if(i===7)body=once(body,' -- Worker before person,',` -- Do not wait while a reporting writer may need a person row held by this transaction.
 IF NOT pg_try_advisory_xact_lock(hashtextextended('bps:reporting-merge:'||p_tenant::text,0)) THEN RAISE EXCEPTION 'TALENT_MERGE_BUSY';END IF;
 -- Worker before person,`);
 return {...entry,patchedBody:body};
});
const q=s=>"'"+s.replaceAll("'","''")+"'";
export const migrationUrl=new URL('../supabase/migrations/20261004001400_reporting_canonical_people.sql',import.meta.url);
export function render(){return `-- Resolve reporting identities without rewriting approved source records.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE r record;target regprocedure;original text;definition text;
BEGIN
 IF to_regprocedure('public.talent_canonical_person(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'REPORT_CANONICAL_MISSING';END IF;
 FOR r IN SELECT * FROM (VALUES
${patched.map(e=>'('+[e.signature,createHash('sha256').update(e.body).digest('hex'),e.patchedBody].map(q).join(',')+')').join(',\n')}
 ) AS changes(signature,expected_hash,new_body) LOOP
  target:=to_regprocedure(r.signature);
  IF target IS NULL THEN RAISE EXCEPTION 'REPORT_MERGE_SIGNATURE_MISSING: %',r.signature;END IF;
  SELECT prosrc INTO original FROM pg_proc WHERE oid=target;
  IF encode(sha256(convert_to(original,'UTF8')),'hex')<>r.expected_hash THEN RAISE EXCEPTION 'REPORT_MERGE_SOURCE_DRIFT: %',r.signature;END IF;
  definition:=pg_get_functiondef(target);
  IF strpos(definition,original)=0 THEN RAISE EXCEPTION 'REPORT_MERGE_DEFINITION_DRIFT';END IF;
  EXECUTE replace(definition,original,r.new_body);
 END LOOP;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
`;}
if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){if(process.argv.includes('--check')){if(readFileSync(migrationUrl,'utf8')!==render())throw Error('Reporting merge migration drift');}else writeFileSync(migrationUrl,render());}
