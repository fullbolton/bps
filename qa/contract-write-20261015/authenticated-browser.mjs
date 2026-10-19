// Local synthetic acceptance only. Never imports production environment files.
import http from 'node:http';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {openSync,closeSync,existsSync,mkdirSync,writeFileSync,readFileSync,rmSync,mkdtempSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export async function serve({docker,sql,run,source,network,database,password,secret,anon,service,rest,restBase,storageBase,id,pdf}){
 const moduleRoute='src/app/qa-module-acceptance';let moduleRouteCreated=false;
 const scopeActors=process.env.BPS_OPS_ROLE_HTTP==='1'?[11,9511,9512,9513,9514]:[11];
 const auth='bps-browser-auth-'+process.pid,authDatabase='bps_browser_auth_'+process.pid;let server,app,authCreated=false,releaseAppRoot;
 let appRoot=process.cwd();
 try{
  if(process.env.BPS_BROWSER_RELEASED_SOURCE==='1'){
   if(process.env.BPS_BROWSER_MODULES==='1'||process.env.BPS_HR_PREVIEW_ENABLED==='true')throw Error('Rollback browser must keep preview closed and avoid injected module routes');
   const release=JSON.parse(readFileSync(new URL('../hr-release-20261019/remaining/release.json',import.meta.url)));
   if(!/^[a-f0-9]{40}$/.test(release.sourceCommit))throw Error('Invalid released commit');
   const oldLock=execFileSync('git',['show',release.sourceCommit+':package-lock.json'],{encoding:'utf8'});
   if(oldLock!==readFileSync('package-lock.json','utf8'))throw Error('Released dependency lock differs; separate installation needed');
   releaseAppRoot=mkdtempSync(join(tmpdir(),'bps-browser-rollback-'));
   const archive=execFileSync('git',['archive',release.sourceCommit,'src','public','package.json','package-lock.json','next.config.ts','postcss.config.mjs','tsconfig.json'],{maxBuffer:64*1024*1024});
   execFileSync('tar',['-x','-C',releaseAppRoot],{input:archive});
   symlinkSync(join(process.cwd(),'node_modules'),join(releaseAppRoot,'node_modules'),'dir');appRoot=releaseAppRoot;
   console.log('LOCAL_BROWSER_RELEASED_SOURCE '+release.sourceCommit);
  }
  // Fresh official Auth migrations; do not fabricate a ledger for a schema dump.
  sql(`CREATE DATABASE ${authDatabase} TEMPLATE template0;`,'postgres');authCreated=true;
  sql(`GRANT CREATE ON DATABASE ${authDatabase} TO supabase_auth_admin;`,'postgres');
  sql(`CREATE SCHEMA auth; GRANT ALL ON SCHEMA auth TO supabase_auth_admin; CREATE TABLE public.workspace_selections(user_id uuid PRIMARY KEY,tenant_id uuid,version uuid,command_id uuid,changed_at timestamptz);
CREATE TABLE public.tenant_memberships(user_id uuid,tenant_id uuid,version uuid);`,authDatabase);
  sql(`INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES('${id(11)}','${id(2)}','yonetici') ON CONFLICT(user_id,tenant_id) DO NOTHING;`);
  function syncAuthScope(){
   // One source statement snapshot, atomically replace only synthetic hook fixtures.
   const inserts=sql(`SELECT coalesce((SELECT string_agg(format('INSERT INTO public.tenant_memberships VALUES(%L,%L,%L);',user_id,tenant_id,version),'') FROM tenant_memberships WHERE user_id IN (${scopeActors.map(n=>`'${id(n)}'`).join(',')})),'') || coalesce((SELECT string_agg(format('INSERT INTO public.workspace_selections VALUES(%L,%L,%L,%L,%L);',user_id,tenant_id,version,command_id,changed_at),'') FROM workspace_selections WHERE user_id IN (${scopeActors.map(n=>`'${id(n)}'`).join(',')})),'');`);
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
  let authBase='http://127.0.0.1:'+authPort;
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(authBase+'/health',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  if(!ready){const log=spawnSync('docker',['logs','--tail','4',auth],{encoding:'utf8'});throw Error('Local Auth readiness failed: '+log.stdout+log.stderr);}
  const loginPassword='Synthetic-BPS-Only-2026!';
  const update=await fetch(authBase+'/admin/users',{method:'POST',headers:{Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({id:id(11),password:loginPassword,email:'document-qa@example.test',email_confirm:true})});
  if(!update.ok)throw Error('Synthetic Auth user setup failed: '+await update.text());
  if(process.env.BPS_HR_ACTIVATION_HTTP==='1'){
   const {acceptActivation}=await import('../hr-activation-readiness-20261019/activation-http.mjs');
   await acceptActivation({sql,id,authBase,restBase,loginPassword,syncAuthScope});
   return;
  }
  if(process.env.BPS_HR_TRANSFER_HTTP==='1'){
   const {acceptTransfer}=await import('../hr-activation-readiness-20261019/transfer-http.mjs');
   await acceptTransfer({sql,id,authBase,restBase,loginPassword,syncAuthScope});
   return;
  }
  if(process.env.BPS_OPS_ROLE_HTTP==='1'){
   const {acceptRoles}=await import('../operations-chain-20261018/role-http.mjs');
   await acceptRoles({sql,id,authBase,restBase,service,loginPassword,syncAuthScope});
   return;
  }
  if(process.env.BPS_AUTH_RESTORE_REHEARSAL==='1'){
   const {restoreAuthFixture}=await import('../synthetic-restore-20261018/auth-restore.mjs');
   authBase=await restoreAuthFixture({source,auth,authDatabase,authBase,sql,docker,loginPassword,userId:id(11),tenantId:id(1)});
   if(process.env.BPS_AUTH_RESTORE_HTTP_ONLY==='1')return;
  }
  const droppedHrResponses=new Set();
  const hrFaultRoutes=new Set(['/rest/v1/rpc/hr_import_commit_v1','/rest/v1/rpc/hr_employment_change_v1','/rest/v1/rpc/hr_employee_edit_v1','/rest/v1/rpc/hr_scoped_employee_create_v1','/rest/v1/rpc/hr_scoped_location_transfer_v1','/rest/v1/rpc/hr_access_activate_v1']);
  server=http.createServer((req,res)=>{
   if(req.method==='POST' && req.url.startsWith('/auth/v1/token')){
    try{syncAuthScope();}catch{res.writeHead(503);res.end('Synthetic Auth scope sync failed');return;}
   }
   // Next development redirects may canonicalize loopback to localhost.
   const allowedOrigins=['http://127.0.0.1:3060','http://localhost:3060'];
   if(allowedOrigins.includes(req.headers.origin))res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
   res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE,OPTIONS');
   if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
   const mapping=[['/auth/v1',authBase],['/rest/v1',restBase],['/storage/v1',storageBase]].find(([prefix])=>req.url.startsWith(prefix));
   if(!mapping){res.writeHead(404);res.end();return;}
   const target=new URL(mapping[1]+req.url.slice(mapping[0].length));
   const proxy=http.request(target,{method:req.method,headers:{...req.headers,host:target.host}},up=>{
    // Test-only: let PostgreSQL finish, consume the success, then lose the response.
    // Each route drops only once so retries exercise the server receipt, not a mock.
    if(process.env.BPS_HR_DROP_RESPONSE_ONCE==='1'&&req.method==='POST'&&hrFaultRoutes.has(req.url)&&!droppedHrResponses.has(req.url)&&up.statusCode>=200&&up.statusCode<300){
     droppedHrResponses.add(req.url);up.resume();up.on('end',()=>{console.log('LOCAL_HR_COMMITTED_RESPONSE_DROPPED '+req.url);res.writeHead(502,{'Content-Type':'text/plain'});res.end('Synthetic upstream response lost after commit');});return;
    }
    res.writeHead(up.statusCode,up.headers);up.pipe(res);
   });
   proxy.on('error',()=>{res.writeHead(502);res.end();});req.pipe(proxy);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(3061,'127.0.0.1',resolve);});
  const login=await fetch(authBase+'/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'document-qa@example.test',password:loginPassword})});
  if(!login.ok)throw Error('Local password sign-in failed: '+await login.text());
  const session=await login.json();const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url'));
  if(claims.active_tenant_id!==id(1))throw Error('Local Auth hook did not supply tenant');
  // Two recoverable attempts for actual server-action acceptance.
  for(const n of [9101,9102,9103]){
   const prepared=await fetch(restBase+'/rpc/document_prepare_upload_v1',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_id:id(n),p_tenant:id(1),p_company:id(991),p_name:n===9101?'Tarayıcı kurtarma':n===9102?'Tarayıcı iptal':'Dosyası yüklenmiş iptal',p_category:'diger',p_validity:null,p_size:pdf.length})});
   if(!prepared.ok)throw Error('Browser pending seed failed');
   const path=await prepared.json();
   if(n===9101 || n===9103){const up=await fetch(storageBase+'/object/documents/'+path,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/pdf'},body:pdf});if(!up.ok)throw Error('Browser pending bytes seed failed');}
  }
  if(process.env.BPS_BROWSER_PAGINATION==='1'){
   // Fill to exactly 51 through the real RPC; the final page then has one row.
   const count=Number(sql(`SELECT count(*) FROM document_upload_attempts a WHERE tenant_id='${id(1)}' AND published_at IS NULL AND NOT EXISTS(SELECT FROM document_cleanup_jobs j WHERE j.storage_path=a.storage_path);`));
   if(!Number.isInteger(count)||count<0||count>51)throw Error('Unexpected pagination fixture count');
   for(let n=0;n<51-count;n++){
    const prepared=await fetch(restBase+'/rpc/document_prepare_upload_v1',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_id:id(20000+n),p_tenant:id(1),p_company:id(991),p_name:`Sayfalama denemesi ${n+1}`,p_category:'diger',p_validity:null,p_size:pdf.length})});
    if(!prepared.ok)throw Error('Pagination fixture preparation failed: '+await prepared.text());
   }
   console.log('LOCAL_BROWSER_PAGINATION 51 pending uploads');
  }
  if(process.env.BPS_BROWSER_MODULES==='1'){
   if(existsSync(moduleRoute))throw Error('Local acceptance route already exists; refusing overwrite');
   sql(`UPDATE profiles SET role='yonetici' WHERE id='${id(11)}';`);
   sql('GRANT EXECUTE ON FUNCTION public.change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb) TO authenticated;');
   docker(['restart',rest]);
   restBase='http://127.0.0.1:'+docker(['port',rest,'3000/tcp']).split(':').at(-1);
   mkdirSync(moduleRoute);moduleRouteCreated=true;
   writeFileSync(moduleRoute+'/page.tsx',readFileSync(new URL('../module-change-command-20261017/browser-panel.tsx',import.meta.url)));
  }
  if(process.env.BPS_HR_TRANSFER_BROWSER==='1'){
   const {acceptTransfer}=await import('../hr-activation-readiness-20261019/transfer-http.mjs');
   await acceptTransfer({sql,id,authBase,restBase,loginPassword,syncAuthScope,browserSeed:true});
  }
  const out=openSync('/tmp/bps-authenticated-next.log','w',0o600);
  app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3060'],{cwd:appRoot,env:{...process.env,...(process.env.BPS_HR_PREVIEW_ENABLED==='true'?{SUPABASE_SERVICE_ROLE_KEY:service}:{}),NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3061',NEXT_PUBLIC_SUPABASE_ANON_KEY:anon},stdio:['ignore',out,out]});closeSync(out);
  console.log('LOCAL_BROWSER_READY http://127.0.0.1:3060/login — synthetic document-qa@example.test');
  await new Promise(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);app.once('exit',resolve);});
 }finally{if(moduleRouteCreated)rmSync(moduleRoute,{recursive:true});if(app){app.kill('SIGTERM');await new Promise(r=>app.exitCode!==null?r():app.once('exit',r));}if(releaseAppRoot)rmSync(releaseAppRoot,{recursive:true,force:true});if(server)await new Promise(r=>server.close(r));try{docker(['rm','-f',auth]);}catch{}if(authCreated)sql(`DROP DATABASE ${authDatabase} WITH (FORCE);`,'postgres');}
}
