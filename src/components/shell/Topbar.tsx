"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, User, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  TYPE_BODY,
  TYPE_CAPTION,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
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
      <header className={`fixed top-0 left-64 right-0 h-14 ${SURFACE_PRIMARY} border-b ${BORDER_DEFAULT} flex items-center px-5 gap-4 ${Z_TOPBAR}`}>
        {/* Global search removed — the previous input had no wiring
            (no value/onChange/submit/dropdown) and produced no results,
            which misled users. A real search surface is out of scope
            for this batch; honest absence is preferred over a fake
            interactive control. */}

        {/* Turkish date/time utility — desktop only, updates every minute */}
        {dateTimeStr && (
          <span className={`${TYPE_CAPTION} ${TEXT_MUTED} whitespace-nowrap hidden md:block`}>
            {dateTimeStr}
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {/* Notifications placeholder */}
          <button className={`relative p-2 ${TEXT_SECONDARY} hover:text-slate-700 ${RADIUS_SM} hover:bg-slate-100 transition-colors`}>
            <Bell size={18} />
            <span className={`absolute top-1 right-1 w-2 h-2 bg-red-500 ${RADIUS_FULL}`} />
          </button>

          {/* User menu */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`flex items-center gap-2 px-2 py-1.5 ${TYPE_BODY} text-slate-600 hover:bg-slate-100 ${RADIUS_SM} transition-colors`}
            >
              <div className={`w-7 h-7 bg-slate-200 ${RADIUS_FULL} flex items-center justify-center`}>
                <User size={14} className={TEXT_SECONDARY} />
              </div>
              <span className="hidden sm:inline">{displayName || "Kullanıcı"}</span>
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
