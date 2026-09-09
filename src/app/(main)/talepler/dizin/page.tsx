import Link from 'next/link';
import {Suspense} from 'react';
import OperationsDirectory from './OperationsDirectory';
export const dynamic='force-dynamic';
export default function DirectoryPage(){
  if(process.env.BPS_DAILY_OPERATIONS_ENABLED!=='true')return <section className="rounded-xl border bg-white p-6"><h1 className="text-xl font-semibold">Şube ve personel dizini</h1><p className="mt-3">Bu çalışma alanı henüz kullanıma açılmadı.</p><Link className="mt-4 inline-block underline" href="/talepler">Taleplere dön</Link></section>;
  return <Suspense fallback={<p role="status">Dizin yükleniyor…</p>}><OperationsDirectory /></Suspense>;
}
