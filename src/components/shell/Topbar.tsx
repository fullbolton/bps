"use client";

import { useState, useRef, useEffect } from "react";
import ConversationInbox from "@/components/communication/ConversationInbox";
import { User, LogOut, ChevronDown, LayoutGrid } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  TYPE_BODY,
  TEXT_BODY,
  TEXT_SECONDARY,
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  RADIUS_SM,
  RADIUS_FULL,
  SHADOW_DROPDOWN,
  Z_TOPBAR,
  Z_OVERLAY,
} from "@/styles/tokens";

const TR_DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const TR_MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function formatTurkishDateTime(d: Date): string {
  const day = TR_DAYS[d.getDay()];
  const date = d.getDate();
  const month = TR_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}, ${date} ${month} ${year} • ${hours}:${minutes}`;
}

export default function Topbar() {
  const { displayName, signOut } = useAuth();
  const pathname = usePathname();
  const area = ({dashboard:"Genel bakış", firmalar:"Müşteri yönetimi", sozlesmeler:"Sözleşmeler", talepler:"Personel operasyonu", gorevler:"İş takibi", randevular:"Görüşmeler", evraklar:"Evrak yönetimi", "aktif-isgucu":"İş gücü", "finansal-ozet":"Finans", raporlar:"Raporlar", ayarlar:"Ayarlar", kurulum:"Çalışma alanı kurulumu"} as Record<string,string>)[pathname.split("/")[1]] ?? "Çalışma alanı";
  const [dateTimeStr, setDateTimeStr] = useState("");

  useEffect(() => {
    setDateTimeStr(formatTurkishDateTime(new Date()));
    const interval = setInterval(() => {
      setDateTimeStr(formatTurkishDateTime(new Date()));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <header className={`fixed top-0 left-0 md:left-64 right-0 h-16 bg-white/95 backdrop-blur-sm border-b ${BORDER_DEFAULT} flex items-center pl-16 pr-4 md:px-8 gap-4 ${Z_TOPBAR}`}>
        <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600"><LayoutGrid size={16} className="hidden sm:block shrink-0"/><span className="truncate">{area}</span></div>
        {dateTimeStr && <span className="ml-auto hidden xl:block text-xs text-slate-500">{dateTimeStr}</span>}

        <div className="flex items-center gap-2 ml-auto">
          {process.env.NEXT_PUBLIC_BPS_CONVERSATION_ENABLED==="true"&&<ConversationInbox />}
          {/* User menu */}
          <div ref={userMenuRef} className="relative">
            <button
              aria-label="Kullanıcı menüsü"
              aria-expanded={userMenuOpen}
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              onKeyDown={e => { if (e.key === "Escape") setUserMenuOpen(false); }}
              className={`flex items-center gap-2 px-2 py-1.5 ${TYPE_BODY} text-slate-600 hover:bg-slate-100 ${RADIUS_SM} transition-colors`}
            >
              <div className={`w-7 h-7 bg-slate-200 ${RADIUS_FULL} flex items-center justify-center`}>
                <User size={14} className={TEXT_SECONDARY} />
              </div>
              <span className="hidden lg:inline max-w-48 truncate">{displayName || "Kullanıcı"}</span><ChevronDown size={14} className="hidden sm:block"/>
            </button>

            {userMenuOpen && (
              <div className={`absolute right-0 top-full mt-1 w-48 ${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_SM} ${SHADOW_DROPDOWN} py-1 ${Z_OVERLAY}`}>
                <button
                  onClick={() => { setUserMenuOpen(false); signOut(); }}
                  className={`w-full text-left px-3 py-2 ${TYPE_BODY} ${TEXT_BODY} hover:bg-slate-50 flex items-center gap-2`}
                >
                  <LogOut size={14} />
                  Çıkış Yap
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
