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
import type { UserRole } from "@/context/RoleContext";
import {
  TYPE_BODY,
  RADIUS_SM,
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
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "firmalar", label: "Firmalar", href: "/firmalar", icon: Building2 },
  { key: "sozlesmeler", label: "Sözleşmeler", href: "/sozlesmeler", icon: FileText, roles: ["yonetici", "partner", "operasyon"] },
  { key: "talepler", label: "Personel Talepleri", href: "/talepler", icon: Users, roles: ["yonetici", "partner", "operasyon"] },
  { key: "aktif-isgucu", label: "Aktif İş Gücü", href: "/aktif-isgucu", icon: HardHat, roles: ["yonetici", "partner", "operasyon", "ik"] },
  { key: "randevular", label: "Randevular", href: "/randevular", icon: CalendarCheck, roles: ["yonetici", "partner", "operasyon"] },
  { key: "gorevler", label: "Görevler", href: "/gorevler", icon: ListChecks, roles: ["yonetici", "partner", "operasyon", "ik"] },
  { key: "evraklar", label: "Evraklar", href: "/evraklar", icon: FolderOpen, roles: ["yonetici", "partner", "operasyon", "ik"] },
  { key: "finansal-ozet", label: "Finansal Özet", href: "/finansal-ozet", icon: TrendingUp, roles: ["yonetici", "muhasebe"] },
  { key: "raporlar", label: "Raporlar", href: "/raporlar", icon: BarChart3 },
  { key: "ayarlar", label: "Ayarlar", href: "/ayarlar", icon: Settings, roles: ["yonetici"] },
];

/**
 * Sidebar uses an intentionally separate dark-chrome palette (bg-slate-900, text-slate-300, etc.)
 * that sits outside the light content token system defined in tokens.ts.
 * Only structural tokens (radius, font sizing, z-index) are shared.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const mobileDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (query.matches) mobileDialog.current?.close(); };
    query.addEventListener("change", closeOnDesktop);
    return () => query.removeEventListener("change", closeOnDesktop);
  }, []);
  const { role } = useRole();

  const visibleItems = MENU_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  const content = <>
      <div className="h-14 flex items-center px-5 border-b border-slate-700">
        <span className="text-lg font-semibold tracking-tight">BPS</span>
        <span className="ml-2 text-xs text-slate-400">Partner Staff</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={() => mobileDialog.current?.close()}
                  className={clsx(
                    `flex items-center gap-3 px-3 py-2 ${RADIUS_SM} ${TYPE_BODY} transition-colors`,
                    isActive
                      ? "bg-slate-700 text-white font-medium"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
  </>;
  return <>
    <aside className={`fixed left-0 top-0 bottom-0 w-64 bg-slate-900 text-white hidden md:flex flex-col ${Z_SIDEBAR}`}>
      {content}
    </aside>
    <button className="fixed left-4 top-3 z-50 rounded p-1 text-slate-700 md:hidden" aria-label="Menüyü aç" aria-haspopup="dialog" aria-controls="mobile-navigation"
      onClick={() => mobileDialog.current?.showModal()}><Menu size={24} /></button>
    <dialog ref={mobileDialog} id="mobile-navigation" aria-label="Gezinme menüsü"
      className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[90vw] border-0 bg-slate-900 p-0 text-white backdrop:bg-black/40">
      <button autoFocus className="absolute right-3 top-3 rounded p-1" aria-label="Menüyü kapat" onClick={() => mobileDialog.current?.close()}><X size={22} /></button>
      <div className="flex h-full flex-col">{content}</div>
    </dialog>
  </>;
}
