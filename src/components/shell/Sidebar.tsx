"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  FileText,
  Users,
  HardHat,
  CalendarCheck,
  ListChecks,
  FolderOpen,
  TrendingUp,
  BarChart3,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { useRole } from "@/context/RoleContext";
import { useNavigationGuard } from "@/context/NavigationGuardContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { UserRole } from "@/context/RoleContext";
import {
  Z_SIDEBAR,
} from "@/styles/tokens";

interface MenuItem {
  key: string;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  /** Which roles can see this nav item. If omitted, all roles see it. */
  roles?: UserRole[];
}

const MENU_ITEMS: MenuItem[] = [
  { key: "dashboard", label: "Genel Bakış", href: "/dashboard", icon: LayoutDashboard },
  { key: "firmalar", label: "Firmalar", href: "/firmalar", icon: Building2 },
  { key: "projeler", label: "Projeler", href: "/projeler", icon: FolderOpen, roles: ["yonetici", "operasyon", "ik", "muhasebe"] },
  { key: "sozlesmeler", label: "Sözleşmeler", href: "/sozlesmeler", icon: FileText, roles: ["yonetici", "partner", "operasyon"] },
  { key: "talepler", label: "Personel Talepleri", href: "/talepler", icon: Users, roles: ["yonetici", "partner", "operasyon"] },
  { key: "personel-havuzu", label: "Personel Havuzu", href: "/personel-havuzu", icon: Users, roles: ["yonetici", "operasyon", "ik"] },
  { key: "aktif-isgucu", label: "Aktif İş Gücü", href: "/aktif-isgucu", icon: HardHat, roles: ["yonetici", "partner", "operasyon", "ik"] },
  { key: "randevular", label: "Randevular", href: "/randevular", icon: CalendarCheck, roles: ["yonetici", "partner", "operasyon"] },
  { key: "gorevler", label: "Görevler", href: "/gorevler", icon: ListChecks, roles: ["yonetici", "partner", "operasyon", "ik"] },
  { key: "evraklar", label: "Evraklar", href: "/evraklar", icon: FolderOpen, roles: ["yonetici", "partner", "operasyon", "ik"] },
  { key: "finansal-ozet", label: "Finansal Özet", href: "/finansal-ozet", icon: TrendingUp, roles: ["yonetici", "muhasebe"] },
  { key: "raporlar", label: "Raporlar", href: "/raporlar", icon: BarChart3 },
  { key: "yonetim", label: "Şirket Yönetimi", href: "/yonetim", icon: Building2, roles: ["yonetici"] },
  { key: "ayarlar", label: "Ayarlar", href: "/ayarlar", icon: Settings, roles: ["yonetici"] },
];

/**
 * Sidebar uses an intentionally separate dark-chrome palette (bg-slate-900, text-slate-300, etc.)
 * that sits outside the light content token system defined in tokens.ts.
 * Only structural tokens (radius, font sizing, z-index) are shared.
 */
export default function Sidebar() {
  const navigationGuard = useNavigationGuard();
  const pathname = usePathname();
  const mobileDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (query.matches) mobileDialog.current?.close(); };
    query.addEventListener("change", closeOnDesktop);
    return () => query.removeEventListener("change", closeOnDesktop);
  }, []);
  const { role } = useRole();
  const { workspace, loading: workspaceLoading, error: workspaceError, reload: reloadWorkspace } = useWorkspace();

  const visibleItems = MENU_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  const content = <>
      <Link href="/dashboard" onClick={event => { mobileDialog.current?.close(); navigationGuard.handle(event); }} className="flex h-20 shrink-0 items-center gap-3 pl-5 pr-14 md:pr-5 border-b border-white/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-300">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-sm font-bold tracking-tight text-white">BPS</span>
        <span className="min-w-0"><span className="block truncate font-semibold tracking-tight" title={workspace?.name}>{workspace?.name ?? 'Çalışma alanı'}</span><span className="block truncate text-xs text-slate-400 mt-0.5">{workspaceLoading ? 'Şirket doğrulanıyor…' : workspaceError ? 'Şirket bilgisi alınamadı' : 'Operasyon çalışma alanı'}</span></span>
      </Link>
      {workspaceError && <button className="mx-3 mt-2 min-h-11 rounded-lg px-3 text-left text-xs text-amber-200 underline focus-visible:outline-2 focus-visible:outline-blue-300" onClick={() => void reloadWorkspace()}>Şirket bilgisini yeniden yükle</button>}
      <nav aria-label="Ana menü" className="flex-1 overflow-y-auto px-3 py-5">
        {[
          {label: "ÇALIŞMA ALANI", keys: ["dashboard", "talepler", "personel-havuzu", "aktif-isgucu", "gorevler", "randevular"]},
          {label: "MÜŞTERİ VE HİZMET", keys: ["firmalar", "projeler", "sozlesmeler", "evraklar"]},
          {label: "YÖNETİM", keys: ["yonetim", "finansal-ozet", "raporlar", "ayarlar"]},
        ].map(group => {
          const items = group.keys.flatMap(key => visibleItems.filter(item => item.key === key));
          if (!items.length) return null;
          return <div key={group.label} className="mb-6 last:mb-0">
            <p className="px-3 mb-2 text-[10px] font-semibold tracking-[0.14em] text-slate-400">{group.label}</p>
            <ul className="space-y-1">{items.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return <li key={item.key}><Link href={item.href} aria-current={isActive ? "page" : undefined}
                onClick={event => { mobileDialog.current?.close(); navigationGuard.handle(event); }}
                className={clsx("flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300", isActive ? "bg-blue-500/15 text-blue-200 font-semibold ring-1 ring-inset ring-blue-400/25" : "text-slate-300 hover:bg-white/5 hover:text-white")}>
                <Icon size={18} strokeWidth={1.8} aria-hidden="true"/><span>{item.label}</span>
              </Link></li>;
            })}</ul>
          </div>;
        })}
      </nav>
      <div className="border-t border-white/10 px-6 py-4 text-xs leading-5 text-slate-400">Planla. Takip et. Birlikte tamamla.</div>
  </>;
  return <>
    <aside className={`fixed left-0 top-0 bottom-0 w-64 bg-slate-900 text-white hidden md:flex flex-col ${Z_SIDEBAR}`}>
      {content}
    </aside>
    <button className="fixed left-3 top-2.5 z-50 flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 md:hidden" aria-label="Menüyü aç" aria-haspopup="dialog" aria-controls="mobile-navigation"
      onClick={() => mobileDialog.current?.showModal()}><Menu size={24} /></button>
    <dialog ref={mobileDialog} id="mobile-navigation" aria-label="Gezinme menüsü"
      className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[90vw] border-0 bg-slate-900 p-0 text-white backdrop:bg-black/40">
      <button autoFocus className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-300" aria-label="Menüyü kapat" onClick={() => mobileDialog.current?.close()}><X size={22} /></button>
      <div className="flex h-full flex-col">{content}</div>
    </dialog>
  </>;
}
