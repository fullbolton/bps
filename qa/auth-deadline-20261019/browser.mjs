// Synthetic browser acceptance. Copies real provider/helper; never loads production env.
import {mkdtempSync,cpSync,rmSync,mkdirSync,writeFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';
const root=process.cwd(),dir=mkdtempSync(join(tmpdir(),'bps-auth-deadline-'));
cpSync(join(root,'src'),join(dir,'src'),{recursive:true});rmSync(join(dir,'src/app'),{recursive:true});rmSync(join(dir,'src/middleware.ts'),{force:true});mkdirSync(join(dir,'src/app'),{recursive:true});
for(const f of ['package.json','tsconfig.json','postcss.config.mjs'])cpSync(join(root,f),join(dir,f));symlinkSync(join(root,'node_modules'),join(dir,'node_modules'),'dir');
writeFileSync(join(dir,'src/app/layout.tsx'),`import './globals.css';export default function Layout({children}:{children:React.ReactNode}){return <html lang="tr"><body>{children}</body></html>}`);
cpSync(join(root,'src/app/globals.css'),join(dir,'src/app/globals.css'));
writeFileSync(join(dir,'src/app/page.tsx'),`import {AuthProvider} from '@/context/AuthContext';export default function Page(){return <AuthProvider><h1>Sentetik şirket erişimi doğrulandı</h1></AuthProvider>}`);
writeFileSync(join(dir,'src/lib/services/profiles.ts'),`export async function getCurrentProfile(_client:unknown){return {id:'00000000-0000-4000-8000-000000000011',display_name:'Sentetik kullanıcı'}}`);
writeFileSync(join(dir,'src/lib/supabase/client.ts'),`
const user={id:'00000000-0000-4000-8000-000000000011',app_metadata:{}};
const client={auth:{getUser:async()=>{if(sessionStorage.getItem('attempted'))return {data:{user},error:null};sessionStorage.setItem('attempted','1');return new Promise(resolve=>setTimeout(()=>resolve({data:{user},error:null}),25000));},onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>{}},rpc:()=>({abortSignal:async()=>({data:{actorId:user.id,tenantId:'00000000-0000-4000-8000-000000000001',name:'Sentetik şirket',role:'yonetici',selectionVersion:null,membershipVersion:'00000000-0000-4000-8000-000000000021'},error:null})})};
export function createClient(){return client as any;}
`);
const env={...process.env,NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:1',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic',BPS_HR_PREVIEW_ENABLED:'false'};
const app=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3072'],{cwd:dir,env,stdio:'inherit'});
console.log('SYNTHETIC_ONLY: first load times out at 20s; identity arrives at 25s; reload succeeds. '+dir);
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>app.kill('SIGTERM'));
app.on('exit',()=>{rmSync(dir,{recursive:true,force:true});process.exit(0)});
