/** Local acceptance orchestrator. No reset, deployment, push or production credentials. */
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {parseArgs,validateLocalStatus,acquireLock,buildSnapshot,isolatedBuildEnv,runProcess,writeReport,redact} from './helpers/acceptance-runner.mjs';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
let options;
try{options=parseArgs(process.argv.slice(2));}catch(e){console.error(e.message);process.exit(2);}
if(options.help){console.log('npm run qa:acceptance -- [--sql] [--local-api] [--build] [--all]\nDefault: runner tests, operations tests, legacy tests, static checks, TypeScript.\nSQL needs BPS_PGLITE_MODULE and BPS_EMBEDDED_PG_MODULE absolute files.\nLocal API requires existing dedicated synthetic Supabase. No database reset.\nBuild uses a temporary source copy without .env files; active dev server is untouched.\nReports/logs: private temporary directory; API diagnostic payloads are suppressed.');process.exit(0);}
const reportDir=mkdtempSync(join(tmpdir(),'bps-acceptance-'));
const controller=new AbortController();
const interrupt=()=>controller.abort();process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
const report={version:1,status:'running',startedAt:new Date().toISOString(),finishedAt:null,steps:[]};
const node=process.execPath;
const steps=[
  {id:'local-preflight',requested:options.localApi,special:'local'},
  {id:'runner-unit',requested:true,command:node,args:['--test','scripts/acceptance-runner.test.mjs']},
  {id:'operations-unit',requested:true,command:'npm',args:['run','qa:operations']},
  {id:'legacy-unit',requested:true,command:'npm',args:['run','qa:unit']},
  {id:'static',requested:true,command:'npm',args:['run','qa:static']},
  {id:'typescript',requested:true,command:node,args:['node_modules/typescript/bin/tsc','--noEmit']},
  {id:'pglite',requested:options.sql,command:node,args:['scripts/qa-daily-db.mjs'],module:'BPS_PGLITE_MODULE',timeout:180000},
  {id:'native-postgres',requested:options.sql,command:node,args:['scripts/qa-daily-concurrency.mjs'],module:'BPS_EMBEDDED_PG_MODULE',timeout:180000},
  {id:'task-postgres',requested:options.sql,command:node,args:['scripts/qa-task-concurrency.mjs'],module:'BPS_EMBEDDED_PG_MODULE',timeout:180000},
  {id:'appointment-postgres',requested:options.sql,command:node,args:['scripts/qa-appointment-concurrency.mjs'],module:'BPS_EMBEDDED_PG_MODULE',timeout:180000},
  {id:'transfer-postgres',requested:options.sql,command:node,args:['scripts/qa-task-transfer.mjs'],module:'BPS_EMBEDDED_PG_MODULE',timeout:180000},
  {id:'membership-guard-postgres',requested:options.sql,command:node,args:['scripts/qa-membership-task-guard.mjs'],module:'BPS_EMBEDDED_PG_MODULE',timeout:180000},
  {id:'contract-renewal-postgres',requested:options.sql,command:node,args:['scripts/qa-contract-renewal.mjs'],module:'BPS_EMBEDDED_PG_MODULE',timeout:180000},
  {id:'contract-pdf-postgres',requested:options.sql,command:node,args:['scripts/qa-contract-pdf.mjs'],module:'BPS_EMBEDDED_PG_MODULE',timeout:180000},
  {id:'pdf-upload-postgres',requested:options.sql,command:node,args:['scripts/qa-pdf-upload.mjs'],module:'BPS_EMBEDDED_PG_MODULE',timeout:180000},
  {id:'contract-appendices-postgres',requested:options.sql,command:node,args:['scripts/qa-contract-appendices.mjs'],module:'BPS_EMBEDDED_PG_MODULE',timeout:180000},
  {id:'dashboard-activity-postgres',requested:options.sql,command:node,args:['scripts/qa-dashboard-activity.mjs'],module:'BPS_EMBEDDED_PG_MODULE',timeout:120000},
  {id:'workspace-setup-postgres',requested:options.sql,command:node,args:['scripts/qa-workspace-setup.mjs'],module:'BPS_EMBEDDED_PG_MODULE',timeout:120000},
  {id:'workspace-invitations-postgres',requested:options.sql,command:node,args:['scripts/qa-workspace-invitations.mjs'],module:'BPS_EMBEDDED_PG_MODULE',timeout:120000},
  {id:'atomic-mizan-postgres',requested:options.sql,command:node,args:['scripts/qa-atomic-mizan.mjs'],module:'BPS_EMBEDDED_PG_MODULE',timeout:120000},
  {id:'start-tracking-postgres',requested:options.sql,command:node,args:['scripts/qa-start-tracking.mjs'],module:'BPS_EMBEDDED_PG_MODULE',timeout:120000},
  {id:'daily-dashboard-postgres',requested:options.sql,command:node,args:['scripts/qa-daily-dashboard.mjs'],module:'BPS_EMBEDDED_PG_MODULE',timeout:120000},
  {id:'invited-registration-postgres',requested:options.sql,command:node,args:['scripts/qa-invited-registration.mjs'],module:'BPS_EMBEDDED_PG_MODULE',timeout:120000},
  {id:'local-api',requested:options.localApi,command:node,args:['scripts/qa-local-network.mjs'],timeout:180000,summaryOnly:true},
  {id:'build',requested:options.build,special:'build',timeout:300000},
];
let release,failed=false;
const secrets=Object.entries(process.env).filter(([k])=>/(KEY|TOKEN|SECRET|PASSWORD)/i.test(k)).map(([,v])=>v);
function preflight(){
  const workdir='/private/tmp/bps-supabase-acceptance';
  const config=readFileSync(join(workdir,'supabase/config.toml'),'utf8');
  const cli=(name,args)=>execFileSync(name,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000,maxBuffer:2_000_000});
  let status,container,gateway;
  try{status=JSON.parse(cli('supabase',['status','--workdir',workdir,'-o','json']));[container,gateway]=JSON.parse(cli('docker',['inspect','supabase_db_bps-supabase-acceptance','supabase_kong_bps-supabase-acceptance']));}catch{throw new Error('Local Supabase CLI/container check failed.');}
  validateLocalStatus(status,config,container,gateway);
  secrets.push(status.ANON_KEY,status.SERVICE_ROLE_KEY,status.DB_URL);
  const signatures=['current_user_verified_tenant()','current_user_role()','ops_mutate(uuid,text,jsonb)','ops_import_locations(uuid,uuid,jsonb)','ops_execute_scoped(uuid,uuid,uuid,text,jsonb)','ops_board(uuid,date)','ops_week(uuid,date)','ops_set_directory_active(uuid,uuid,uuid,text,uuid,integer,boolean)','ops_directory(text,uuid,text,text,integer)','ops_attendance_week(uuid,date)','ops_replace_assignment(uuid,uuid,uuid,uuid,uuid,integer)','ops_record_attendance(uuid,uuid,uuid,uuid,integer,text)','ops_create_request_batch(uuid,uuid,uuid,jsonb)','ops_resize_request(uuid,uuid,uuid,uuid,integer,integer)','ops_reconcile_commands(uuid,uuid,uuid[],boolean)'];
  const query=`SELECT (${signatures.map(s=>`to_regprocedure('public.${s}') IS NOT NULL`).join(' AND ')}) AND (SELECT count(*)=2 FROM public.tenants WHERE id IN ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'));`;
  let schema;try{schema=cli('docker',['exec','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At','-c',query]).trim();}catch{throw new Error('Local fixture schema check failed.');}
  if(schema!=='t')throw new Error('Local pilot migrations or synthetic fixture are incomplete.');
  return 'Dedicated project, running container, loopback API/DB, required RPCs and fixture tenants verified. No credentials logged.';
}
try{
  release=acquireLock();
  for(const step of steps){
    const row={id:step.id,status:'not_requested',durationMs:0};report.steps.push(row);
    if(!step.requested)continue;
    if(failed||controller.signal.aborted){row.status='skipped';row.reason=controller.signal.aborted?'interrupted':'earlier step failed';continue;}
    console.log('RUN '+step.id);let snapshot;const started=Date.now();
    try{
      if(step.special==='local'){const log=preflight();Object.assign(row,{status:'passed',durationMs:Date.now()-started});writeFileSync(join(reportDir,step.id+'.log'),log+'\n',{mode:0o600});}
      else{
        if(step.module){const p=process.env[step.module];if(!p||!p.startsWith('/')||!existsSync(p))throw new Error('Required runtime missing: '+step.module);}
        let command=step.command,args=step.args,cwd=repo,env={...process.env,NEXT_TELEMETRY_DISABLED:'1'};
        if(step.special==='build'){snapshot=buildSnapshot(repo);cwd=snapshot;env=isolatedBuildEnv(process.env);command=node;args=[join(repo,'node_modules/next/dist/bin/next'),'build'];}
        const result=await runProcess(command,args,{cwd,env,timeoutMs:step.timeout??120000,signal:controller.signal,secrets,summaryOnly:step.summaryOnly});
        const {log,...metadata}=result;Object.assign(row,metadata);writeFileSync(join(reportDir,step.id+'.log'),log,{mode:0o600});
      }
    }catch(e){Object.assign(row,{status:'failed',durationMs:Date.now()-started,reason:redact(e.message,secrets)});}
    finally{if(snapshot)rmSync(snapshot,{recursive:true,force:true});}
    if(row.status!=='passed')failed=true;
    console.log(row.status.toUpperCase()+' '+step.id);writeReport(reportDir,report);
  }
}catch(e){failed=true;report.steps.push({id:'runner',status:'failed',durationMs:0,reason:redact(e.message,secrets)});}
finally{
  release?.();process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);
  report.status=controller.signal.aborted?'interrupted':failed?'failed':'passed';report.finishedAt=new Date().toISOString();writeReport(reportDir,report);
  console.log(`${report.status.toUpperCase()} — ${report.steps.filter(s=>s.status==='passed').length} passed; ${report.steps.filter(s=>s.status==='skipped').length} skipped; ${report.steps.filter(s=>s.status==='not_requested').length} not requested.\nReport: ${join(reportDir,'report.md')}`);
  process.exitCode=controller.signal.aborted?130:failed?1:0;
}
