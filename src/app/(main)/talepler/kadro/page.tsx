import Link from 'next/link';
import {Suspense} from 'react';
import Roster from './Roster';
export const dynamic='force-dynamic';
export default function Page(){
 if(process.env.BPS_FIXED_ROSTER_ENABLED!=='true'||process.env.BPS_DAILY_OPERATIONS_ENABLED!=='true')return <section className="rounded-xl border bg-white p-6"><h1 className="text-xl font-semibold">Şube kadrosu</h1><p className="mt-3">Şube kadrosu henüz kullanıma açılmadı.</p><Link className="mt-4 inline-block underline" href="/talepler/dizin">Şubelere dön</Link></section>;
 return <Suspense fallback={<p role="status">Kadro yükleniyor…</p>}><Roster/></Suspense>;
}
