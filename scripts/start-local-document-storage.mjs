// Start only the missing dedicated Storage container; never restart/reset the database.
// Environment names follow Supabase's docker-compose Storage service. No keys logged.
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {validateLocalStatus,acquireLock} from './helpers/acceptance-runner.mjs';
const run=(cmd,args)=>{try{return execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:20000});}catch{throw Error(cmd+' local setup failed');}};
const name='supabase_storage_bps-supabase-acceptance',image='public.ecr.aws/supabase/storage-api:v1.35.3';
let release,dir;
try{
 const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
 const [db,gateway,auth,rest]=JSON.parse(run('docker',['inspect','supabase_db_bps-supabase-acceptance','supabase_kong_bps-supabase-acceptance','supabase_auth_bps-supabase-acceptance','supabase_rest_bps-supabase-acceptance']));
 validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),db,gateway);release=acquireLock();
 assert.equal(run('docker',['exec','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','postgres','-At','-c',"SELECT obj_description(to_regclass('public.documents'))='BPS synthetic documents fixture v1'"]).trim(),'t');
 const network=Object.keys(db.NetworkSettings.Networks);assert.equal(network.length,1);assert.ok(network[0].includes('bps-supabase-acceptance'));
 const exists=run('docker',['ps','-a','--format','{{.Names}}']).trim().split('\n').includes(name);
 if(exists){const [old]=JSON.parse(run('docker',['inspect',name]));assert.equal(old.Config.Image,image);assert.ok(old.NetworkSettings.Networks[network[0]]);assert.deepEqual(old.HostConfig.PortBindings,{});if(!old.State.Running)run('docker',['start',name]);console.log('Dedicated Storage already configured.');}
 else{
  const env=c=>Object.fromEntries(c.Config.Env.map(line=>{const at=line.indexOf('=');return [line.slice(0,at),line.slice(at+1)];}));
  const ae=env(auth),de=env(db),re=env(rest);assert.ok(ae.GOTRUE_JWT_SECRET);assert.ok(de.POSTGRES_PASSWORD);
  const database=new URL('postgresql://supabase_storage_admin@supabase_db_bps-supabase-acceptance:5432/postgres');database.password=de.POSTGRES_PASSWORD;
  const values={ANON_KEY:s.ANON_KEY,SERVICE_KEY:s.SERVICE_ROLE_KEY,AUTH_JWT_SECRET:ae.GOTRUE_JWT_SECRET,PGRST_JWT_SECRET:ae.GOTRUE_JWT_SECRET,POSTGREST_URL:'http://supabase_rest_bps-supabase-acceptance:3000',DATABASE_URL:database.toString(),FILE_SIZE_LIMIT:'10485760',STORAGE_BACKEND:'file',FILE_STORAGE_BACKEND_PATH:'/var/lib/storage',GLOBAL_S3_BUCKET:'stub',TENANT_ID:'stub',REGION:'local',ENABLE_IMAGE_TRANSFORMATION:'false',PORT:'5000'};
  if(re.PGRST_JWT_SECRET?.startsWith('{'))values.JWT_JWKS=re.PGRST_JWT_SECRET;
  for(const v of Object.values(values))assert.ok(typeof v==='string'&&!v.includes('\n'));
  dir=mkdtempSync(join(tmpdir(),'bps-storage-env-'));const file=join(dir,'env');writeFileSync(file,Object.entries(values).map(([k,v])=>k+'='+v).join('\n'),{mode:0o600});
  run('docker',['run','-d','--name',name,'--network',network[0],'--network-alias',name,'--label','com.supabase.cli.project=bps-supabase-acceptance','--env-file',file,'--mount','type=volume,source=bps_document_storage_acceptance,target=/var/lib/storage',image]);
  console.log('Dedicated Storage started on internal Docker network; no host port published.');
 }
}catch(error){console.error(error.message);process.exitCode=1;}
finally{release?.();if(dir)rmSync(dir,{recursive:true,force:true});}
