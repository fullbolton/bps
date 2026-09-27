import Link from "next/link";
import { Suspense } from "react";
import DailyOperations from "./DailyOperations";
export const dynamic = "force-dynamic";
export default function DailyOperationsPage() {
  if(process.env.BPS_DAILY_OPERATIONS_ENABLED!=="true") return <section className="rounded-xl border bg-white p-6"><h1 className="text-xl font-semibold">Günlük personel planı</h1><p className="mt-3 text-slate-600">Bu çalışma alanı henüz kullanıma açılmadı.</p><Link className="mt-4 inline-block underline" href="/talepler">Taleplere dön</Link></section>;
  return <Suspense fallback={<p role="status">Plan yükleniyor…</p>}><DailyOperations /></Suspense>;
}
