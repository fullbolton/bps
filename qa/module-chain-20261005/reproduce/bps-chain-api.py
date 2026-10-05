import subprocess,json,urllib.parse,urllib.request,urllib.error,tempfile,os,base64,hmac,hashlib,time,pathlib
container='bps_module_chain_rest_20261005';dbcontainer='supabase_db_bps-supabase-acceptance'
r=json.loads(subprocess.run(['docker','inspect','supabase_rest_bps-supabase-acceptance'],capture_output=True,text=True,check=True).stdout)[0]
env=dict(s.split('=',1)for s in r['Config']['Env']if s.startswith('PGRST_'));u=urllib.parse.urlsplit(env['PGRST_DB_URI']);assert u.hostname==dbcontainer
secret=base64.urlsafe_b64encode(os.urandom(40)).decode();env['PGRST_DB_URI']=urllib.parse.urlunsplit((u.scheme,u.netloc,'/bps_module_chain_20261005',u.query,''));env['PGRST_JWT_SECRET']=secret;env['PGRST_DB_SCHEMAS']='public,storage';fd,p=tempfile.mkstemp(dir='/private/tmp',prefix='bps-local-rest-');os.close(fd)
try:
 pathlib.Path(p).write_text('\n'.join(k+'='+v for k,v in env.items())+'\n')
 subprocess.run(['docker','run','-d','--name',container,'--network','supabase_network_bps-supabase-acceptance','-p','127.0.0.1:55451:3000','--env-file',p,r['Config']['Image']],capture_output=True,text=True,check=True)
finally:os.unlink(p)
def token(user=11,tenant=1):
 enc=lambda o:base64.urlsafe_b64encode(json.dumps(o,separators=(',',':')).encode()).decode().rstrip('=')
 s=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'role':'authenticated','sub':f'00000000-0000-4000-8000-{user:012}','active_tenant_id':f'00000000-0000-4000-8000-{tenant:012}','exp':int(time.time())+600})
 return s+'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),s.encode(),hashlib.sha256).digest()).decode().rstrip('=')
def req(path,t=None,body=None,storage=False):
 headers={'Content-Type':'application/json'}
 if t:headers['Authorization']='Bearer '+t
 if storage:headers['Accept-Profile']='storage'
 request=urllib.request.Request('http://127.0.0.1:55451'+path,headers=headers,data=json.dumps(body).encode()if body is not None else None)
 try:
  with urllib.request.urlopen(request,timeout=5)as x:return x.status,json.load(x)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def toggle(v):
 q=f"UPDATE tenant_module_settings SET enabled={str(v).lower()} WHERE tenant_id='00000000-0000-4000-8000-000000000001' AND module_key IN ('talent','reporting')"
 subprocess.run(['docker','exec',dbcontainer,'psql','-X','-q','-U','postgres','-d','bps_module_chain_20261005','-v','ON_ERROR_STOP=1','-c',q],capture_output=True,text=True,check=True)
checks=[]
try:
 for _ in range(40):
  try:
   code,data=req('/rpc/current_workspace_modules_v1',token(),{})
   if code==200:break
  except (urllib.error.URLError,TimeoutError,ConnectionResetError):pass
  time.sleep(.25)
 assert code==200,(code,data)
 assert len(data['modules'])==10 and all(data['modules'].values());checks.append('signed JWT resolves actual module context')
 code,data=req('/rpc/current_workspace_modules_v1',token(11,2),{});assert code==403,(code,data);checks.append('signed foreign tenant claim rejected')
 code,data=req('/rpc/current_workspace_modules_v1',None,{});assert code in (401,403,404),(code,data);checks.append('anonymous module context denied')
 for bucket in ['person-files','project-sources']:
  path='/objects?select=id&bucket_id=eq.'+bucket
  code,data=req(path,token(),storage=True);assert code==200 and len(data)==1,(code,data);checks.append(bucket+' HTTP visible while enabled')
  code,data=req(path,token(12,2),storage=True);assert code==200 and data==[],(code,data);checks.append(bucket+' HTTP tenant isolated')
 toggle(False)
 code,data=req('/rpc/current_workspace_modules_v1',token(),{});assert code==200 and data['modules']['talent']is False and data['modules']['reporting']is False;checks.append('HTTP context reflects module disable')
 for bucket in ['person-files','project-sources']:
  code,data=req('/objects?select=id&bucket_id=eq.'+bucket,token(),storage=True);assert code==200 and data==[],(code,data);checks.append(bucket+' HTTP hidden after disable')
 code,data=req('/rpc/talent_person_detail',token(),{'p_actor_id':'00000000-0000-4000-8000-000000000011','p_tenant_id':'00000000-0000-4000-8000-000000000001','p_person_id':'00000000-0000-4000-8000-000000000060'});assert code>=400 and data.get('code')=='BM001',(code,data);checks.append('actual talent detail HTTP RPC returns BM001')
 (pathlib.Path(__file__).resolve().parents[1]/'api-smoke.json').write_text(json.dumps({'checks':checks,'passed':len(checks),'scope':'Local PostgREST with synthetic signed JWT; no GoTrue login or Storage HTTP byte transfer'},indent=2)+'\n')
 print(json.dumps({'passed':len(checks),'checks':checks},indent=2))
finally:
 toggle(True);subprocess.run(['docker','rm','-f',container],capture_output=True,text=True,check=True)
