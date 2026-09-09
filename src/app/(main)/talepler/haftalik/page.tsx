import Link from 'next/link';
import {Suspense} from 'react';
import WeeklyOperations from './WeeklyOperations';
export const dynamic='force-dynamic';
export default function WeeklyPage(){
  if(process.env.BPS_DAILY_OPERATIONS_ENABLED!=='true')return <section className="rounded-xl border bg-white p-6"><h1 className="text-xl font-semibold">Haftalık personel planı</h1><p className="mt-3">Bu çalışma alanı henüz kullanıma açılmadı.</p><Link href="/talepler" className="mt-4 inline-block underline">Taleplere dön</Link></section>;
  return <Suspense fallback={<p role="status">Plan yükleniyor…</p>}><WeeklyOperations /></Suspense>;
}
