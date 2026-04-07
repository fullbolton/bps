"use client";

import Link from "next/link";
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
  const { role } = useRole();

  const visibleItems = MENU_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  return (
    <aside className={`fixed left-0 top-0 bottom-0 w-64 bg-slate-900 text-white flex flex-col ${Z_SIDEBAR}`}>
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
    </aside>
  );
}
