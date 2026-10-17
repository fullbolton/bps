"use client";

import { useEffect, useRef, useState } from "react";
import { useNavigationGuard } from "@/context/NavigationGuardContext";
import { createClient } from "@/lib/supabase/client";
import { updateOwnDisplayName, getCurrentProfile } from "@/lib/services/profiles";

export default function DisplayNameEditor({ actorId, initialName, onSaved }: { actorId: string; initialName: string; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(initialName);
  const [baseline, setBaseline] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const alive = useRef(true), flight = useRef(false);
  const guard = useNavigationGuard();
  const dirty = name !== baseline;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!dirty && !busy && !uncertain) return;
    const off = guard.register(event => { event.preventDefault(); setMessage("Önce ad değişikliğini kaydedin veya vazgeçin."); });
    const block = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", block);
    return () => { off(); window.removeEventListener("beforeunload", block); };
  }, [guard, dirty, busy, uncertain]);

  async function save() {
    if (flight.current || uncertain) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80) { setMessage("Ad soyad 1–80 karakter olmalı."); return; }
    flight.current = true; setBusy(true); setMessage("");
    try {
      const row = await updateOwnDisplayName(createClient(), trimmed, { actorId, displayName: baseline });
      if (!alive.current) return;
      setName(row.display_name); setBaseline(row.display_name); setMessage("Ad soyad kaydedildi.");
      await onSaved();
    } catch {
      if (alive.current) { setUncertain(true); setMessage("Kayıt doğrulanamadı. Yeniden kaydetmeden önce güncel adı kontrol edin; yazdığınız ad korunuyor."); }
    } finally { flight.current = false; if (alive.current) setBusy(false); }
  }
  async function reconcile() {
    if (flight.current) return;
    flight.current = true; setBusy(true);
    try {
      const row = await getCurrentProfile(createClient());
      if (!row || row.id !== actorId || typeof row.display_name !== "string") throw Error("PROFILE_IDENTITY");
      if (!alive.current) return;
      setBaseline(row.display_name); setUncertain(false);
      if (row.display_name === name.trim()) { setName(row.display_name); setMessage("Ad soyad kaydı doğrulandı."); }
      else setMessage(`Kayıtlı ad: ${row.display_name || "Henüz girilmemiş"}. Yazdığınız ad korunuyor. Kaydet ile değiştirebilir veya Vazgeç ile kayıtlı ada dönebilirsiniz.`);
      await onSaved();
    } catch { if (alive.current) setMessage("Güncel ad okunamadı. Bağlantınızı kontrol edip yeniden deneyin."); }
    finally { flight.current = false; if (alive.current) setBusy(false); }
  }
  const button = "min-h-11 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600";
  return <form className="mt-5 border-t border-slate-200 pt-5" onSubmit={event => { event.preventDefault(); void save(); }}>
    <label htmlFor="account-display-name" className="block text-sm font-medium">Ad soyad</label>
    <input id="account-display-name" autoComplete="name" maxLength={80} value={name} disabled={busy || uncertain} onChange={event => { setName(event.target.value); setMessage(""); }} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base disabled:bg-slate-50" aria-describedby="account-name-help" />
    <p id="account-name-help" className="mt-2 text-sm text-slate-500">Bu ad, üyesi olduğunuz tüm şirketlerde görünür. Rolünüz ve giriş e-postanız değişmez.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      {uncertain ? <button type="button" className={button} disabled={busy} onClick={() => void reconcile()}>Güncel adı kontrol et</button> : <button type="submit" className={button + " bg-blue-700 text-white"} disabled={busy || !dirty}>{busy ? "Kaydediliyor…" : "Kaydet"}</button>}
      <button type="button" className={button} disabled={busy || uncertain || !dirty} onClick={() => { setName(baseline); setMessage(""); }}>Vazgeç</button>
    </div>
    {message && <p role="status" className="mt-3 text-sm text-slate-700">{message}</p>}
  </form>;
}
