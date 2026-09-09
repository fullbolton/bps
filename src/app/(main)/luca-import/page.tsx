"use client";

/**
 * Luca Mizan Import V1 — Upload / Preview / Confirm
 * Yonetici-only. Management visibility. Not accounting truth.
 */

import { useState, useMemo, useRef } from "react";
import { Upload, CheckCircle, XCircle, AlertTriangle, FileText, HelpCircle } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import {digestMizan,reserveMizan,settleMizan,isRejectedMizanInput} from "@/lib/luca/pending-import";
import { parseMizanExcel, buildCompanyMatchMap } from "@/lib/luca/mizan-parser";
import type { LucaParseResult, LucaMizanRow } from "@/lib/luca/types";
import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  BORDER_SUBTLE,
  RADIUS_DEFAULT,
  RADIUS_SM,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_CARD_TITLE,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
} from "@/styles/tokens";

function formatCurrency(n: number): string {
  if (n === 0) return "—";
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";
}

// Upload size ceiling for the mizan file. Real Luca exports are well under
// this (a 10k-row mizan is a couple of MB). The cap exists to bound the work
// handed to SheetJS: xlsx@0.18.5 carries a known ReDoS advisory
// (GHSA-5pgg-2g8v-p4x9) with no npm fix available — npm's `latest` IS 0.18.5,
// because SheetJS publishes newer builds only on its own CDN. Parsing here is
// browser-side and yonetici-only on an admin-chosen file, so the practical
// exposure is small; this ceiling simply keeps a malformed or oversized file
// from tying up the uploader's tab. Mirrors the 10 MB document-upload cap.
const MAX_MIZAN_BYTES = 10 * 1024 * 1024;

const MATCH_BADGE: Record<string, { label: string; color: string }> = {
  matched: { label: "Eslesti", color: "text-green-700 bg-green-50 ring-green-600/20" },
  unmatched: { label: "Eslesme yok", color: "text-amber-700 bg-amber-50 ring-amber-600/20" },
  ambiguous: { label: "Belirsiz", color: "text-red-700 bg-red-50 ring-red-600/20" },
};

export default function LucaImportPage() {
  const { role } = useRole();
  const { loading: authLoading } = useAuth();
  const supabase = createClient();

  const fileDigest=useRef<string|null>(null);
  const command=useRef<{id:string;tenantId:string;actorId:string;payload:Record<string,unknown>}|null>(null);
  const [parseResult, setParseResult] = useState<LucaParseResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth not resolved yet — don't flash "Erisim kisitli" (role defaults to
  // "goruntuleyici" while AuthContext is loading). Wait, then decide.
  if (authLoading) {
    return (
      <>
        <PageHeader title="Luca Mizan Import" subtitle="Muhasebe raporu kaynakli alacak gorunumu" />
        <EmptyState title="Yukleniyor…" description="Yetki bilgisi kontrol ediliyor." size="page" />
      </>
    );
  }

  if (role !== "yonetici") {
    return (
      <>
        <PageHeader title="Luca Mizan Import" subtitle="Muhasebe raporu kaynakli alacak gorunumu" />
        <EmptyState title="Erisim kisitli" description="Bu sayfa yalnizca yonetici erisimi gerektirir." size="page" />
      </>
    );
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setConfirmed(false);
    setParseResult(null);
    command.current=null;
    fileDigest.current=null;

    if (!file.name.match(/\.xlsx?$/i)) {
      setError("Yalnizca Excel (.xlsx / .xls) dosyasi kabul edilir.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_MIZAN_BYTES) {
      setError("Dosya 10 MB'dan buyuk olamaz. Mizan disa aktarimini daraltip tekrar deneyin.");
      e.target.value = "";
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const digest=await digestMizan(buffer);

      // Load BPS companies for matching — fail clearly if load fails
      const { data: companies, error: companyLoadErr } = await supabase.from("companies").select("id, name");
      if (companyLoadErr) {
        setError(`Firma listesi yuklenemedi: ${companyLoadErr.message}. Mizan isleme devam edemez.`);
        e.target.value = "";
        return;
      }
      if (!companies || companies.length === 0) {
        setError("BPS'te henuz firma kaydi yok. Once firma ekleyin, sonra mizan yukleyin.");
        e.target.value = "";
        return;
      }
      const companyMap = buildCompanyMatchMap(companies);

      const result = parseMizanExcel(buffer, file.name, companyMap);
      setParseResult(result);
      fileDigest.current=digest;

      if (result.errors.length > 0) {
        setError(result.errors.join("; "));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dosya okunamadi.");
    }
    e.target.value = "";
  }

  async function handleConfirm() {
    if (!parseResult || confirming || parseResult.errors.length || !parseResult.rows.length) return;
    setConfirming(true);
    setError(null);

    try {
      const identity=await supabase.auth.getUser();
      const user=identity.data.user;
      const tenant=await supabase.rpc('current_user_verified_tenant');
      if(identity.error||!user||tenant.error||typeof tenant.data!=='string')throw Error('Çalışma alanı doğrulanamadı. Oturumunuzu kontrol edin.');
      if(!command.current){
        if(!fileDigest.current)throw Error('Dosya kimliği doğrulanamadı. Dosyayı tekrar seçin.');
        const payload={fileName:parseResult.meta.fileName,reportPeriod:parseResult.meta.reportPeriod,reportDateRange:parseResult.meta.reportDateRange,rows:parseResult.rows};
        const scope={actorId:user.id,tenantId:tenant.data};
        const id=await reserveMizan(scope,fileDigest.current,payload,localStorage,navigator.locks);
        command.current={id,...scope,payload};
      }
      const pending=command.current;
      if(pending.actorId!==user.id||pending.tenantId!==tenant.data)throw Error('Onay sırasında hesap veya çalışma alanı değişti. Dosyayı yeniden seçin.');
      const result=await supabase.rpc('confirm_mizan_atomic',{p_id:pending.id,p_tenant_id:pending.tenantId,p_payload:pending.payload});
      if(result.error){
        if(isRejectedMizanInput(result.error)){
          await settleMizan(pending,pending.id,localStorage,navigator.locks);command.current=null;
          throw Error('Dosya verisi veya firma eşlemesi reddedildi; yeni aktarım kaydedilmedi. Verileri düzeltip dosyayı yeniden seçin.');
        }
        throw Error('Aktarım onaylanamadı veya yanıt alınamadı. Aynı onayı tekrar deneyebilirsiniz.');
      }
      if(result.data!==pending.id)throw Error('Aktarım sonucu doğrulanamadı. Aynı onayı tekrar deneyin.');

      setConfirmed(true);
      try{await settleMizan(pending,pending.id,localStorage,navigator.locks);}catch{setError('Aktarım kaydedildi; tarayıcıdaki kurtarma kaydı temizlenemedi. Aynı dosyayla tekrar doğrulayabilirsiniz.');}
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onaylama basarisiz.");
    } finally {
      setConfirming(false);
    }
  }

  function handleReset() {
    setParseResult(null);
    command.current=null;
    fileDigest.current=null;
    setConfirmed(false);
    setError(null);
  }

  // Summary stats
  const stats = parseResult ? {
    total: parseResult.meta.totalRows,
    matched: parseResult.meta.matchedCount,
    unmatched: parseResult.meta.unmatchedCount,
    ambiguous: parseResult.meta.ambiguousCount,
    totalReceivable: parseResult.rows.reduce((s, r) => s + r.borcBakiyesi, 0),
    matchedReceivable: parseResult.rows.filter((r) => r.matchStatus === "matched").reduce((s, r) => s + r.borcBakiyesi, 0),
  } : null;

  return (
    <>
      <PageHeader title="Luca Mizan Import" subtitle="Muhasebe raporu kaynakli alacak gorunumu — yonetim gorunurlugu" />
      <p className="mb-4 text-sm text-slate-600">Onay sırasında bağlantı kesilirse veya sayfayı yenilerseniz aynı Excel dosyasını yeniden seçin. Bekleyen onay aynı işlemle sürdürülür. Tarayıcıda mali satırlar saklanmaz; tarayıcı verilerini silmek kurtarma bilgisini de siler.</p>

      <div className="space-y-6 max-w-5xl">

        {/* Trust banner */}
        <div className={`${TYPE_CAPTION} ${TEXT_MUTED} border ${BORDER_DEFAULT} ${RADIUS_SM} px-3 py-2 flex items-center gap-2`}>
          <HelpCircle size={14} />
          Bu veriler yuklenen mizan dosyasindan turetilmistir. Resmi muhasebe kaydi yerine gecmez.
        </div>

        {/* Upload area */}
        {!parseResult && !confirmed && (
          <div className="space-y-4">
            <p className={`${TYPE_BODY} ${TEXT_SECONDARY}`}>
              Luca mizan (Excel) dosyanizi yukleyin. Sistem 120.xxx musteri alacak satirlarini otomatik ayiklar ve BPS firmalariyla eslestirir.
            </p>
            <label className={`block border-2 border-dashed ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors`}>
              <Upload size={32} className={`mx-auto ${TEXT_MUTED} mb-3`} />
              <p className={`${TYPE_BODY} ${TEXT_BODY}`}>Mizan dosyasi secmek icin tiklayin</p>
              <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-1`}>.xlsx veya .xls formati</p>
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        )}

        {/* Preview */}
        {parseResult && !confirmed && stats && (
          <div className="space-y-4">
            {/* Meta info */}
            {(parseResult.meta.reportPeriod || parseResult.meta.reportDateRange) && (
              <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>
                {parseResult.meta.reportPeriod && <>Donem: {parseResult.meta.reportPeriod}</>}
                {parseResult.meta.reportPeriod && parseResult.meta.reportDateRange && <> — </>}
                {parseResult.meta.reportDateRange && <>Tarih araligi: {parseResult.meta.reportDateRange}</>}
              </p>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-3`}>
                <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Toplam musteri</p>
                <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{stats.total}</p>
              </div>
              <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-3`}>
                <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Eslesen</p>
                <p className={`${TYPE_BODY} font-medium text-green-700`}>{stats.matched}</p>
              </div>
              <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-3`}>
                <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Eslesmeyen</p>
                <p className={`${TYPE_BODY} font-medium text-amber-600`}>{stats.unmatched}</p>
              </div>
              {stats.ambiguous > 0 && (
                <div className={`${SURFACE_PRIMARY} border border-red-200 ${RADIUS_DEFAULT} p-3`}>
                  <p className={`${TYPE_CAPTION} text-red-600`}>Belirsiz</p>
                  <p className={`${TYPE_BODY} font-medium text-red-700`}>{stats.ambiguous}</p>
                </div>
              )}
              <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-3`}>
                <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Toplam borc bakiyesi</p>
                <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{formatCurrency(stats.totalReceivable)}</p>
              </div>
            </div>

            {/* Row table */}
            <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={`px-3 py-2 text-left ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Hesap Kodu</th>
                      <th className={`px-3 py-2 text-left ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Hesap Adi</th>
                      <th className={`px-3 py-2 text-right ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Borc Bakiyesi</th>
                      <th className={`px-3 py-2 text-right ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Alacak Bakiyesi</th>
                      <th className={`px-3 py-2 text-left ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Eslestirme</th>
                      <th className={`px-3 py-2 text-left ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>BPS Firma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.rows.map((row, i) => {
                      const badge = MATCH_BADGE[row.matchStatus];
                      return (
                        <tr key={i} className={`border-t ${BORDER_SUBTLE} ${row.matchStatus === "unmatched" ? "bg-amber-50/30" : ""}`}>
                          <td className={`px-3 py-2 ${TYPE_CAPTION} ${TEXT_MUTED} font-mono`}>{row.accountCode}</td>
                          <td className={`px-3 py-2 ${TYPE_BODY} ${TEXT_BODY} max-w-[250px] truncate`}>{row.accountName}</td>
                          <td className={`px-3 py-2 text-right ${TYPE_BODY} font-medium ${row.borcBakiyesi > 0 ? TEXT_PRIMARY : TEXT_MUTED}`}>{formatCurrency(row.borcBakiyesi)}</td>
                          <td className={`px-3 py-2 text-right ${TYPE_BODY} ${TEXT_MUTED}`}>{formatCurrency(row.alacakBakiyesi)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ring-1 ring-inset ${badge.color}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className={`px-3 py-2 ${TYPE_CAPTION} ${row.matchedCompanyName ? "text-green-700" : TEXT_MUTED}`}>
                            {row.matchedCompanyName ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleConfirm}
                disabled={
                  parseResult.rows.length === 0 ||
                  parseResult.errors.length > 0 ||
                  confirming
                }
                className={`px-4 py-2 text-sm font-medium text-white bg-slate-900 ${RADIUS_SM} hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed`}
                title={
                  parseResult.errors.length > 0
                    ? "Dosyada geçersiz sayı içeren satırlar var — düzeltip yeniden yükleyin."
                    : undefined
                }
              >
                {confirming ? "Kaydediliyor..." : "Onayla ve Kaydet"}
              </button>
              <button onClick={handleReset} disabled={confirming} className={`px-4 py-2 text-sm font-medium ${TEXT_BODY} bg-white border ${BORDER_DEFAULT} ${RADIUS_SM} hover:bg-slate-50 disabled:opacity-40`}>
                Iptal
              </button>
              {stats.unmatched > 0 && (
                <p className={`${TYPE_CAPTION} text-amber-600 flex items-center gap-1`}>
                  <AlertTriangle size={12} />
                  {stats.unmatched} eslesmeyen satir onaydan sonra da gorunur kalir
                </p>
              )}
            </div>
          </div>
        )}

        {/* Confirmed */}
        {confirmed && stats && (
          <div className="space-y-4">
            <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-6 text-center`}>
              <CheckCircle size={32} className="mx-auto text-green-600 mb-3" />
              <h2 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY} mb-2`}>Mizan Verisi Kaydedildi</h2>
              <div className={`${TYPE_BODY} ${TEXT_BODY} space-y-1`}>
                <p>{stats.total} musteri satiri islendi</p>
                <p className="text-green-700">{stats.matched} firma eslesmesi basarili</p>
                {stats.unmatched > 0 && <p className="text-amber-600">{stats.unmatched} satir eslesme bulunamadi</p>}
                {stats.ambiguous > 0 && <p className="text-red-600">{stats.ambiguous} satir belirsiz eslestirme (birden fazla firma adayi)</p>}
              </div>
              <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-3`}>
                Mizan kaynakli gorunum — resmi muhasebe kaydi yerine gecmez
              </p>
            </div>
            <button onClick={handleReset} className={`px-4 py-2 text-sm font-medium text-white bg-slate-900 ${RADIUS_SM} hover:bg-slate-800`}>
              Yeni Yukleme
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className={`${RADIUS_DEFAULT} border border-red-200 bg-red-50 p-4 text-sm text-red-700`}>{error}</div>
        )}
      </div>
    </>
  );
}
