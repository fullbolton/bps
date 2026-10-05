import {fileURLToPath} from 'node:url';
import {spawnSync}from'node:child_process';import{writeFileSync}from'node:fs';import assert from'node:assert/strict';
const base=fileURLToPath(new URL('../../../',import.meta.url)).replace(/\/$/,'');
const {entries:operations}=await import(base+'/scripts/operations-module-gates.mjs');const{entries:talent}=await import(base+'/scripts/talent-module-gates.mjs');const{entries:reporting}=await import(base+'/scripts/reporting-module-gates.mjs');
const container='supabase_db_bps-supabase-acceptance',database='bps_module_chain_20261005';const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sql=text=>spawnSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-U','postgres','-d',database],{input:text,encoding:'utf8'});
const ok=text=>{const r=sql(text);assert.equal(r.status,0,r.stderr);return r.stdout.trim()};
const claims=`SELECT set_config('request.jwt.claims','${JSON.stringify({sub:id(11),active_tenant_id:id(1)})}',true);SET LOCAL ROLE authenticated;`;
const checks=[];function check(name,fn){fn();checks.push(name);console.log('PASS',name)}
check('existing tenants each receive 10 enabled modules',()=>assert.equal(ok('SELECT count(*) FROM (SELECT tenant_id FROM tenant_module_settings GROUP BY tenant_id HAVING count(*)=10 AND bool_and(enabled))s'),'2'));
check('new tenant provisions 10 modules atomically',()=>assert.equal(ok(`BEGIN;INSERT INTO tenants(id,slug,name) VALUES('${id(3)}','synthetic-chain-c','Synthetic C');SELECT count(*) FROM tenant_module_settings WHERE tenant_id='${id(3)}';ROLLBACK;`),'10'));
check('actual Auth profile trigger created both synthetic profiles',()=>assert.equal(ok(`SELECT count(*) FROM profiles WHERE id IN ('${id(11)}','${id(12)}') AND NOT is_platform_admin`),'2'));
check('actual workspace context resolves tenant-scoped module settings',()=>{const lines=ok(`BEGIN;${claims}SELECT current_workspace_modules_v1();ROLLBACK;`).split('\n');const r=JSON.parse(lines.at(-1));assert.equal(r.tenantId,id(1));assert.equal(Object.keys(r.modules).length,10);assert.ok(Object.values(r.modules).every(x=>x===true))});
for(const e of [...operations,...talent,...reporting])check('disabled '+e.name,()=>{
 const [name,signature]=e.signature.split('(');const types=signature.slice(0,-1).split(',');const args=types.map((t,i)=>i<2?`'${id(i===0?11:1)}'::uuid`:`NULL::${t}`);
 const r=sql(`BEGIN;UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}';${claims}SELECT ${name}(${args.join(',')});ROLLBACK;`);assert.notEqual(r.status,0);assert.match(r.stderr,/BM001/,r.stderr);
});
const hidden=['talent_import_prepare_v1(uuid,uuid,uuid,text,jsonb)','talent_call_list_people_base(uuid,uuid,uuid)','talent_conversation_list_base(uuid,uuid,uuid,integer)','ops_comment_context(uuid,uuid)','ops_replace_assignment_before_start(uuid,uuid,uuid,uuid,uuid,integer)','reporting_assert_scope(uuid,uuid,boolean)','reporting_import_validate(uuid,uuid,date,text,jsonb)'];
check('7 private helpers have no browser or service execution',()=>{for(const sig of hidden)assert.equal(ok(`SELECT bool_or(has_function_privilege(r,'public.${sig}','EXECUTE')) FROM unnest(ARRAY['anon','authenticated','service_role'])r`),'f')});
check('foreign tenant claim fails with actual membership verification',()=>{const r=sql(`BEGIN;SELECT set_config('request.jwt.claims','${JSON.stringify({sub:id(11),active_tenant_id:id(2)})}',true);SET LOCAL ROLE authenticated;SELECT current_workspace_modules_v1();`);assert.notEqual(r.status,0);assert.match(r.stderr,/42501/)});
writeFileSync(base+'/qa/module-chain-20261005/smoke.json',JSON.stringify({checks,passed:checks.length},null,2)+'\n');
