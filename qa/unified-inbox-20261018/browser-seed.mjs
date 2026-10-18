// Only the disposable storage-http browser fixture. Never accepts a production URL.
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const database=process.argv[2];if(!/^bps_storage_http_\d+$/.test(database??''))throw Error('Local fixture DB required');
const pg=createRequire(import.meta.url)('pg');
const password=execFileSync('docker',['exec','supabase_db_bps-supabase-acceptance','printenv','POSTGRES_PASSWORD'],{encoding:'utf8'}).trim();
const c=new pg.Client({host:'127.0.0.1',port:54322,user:'postgres',password,database});
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await c.connect();
try{
 await c.query("INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES($1,$2,'yonetici') ON CONFLICT(user_id,tenant_id) DO UPDATE SET role='yonetici'",[id(12),id(1)]);
 await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(12),role:'authenticated'})]);
 const member=(await c.query('select version from tenant_memberships where user_id=$1 and tenant_id=$2',[id(12),id(1)])).rows[0].version;
 const selected=(await c.query('select version from workspace_selections where user_id=$1',[id(12)])).rows[0]?.version??null;
 const choice=(await c.query('select select_workspace($1,$2,gen_random_uuid(),$3) v',[id(1),member,selected])).rows[0].v;
 await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(12),active_tenant_id:id(1),role:'authenticated',workspace_membership_version:choice.membershipVersion,workspace_selection_version:choice.selectionVersion})]);
 await c.query('SET ROLE authenticated');
 for(let i=0;i<31;i++)await c.query("select * from announcement_execute_v1('create',null,$1,$2)",[id(1),`Sentetik duyuru ${i+1}: Sabah ekip toplantısı saat 09.00.\nTüm metin burada okunur; bu yalnızca yerel kabul verisidir.`]);
 await c.query("select * from task_execute_v1('create',null,null,$1,$2,$3)",[{title:'Sentetik bildirim görevini kontrol et',assigned_to_user_id:id(11)},id(1),id(12)]);
 console.log('Seeded 31 announcements and 1 assigned task through real commands');
}finally{await c.end();}
