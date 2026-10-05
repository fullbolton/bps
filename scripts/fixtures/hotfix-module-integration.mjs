import assert from 'node:assert/strict';
import {entries as operations} from '../operations-module-gates.mjs';
import {entries as talent,source} from '../talent-module-gates.mjs';
import {entries as reporting} from '../reporting-module-gates.mjs';
import {sqlFile,workspace} from './module-database.mjs';
export async function installModuleGuards(db,signatures){
 if(process.env.BPS_TEST_MODULE_GUARDS!=='1')return;
 await db.query(workspace);
 await db.query(sqlFile('20261005000100_tenant_module_foundation.sql'));
 for(const [name,file] of [['workspace_require_module_write_v1','20261005000200_task_module_gateway.sql'],['workspace_require_module_read_v1','20261005002200_talent_module_rpc_gates.sql']])await db.query(source(name,file,'write').declaration);
 const gates=new Map([...operations,...talent,...reporting].map(e=>[e.signature,e]));
 for(const signature of signatures){const e=gates.get(signature);if(!e)continue;
  const row=(await db.query('SELECT prosrc,pg_get_functiondef(oid) def FROM pg_proc WHERE oid=$1::regprocedure',[signature])).rows[0];
  const baseline=e.preHotfixBody??e.body;assert.equal(row.prosrc,baseline);await db.query(row.def.replace(baseline,()=>baseline.replace(e.anchor,()=>e.anchor+e.guard)));
 }
}
export async function assertGuardsRetained(db,signatures){
 if(process.env.BPS_TEST_MODULE_GUARDS!=='1')return;
 const gates=new Map([...operations,...talent,...reporting].map(e=>[e.signature,e]));
 for(const signature of signatures){const e=gates.get(signature);if(!e)continue;
  assert.ok((await db.query('SELECT prosrc FROM pg_proc WHERE oid=$1::regprocedure',[signature])).rows[0].prosrc.includes(e.guard),signature);
  await db.query('BEGIN');
  try {
   await db.query('UPDATE tenant_module_settings SET enabled=false');
   await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:'00000000-0000-4000-8000-000000000011',active_tenant_id:'00000000-0000-4000-8000-000000000001'})]);
   await db.query('SET LOCAL ROLE authenticated');
   const [name,types]=signature.split('('),args=types.slice(0,-1).split(',').map((t,i)=>i<2?`'00000000-0000-4000-8000-${i===0?'000000000011':'000000000001'}'::uuid`:`NULL::${t}`);
   await assert.rejects(db.query(`SELECT ${name}(${args.join(',')})`),error=>error.code==='BM001',signature);
  } finally {await db.query('ROLLBACK');}
 }
}
