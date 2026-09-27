import Link from 'next/link';
import {Suspense} from 'react';
import Schedules from './Schedules';
export const dynamic='force-dynamic';
export default function Page(){if(process.env.BPS_RECURRING_SCHEDULES_ENABLED!=='true')return <section className="p-6"><h1 className="text-xl font-semibold">Tekrarlayan planlar</h1><p>Bu bölüm henüz açılmadı.</p><Link href="/talepler/gunluk">Günlük plana dön</Link></section>;return <Suspense fallback={<p role="status">Planlar yükleniyor…</p>}><Schedules/></Suspense>;}
