import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const db=process.argv[2];assert.match(db??'',/^bps_storage_http_\d+$/);
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const commands=[[8801,'location',{companyId:id(991),name:'Faz 1 Şubesi',city:'İstanbul'}],[8802,'worker',{name:'Deniz Test',code:'QA-DENIZ',kind:'idp'}],[8810,'worker',{name:'Ece Test',code:'QA-ECE',kind:'idp'}]];
const q=`BEGIN;SELECT set_config('request.jwt.claims',(SELECT jsonb_build_object('sub',m.user_id,'active_tenant_id',m.tenant_id,'workspace_membership_version',m.version,'workspace_selection_version',s.version)::text FROM tenant_memberships m JOIN workspace_selections s ON s.user_id=m.user_id WHERE m.user_id='${id(11)}' AND m.tenant_id='${id(1)}'),true);SET LOCAL ROLE authenticated;`+commands.map(([n,k,p])=>`SELECT ops_execute_scoped('${id(11)}','${id(1)}','${id(n)}','${k}','${JSON.stringify(p)}'::jsonb);`).join('')+'COMMIT;';
execFileSync('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],{input:q,stdio:['pipe','ignore','pipe']});console.log('Synthetic directory prerequisites ready; no demands or assignments seeded.');
