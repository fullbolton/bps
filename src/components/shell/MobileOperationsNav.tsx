"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ListChecks, CalendarCheck, CalendarDays, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNavigationGuard } from '@/context/NavigationGuardContext';

export default function MobileOperationsNav({ dailyEnabled }: { dailyEnabled: boolean }) {
  const { role, loading } = useAuth(), pathname = usePathname(), guard = useNavigationGuard();
  if (loading || !['yonetici', 'operasyon', 'ik'].includes(role)) return null;
  const items = role === 'ik' || !dailyEnabled ? [
    { href: '/gorevler', label: 'İşler', icon: ListChecks },
    { href: '/personel-havuzu', label: 'Personel', icon: Users },
  ] : [
    { href: '/gorevler', label: 'İşler', icon: ListChecks },
    { href: '/talepler/ise-baslama', label: 'İşe başlama', icon: CalendarCheck },
    { href: '/talepler/gunluk', label: 'Günlük plan', icon: CalendarDays },
    { href: '/personel-havuzu', label: 'Personel', icon: Users },
  ];
  return <nav aria-label="Mobil operasyon" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 px-2 pt-1 backdrop-blur-sm pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden print:hidden">
    {items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={guard.handle}
      aria-current={pathname === href || pathname.startsWith(href + '/') ? 'page' : undefined}
      className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium text-slate-600 aria-[current=page]:bg-blue-50 aria-[current=page]:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">
      <Icon size={21} strokeWidth={1.8} aria-hidden="true" />{label}
    </Link>)}
  </nav>;
}
