'use client';
import Link from 'next/link';
import {useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
export default function RegistrationPage(){
 const [code,setCode]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);const pending=useRef(false);
 async function register(){if(pending.current)return;pending.current=true;setBusy(true);setError('');try{
  const match=/^([0-9a-f-]{36})\.([0-9a-f]{64})$/.exec(code.trim());if(!match){setError('Davet kodunu eksiksiz yapıştırın.');return;}
  const client=createClient();const current=await client.auth.getSession();if(current.error)throw current.error;if(current.data.session){setError('Bir hesapla zaten giriş yapılmış. Daveti kabul etmek için /davet ekranına gidin veya önce çıkış yapın.');return;}
  const allowed=await client.rpc('invitation_registration_allowed',{p_id:match[1],p_token:match[2],p_email:email.trim()});
  if(allowed.error){setError('Davet doğrulanamadı. Yeniden deneyin.');return;}
  if(allowed.data!==true){setError('Davet kodu ve e-posta eşleşmiyor veya davet artık geçerli değil.');return;}
  const r=await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.origin+'/auth/callback'}});
  if(r.error){setError('Hesap oluşturma tamamlanamadı. Bilgilerinizi kontrol edin veya daha sonra tekrar deneyin.');return;}
  setPassword('');setCode('');
  if(r.data.session){window.location.assign('/davet');return;}
  setSent(true);
 }catch{setError('İşlem doğrulanamadı. Yeniden deneyin.');}finally{pending.current=false;setBusy(false);}}
 return <main className="min-h-screen bg-slate-50 px-4 py-12"><section className="mx-auto max-w-md rounded-lg border bg-white p-6 space-y-4"><h1 className="text-xl font-semibold">Davetle hesap oluştur</h1>
 {sent?<p role="status">Bu adres için kayıt uygunsa doğrulama e-postası gönderilir. E-postadaki bağlantıyı bu tarayıcıda açın; ardından yöneticinizin koduyla daveti kabul edin. Zaten hesabınız varsa giriş yapın.</p>:<form onSubmit={e=>{e.preventDefault();void register();}} className="space-y-4">
 <p className="text-sm text-slate-600">Yöneticinizin davet ettiği e-postayı kullanın. Hesap oluşturmak çalışma alanına otomatik katılım sağlamaz; e-posta doğrulamasından sonra daveti kabul edeceksiniz.</p>
 <label className="block text-sm">Davet kodu<input required maxLength={101} autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} className="mt-1 block w-full rounded border p-2"/></label>
 <label className="block text-sm">E-posta<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 block w-full rounded border p-2"/></label>
 <label className="block text-sm">Şifre<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 block w-full rounded border p-2"/></label><p className="text-xs text-slate-500">En az 12 karakter. Davet kodunu kabul aşaması için saklayın.</p>
 <button disabled={busy} className="w-full rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{busy?'Kontrol ediliyor…':'Hesap oluştur'}</button></form>}
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 <Link href="/login?returnTo=/davet" className="block text-sm text-blue-700">Hesabım var, giriş yap</Link><Link href="/davet" className="block text-sm text-blue-700">Davet kabul ekranına git</Link>
 </section></main>;
}
