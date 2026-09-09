import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,cpSync,symlinkSync,rmSync,openSync,closeSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';

export function parseArgs(args){
  const options={sql:false,localApi:false,build:false,help:false};
  for(const arg of args){
    if(arg==='--all')options.sql=options.localApi=options.build=true;
    else if(arg==='--sql')options.sql=true;
    else if(arg==='--local-api')options.localApi=true;
    else if(arg==='--build')options.build=true;
    else if(arg==='--help')options.help=true;
    else throw new Error('Unknown option. Use --help.');
  }
  return options;
}
export function redact(text,secrets=[]){
  let value=String(text).replace(/\u001b\[[0-9;]*m/g,'');
  for(const secret of secrets.filter(s=>typeof s==='string'&&s.length>=8).sort((a,b)=>b.length-a.length))value=value.split(secret).join('[REDACTED]');
  return value.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED JWT]')
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,'[REDACTED KEY]')
    .replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/gi,'$1[REDACTED]@')
    .replace(/(Bearer\s+)[^\s"']+/gi,'$1[REDACTED]')
    .replace(/((?:password|access_token|refresh_token|api[_-]?key|service_role_key)["']?\s*[=:]\s*["']?)[^\s,"'}]+/gi,'$1[REDACTED]');
}
export function validateLocalStatus(status,config,container,gateway){
  const bad=()=>{throw new Error('Dedicated local Supabase identity could not be verified.');};
  if(!/^project_id\s*=\s*"bps-supabase-acceptance"\s*$/m.test(config.split(/^\s*\[/m)[0])||container?.Name!=='/supabase_db_bps-supabase-acceptance'||container?.State?.Running!==true)return bad();
  if(gateway?.Name!=='/supabase_kong_bps-supabase-acceptance'||gateway?.State?.Running!==true||!gateway?.NetworkSettings?.Ports?.['8000/tcp']?.some(p=>p.HostPort==='54321')||!container?.NetworkSettings?.Ports?.['5432/tcp']?.some(p=>p.HostPort==='54322'))return bad();
  let url,db;try{url=new URL(status.API_URL);db=new URL(status.DB_URL);}catch{return bad();}
  if(url.href!=='http://127.0.0.1:54321/'||url.username||url.password||db.protocol!=='postgresql:'||db.hostname!=='127.0.0.1'||db.port!=='54322'||db.pathname!=='/postgres'||db.username!=='postgres'||db.search||db.hash)return bad();
  if(typeof status.ANON_KEY!=='string'||!status.ANON_KEY||typeof status.SERVICE_ROLE_KEY!=='string'||!status.SERVICE_ROLE_KEY)return bad();
}
export function acquireLock(path=join(tmpdir(),'bps-acceptance-runner.lock')){
  function create(){const fd=openSync(path,'wx',0o600);writeFileSync(fd,JSON.stringify({pid:process.pid}));closeSync(fd);}
  try{create();}catch(e){
    if(e.code!=='EEXIST')throw e;
    let pid;try{pid=JSON.parse(readFileSync(path,'utf8')).pid;}catch{throw new Error('Acceptance lock is unreadable; no tests started.');}
    if(!Number.isInteger(pid)||pid<=0)throw new Error('Acceptance lock is invalid; no tests started.');
    let stale=false;try{process.kill(pid,0);}catch(err){if(err.code==='ESRCH')stale=true;}
    if(!stale)throw new Error('Another acceptance run is active; no tests started.');
    const recovery=path+'.recovery';
    try{mkdirSync(recovery,{mode:0o700});}catch{throw new Error('Lock recovery is already in progress; no tests started.');}
    try{
      const latest=JSON.parse(readFileSync(path,'utf8')).pid;
      let gone=false;try{process.kill(latest,0);}catch(err){if(err.code==='ESRCH')gone=true;}
      if(!Number.isInteger(latest)||latest<=0||!gone)throw new Error('Acceptance lock owner changed; no tests started.');
      rmSync(path);create();
    }finally{rmSync(recovery,{recursive:true,force:true});}
  }
  return ()=>{try{if(JSON.parse(readFileSync(path,'utf8')).pid===process.pid)rmSync(path);}catch{}};
}
export function buildSnapshot(repo){
  const dir=mkdtempSync(join(tmpdir(),'bps-build-'));
  try{
    for(const name of ['src','public','package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','postcss.config.mjs']){
      const source=join(repo,name);if(existsSync(source))cpSync(source,join(dir,name),{recursive:true});
    }
    if(!existsSync(join(dir,'src'))||!existsSync(join(dir,'package.json')))throw new Error('Build source is incomplete.');
    symlinkSync(resolve(repo,'node_modules'),join(dir,'node_modules'),'dir');
    return dir;
  }catch(e){rmSync(dir,{recursive:true,force:true});throw e;}
}
export function isolatedBuildEnv(env){
  const clean={};
  const inherited=new Set(['PATH','HOME','TMPDIR','TMP','TEMP','SystemRoot','WINDIR','LANG','LC_ALL','LC_CTYPE','USER','LOGNAME','SHELL','TERM']);
  for(const [key,value] of Object.entries(env))if(inherited.has(key))clean[key]=value;
  return {...clean,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',BPS_DAILY_OPERATIONS_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-build-placeholder'};
}
export function runProcess(command,args,{cwd,env=process.env,timeoutMs=120000,signal,secrets=[],summaryOnly=false}={}){
  return new Promise(resolvePromise=>{
    const started=Date.now();let output='',bytes=0,truncated=false,reason=null,errorCode=null,forceTimer;
    const child=spawn(command,args,{cwd,env,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
    const collect=chunk=>{bytes+=chunk.length;if(bytes<=2_000_000)output+=chunk.toString();else truncated=true;};
    child.stdout?.on('data',collect);child.stderr?.on('data',collect);
    const kill=signalName=>{if(!child.pid)return;try{if(process.platform==='win32')child.kill(signalName);else process.kill(-child.pid,signalName);}catch{}};
    const stop=why=>{if(reason)return;reason=why;kill('SIGTERM');forceTimer=setTimeout(()=>kill('SIGKILL'),1500);};
    const timer=setTimeout(()=>stop('timed_out'),timeoutMs);
    const abort=()=>stop('interrupted');signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    child.on('error',e=>{errorCode=e.code??'SPAWN_ERROR';});
    child.on('close',(code,exitSignal)=>{
      clearTimeout(timer);signal?.removeEventListener('abort',abort);
      // A timed-out parent may exit before a descendant; keep the group escalation alive.
      if(!reason&&forceTimer)clearTimeout(forceTimer);
      let log=redact(output,secrets);
      if(summaryOnly)log=log.split('\n').filter(line=>/^(PASS |\d+ local network\/service checks passed)/.test(line)).join('\n')+'\n[Local API diagnostic payloads suppressed.]\n';
      resolvePromise({status:reason??(code===0&&!errorCode?'passed':'failed'),exitCode:code,signal:exitSignal??null,errorCode,durationMs:Date.now()-started,log,truncated});
    });
  });
}
export function writeReport(dir,report){
  mkdirSync(dir,{recursive:true,mode:0o700});
  writeFileSync(join(dir,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
  const lines=['# BPS local acceptance',`\nOverall: ${report.status}`,`\nStarted: ${report.startedAt}`,`\nFinished: ${report.finishedAt??'running'}`,'\n| Step | Result | Duration |','|---|---|---|'];
  for(const step of report.steps)lines.push(`| ${step.id} | ${step.status}${step.reason?' — '+step.reason:''} | ${step.durationMs??0} ms |`);
  lines.push('\nNot covered: authenticated browser visual acceptance, HTTP CSV export acceptance (qa-local-export.mjs), native PDF pagination, production schema/Auth/function-owner integration.');
  writeFileSync(join(dir,'report.md'),lines.join('\n')+'\n',{mode:0o600});
}
