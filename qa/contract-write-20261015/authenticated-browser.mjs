// Local synthetic acceptance only. Never imports production environment files.
import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {openSync,closeSync} from 'node:fs';
export async function serve({docker,sql,run,source,network,database,password,secret,anon,service,restBase,storageBase,id,pdf}){
 const auth='bps-browser-auth-'+process.pid,authDatabase='bps_browser_auth_'+process.pid;let server,app,authCreated=false;
 try{
  // Fresh official Auth migrations; do not fabricate a ledger for a schema dump.
  sql(`CREATE DATABASE ${authDatabase} TEMPLATE template0;`,'postgres');authCreated=true;
  sql(`GRANT CREATE ON DATABASE ${authDatabase} TO supabase_auth_admin;`,'postgres');
  sql(`CREATE SCHEMA auth; GRANT ALL ON SCHEMA auth TO supabase_auth_admin; CREATE TABLE public.workspace_selections(user_id uuid PRIMARY KEY,tenant_id uuid,version uuid,command_id uuid,changed_at timestamptz);
CREATE TABLE public.tenant_memberships(user_id uuid,tenant_id uuid,version uuid);`,authDatabase);
  sql(`INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES('${id(11)}','${id(2)}','yonetici') ON CONFLICT(user_id,tenant_id) DO NOTHING;`);
  function syncAuthScope(){
   // One source statement snapshot, atomically replace only synthetic hook fixtures.
   const inserts=sql(`SELECT coalesce((SELECT string_agg(format('INSERT INTO public.tenant_memberships VALUES(%L,%L,%L);',user_id,tenant_id,version),'') FROM tenant_memberships WHERE user_id='${id(11)}'),'') || coalesce((SELECT string_agg(format('INSERT INTO public.workspace_selections VALUES(%L,%L,%L,%L,%L);',user_id,tenant_id,version,command_id,changed_at),'') FROM workspace_selections WHERE user_id='${id(11)}'),'');`);
   sql('BEGIN;TRUNCATE public.tenant_memberships,public.workspace_selections;'+inserts+'COMMIT;',authDatabase);
  }
  syncAuthScope();
  const hook=sql("SELECT pg_get_functiondef('public.custom_access_token_hook(jsonb)'::regprocedure);");
  sql(hook+`;REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC;GRANT USAGE ON SCHEMA public TO supabase_auth_admin;GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;`,authDatabase);
  run(auth,'public.ecr.aws/supabase/gotrue:v2.186.0',{
   GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:'http://127.0.0.1:3061/auth/v1',GOTRUE_SITE_URL:'http://127.0.0.1:3060',
   GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:`postgres://supabase_auth_admin:${encodeURIComponent(password)}@${source}:5432/${authDatabase}`,
   GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',
   GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'true',GOTRUE_DISABLE_SIGNUP:'true',
   GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED:'true',GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI:'pg-functions://postgres/public/custom_access_token_hook'
  },9999);
  let authPort;try{authPort=docker(['port',auth,'9999/tcp']).split(':').at(-1);}catch{const l=spawnSync('docker',['logs','--tail','4',auth],{encoding:'utf8'});throw Error('Auth startup: '+l.stdout+l.stderr);}
  const authBase='http://127.0.0.1:'+authPort;
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(authBase+'/health',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  if(!ready){const log=spawnSync('docker',['logs','--tail','4',auth],{encoding:'utf8'});throw Error('Local Auth readiness failed: '+log.stdout+log.stderr);}
  const loginPassword='Synthetic-BPS-Only-2026!';
  const update=await fetch(authBase+'/admin/users',{method:'POST',headers:{Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({id:id(11),password:loginPassword,email:'document-qa@example.test',email_confirm:true})});
  if(!update.ok)throw Error('Synthetic Auth user setup failed: '+await update.text());
  server=http.createServer((req,res)=>{
   if(req.method==='POST' && req.url.startsWith('/auth/v1/token')){
    try{syncAuthScope();}catch{res.writeHead(503);res.end('Synthetic Auth scope sync failed');return;}
   }
   res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:3060');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE,OPTIONS');
   if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
   const mapping=[['/auth/v1',authBase],['/rest/v1',restBase],['/storage/v1',storageBase]].find(([prefix])=>req.url.startsWith(prefix));
   if(!mapping){res.writeHead(404);res.end();return;}
   const target=new URL(mapping[1]+req.url.slice(mapping[0].length));
   const proxy=http.request(target,{method:req.method,headers:{...req.headers,host:target.host}},up=>{res.writeHead(up.statusCode,up.headers);up.pipe(res);});
   proxy.on('error',()=>{res.writeHead(502);res.end();});req.pipe(proxy);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(3061,'127.0.0.1',resolve);});
  const login=await fetch(authBase+'/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'document-qa@example.test',password:loginPassword})});
  if(!login.ok)throw Error('Local password sign-in failed: '+await login.text());
  const session=await login.json();const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url'));
  if(claims.active_tenant_id!==id(1))throw Error('Local Auth hook did not supply tenant');
  // Two recoverable attempts for actual server-action acceptance.
  for(const n of [9101,9102]){
   const prepared=await fetch(restBase+'/rpc/document_prepare_upload_v1',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_id:id(n),p_tenant:id(1),p_company:id(991),p_name:n===9101?'Tarayıcı kurtarma':'Tarayıcı iptal',p_category:'diger',p_validity:null,p_size:pdf.length})});
   if(!prepared.ok)throw Error('Browser pending seed failed');
   const path=await prepared.json();
   if(n===9101){const up=await fetch(storageBase+'/object/documents/'+path,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/pdf'},body:pdf});if(!up.ok)throw Error('Browser pending bytes seed failed');}
  }
  const out=openSync('/tmp/bps-authenticated-next.log','w',0o600);
  app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3060'],{cwd:process.cwd(),env:{...process.env,NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3061',NEXT_PUBLIC_SUPABASE_ANON_KEY:anon},stdio:['ignore',out,out]});closeSync(out);
  console.log('LOCAL_BROWSER_READY http://127.0.0.1:3060/login — synthetic document-qa@example.test');
  await new Promise(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);app.once('exit',resolve);});
 }finally{if(app){app.kill('SIGTERM');await new Promise(r=>app.exitCode!==null?r():app.once('exit',r));}if(server)await new Promise(r=>server.close(r));try{docker(['rm','-f',auth]);}catch{}if(authCreated)sql(`DROP DATABASE ${authDatabase} WITH (FORCE);`,'postgres');}
}
