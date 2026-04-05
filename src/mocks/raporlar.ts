/**
 * Report-shaped datasets for Raporlar screen — Phase 3.
 * Data is reshaped from existing mocks, not raw passthrough.
 * Mutable upstream demo sources should be read live where needed.
 */

import { MOCK_IS_GUCU } from "./aktif-isgucu";
import { MOCK_SOZLESMELER, MOCK_SOZLESME_DETAY } from "./sozlesmeler";
import { MOCK_TALEPLER } from "./talepler";
import { MOCK_RANDEVULAR, RANDEVU_TIPI_LABELS } from "./randevular";
import { MOCK_FIRMALAR } from "./firmalar";
import { MOCK_EVRAKLAR } from "./evraklar";
import { getTicariBaskiByFirma, FIRMA_ALACAK_DAGILIMI, FIRMA_KESILMEMIS_DAGILIMI } from "./finansal-ozet";
import { OPERASYON_PARTNERLERI, FIRMA_PARTNER_MAP } from "./ayarlar";
import type { IsGucuRiskSeviyesi } from "@/types/batch4";
import type { RiskSeviyesi, OncelikSeviyesi, SozlesmeDurumu, TalepDurumu, RandevuDurumu } from "@/types/ui";
import type { RandevuTipi } from "./randevular";

// ---------------------------------------------------------------------------
// Report 1 — Firma Bazlı Aktif İş Gücü
// ---------------------------------------------------------------------------

export interface RaporIsGucuRow {
  firmaId: string;
  firmaAdi: string;
  lokasyon: string;
  aktifKisi: number;
  hedefKisi: number;
  acikFark: number;
  riskEtiketi: IsGucuRiskSeviyesi;
}

export const RAPOR_IS_GUCU: RaporIsGucuRow[] = MOCK_IS_GUCU.map((ig) => ({
  firmaId: ig.firmaId,
  firmaAdi: ig.firmaAdi,
  lokasyon: ig.lokasyon,
  aktifKisi: ig.aktifKisi,
  hedefKisi: ig.hedefKisi,
  acikFark: ig.acikFark,
  riskEtiketi: ig.riskEtiketi,
}));

// ---------------------------------------------------------------------------
// Report 2 — Yaklaşan Sözleşme Bitişleri (kalanGun ≤ 90)
// ---------------------------------------------------------------------------

export interface RaporSozlesmeBitisRow {
  sozlesmeAdi: string;
  firmaAdi: string;
  bitis: string;
  kalanGun: number;
  sorumlu: string;
  durum: SozlesmeDurumu;
  hazirlikDurumu: string;
}

export const RAPOR_SOZLESME_BITIS: RaporSozlesmeBitisRow[] = MOCK_SOZLESMELER
  .filter((s) => s.kalanGun !== null && s.kalanGun <= 90)
  .sort((a, b) => (a.kalanGun ?? 999) - (b.kalanGun ?? 999))
  .map((s) => {
    const detay = MOCK_SOZLESME_DETAY[s.id];
    let hazirlik = "—";
    if (detay?.ticariHazirlik) {
      const last = [...detay.ticariHazirlik.adimlar].reverse().find((a) => a.tamamlandi);
      if (last) hazirlik = `${last.adim} — ${last.tarih}`;
    }
    return {
      sozlesmeAdi: s.sozlesmeAdi,
      firmaAdi: s.firmaAdi,
      bitis: s.bitis,
      kalanGun: s.kalanGun!,
      sorumlu: s.sorumlu,
      durum: s.durum,
      hazirlikDurumu: hazirlik,
    };
  });

// ---------------------------------------------------------------------------
// Report 3 — Açık / Kapanan Talep Analizi
// ---------------------------------------------------------------------------

export interface RaporTalepRow {
  firmaAdi: string;
  pozisyon: string;
  talepEdilen: number;
  saglanan: number;
  acikKalan: number;
  oncelik: OncelikSeviyesi;
  durum: TalepDurumu;
}

export function getRaporTalepler(): RaporTalepRow[] {
  return MOCK_TALEPLER.map((t) => ({
    firmaAdi: t.firmaAdi,
    pozisyon: t.pozisyon,
    talepEdilen: t.talepEdilen,
    saglanan: t.saglanan,
    acikKalan: t.acikKalan,
    oncelik: t.oncelik,
    durum: t.durum,
  }));
}

// ---------------------------------------------------------------------------
// Report 4 — Randevu Hacmi ve Sonuçlar
// ---------------------------------------------------------------------------

export interface RaporRandevuRow {
  tarih: string;
  firmaAdi: string;
  gorusmeTipiLabel: string;
  katilimci: string;
  durum: RandevuDurumu;
  sonuc: string;
}

export function getRaporRandevular(): RaporRandevuRow[] {
  return MOCK_RANDEVULAR.map((r) => ({
    tarih: r.tarih,
    firmaAdi: r.firmaAdi,
    gorusmeTipiLabel: RANDEVU_TIPI_LABELS[r.gorusmeTipi as RandevuTipi] ?? r.gorusmeTipi,
    katilimci: r.katilimci,
    durum: r.durum,
    sonuc: r.sonuc || "—",
  }));
}

// ---------------------------------------------------------------------------
// Report 5 — Riskli Firma Listesi (composite: operational + commercial)
// ---------------------------------------------------------------------------

export interface RaporRiskliFirmaRow {
  firmaId: string;
  firmaAdi: string;
  risk: RiskSeviyesi;
  ticariBaskiOzet: string;
  acikTalep: number;
  eksikEvrak: number;
}

export function getRaporRiskliFirmalar(): RaporRiskliFirmaRow[] {
  return MOCK_FIRMALAR
    .filter((f) => f.risk === "orta" || f.risk === "yuksek")
    .map((f) => {
      const tb = getTicariBaskiByFirma(f.id);
      const ticarParts: string[] = [];
      if (tb?.gecikmisAlacak) ticarParts.push(`Gecikmiş: ${tb.gecikmisAlacak}`);
      if (tb?.kesilmemisBekleyen) ticarParts.push(`Kesilmemiş: ${tb.kesilmemisBekleyen}`);

      const acikTalep = MOCK_TALEPLER
        .filter((t) => t.firmaId === f.id)
        .reduce((sum, t) => sum + t.acikKalan, 0);

      const eksikEvrak = MOCK_EVRAKLAR
        .filter((e) => e.firmaId === f.id && e.durum !== "tam")
        .length;

      return {
        firmaId: f.id,
        firmaAdi: f.firmaAdi,
        risk: f.risk,
        ticariBaskiOzet: ticarParts.length > 0 ? ticarParts.join(" · ") : "—",
        acikTalep,
        eksikEvrak,
      };
    })
    .sort((a, b) => {
      const riskOrder: Record<string, number> = { yuksek: 0, orta: 1, dusuk: 2 };
      return (riskOrder[a.risk] ?? 3) - (riskOrder[b.risk] ?? 3);
    });
}

// ---------------------------------------------------------------------------
// Report 6 — Şehir ve Partner Operasyon Özeti
// Receivables-side ticari görünürlük kırılımı: partner → city → portfolio
// ---------------------------------------------------------------------------

export interface RaporPartnerOzetRow {
  id: string;
  partnerAdi: string;
  sehir: string;
  firmaSayisi: number;
  isGucu: number;
  acikTalep: number;
  alacakYogunlugu: string;
  kesilmemisBaski: string;
  gecikmisYogunluk: number;
  /** "partner" | "sehir-toplam" | "portfolyo-toplam" for visual grouping */
  rowType: "partner" | "sehir-toplam" | "portfolyo-toplam";
}

function parseAmount(s: string): number {
  return parseInt(s.replace(/[₺.]/g, ""), 10) || 0;
}

function formatAmount(n: number): string {
  return `₺${n.toLocaleString("tr-TR")}`;
}

export function getRaporPartnerOzet(): RaporPartnerOzetRow[] {
  const rows: RaporPartnerOzetRow[] = [];
  let rowIdx = 0;
  let portfolyoFirma = 0, portfolyoIsGucu = 0, portfolyoTalep = 0;
  let portfolyoAlacak = 0, portfolyoKesilmemis = 0, portfolyoGecikmis = 0;

  // Group partners by city
  const cityMap = new Map<string, typeof OPERASYON_PARTNERLERI>();
  for (const p of OPERASYON_PARTNERLERI) {
    if (p.durum !== "aktif") continue;
    const list = cityMap.get(p.sehir) ?? [];
    list.push(p);
    cityMap.set(p.sehir, list);
  }

  for (const [sehir, partners] of cityMap) {
    let cityFirma = 0, cityIsGucu = 0, cityTalep = 0;
    let cityAlacak = 0, cityKesilmemis = 0, cityGecikmis = 0;

    for (const partner of partners) {
      // Firms assigned to this partner
      const firmIds = Object.entries(FIRMA_PARTNER_MAP)
        .filter(([, v]) => v.partnerId === partner.id)
        .map(([fId]) => fId);

      const firmaSayisi = firmIds.length;
      const isGucu = MOCK_IS_GUCU
        .filter((ig) => firmIds.includes(ig.firmaId))
        .reduce((s, ig) => s + ig.aktifKisi, 0);
      const acikTalep = MOCK_TALEPLER
        .filter((t) => firmIds.includes(t.firmaId))
        .reduce((s, t) => s + t.acikKalan, 0);

      let alacak = 0, kesilmemis = 0, gecikmis = 0;
      for (const fId of firmIds) {
        const a = FIRMA_ALACAK_DAGILIMI.find((x) => x.firmaId === fId);
        if (a) { alacak += parseAmount(a.acikAlacak); if (a.gecikmisMi) gecikmis++; }
        const k = FIRMA_KESILMEMIS_DAGILIMI.find((x) => x.firmaId === fId);
        if (k) kesilmemis += parseAmount(k.kesilmemisBekleyen);
      }

      rows.push({
        id: `po-${++rowIdx}`,
        partnerAdi: partner.ad,
        sehir,
        firmaSayisi,
        isGucu,
        acikTalep,
        alacakYogunlugu: formatAmount(alacak),
        kesilmemisBaski: formatAmount(kesilmemis),
        gecikmisYogunluk: gecikmis,
        rowType: "partner",
      });

      cityFirma += firmaSayisi; cityIsGucu += isGucu; cityTalep += acikTalep;
      cityAlacak += alacak; cityKesilmemis += kesilmemis; cityGecikmis += gecikmis;
    }

    // City subtotal
    rows.push({
      id: `po-${++rowIdx}`,
      partnerAdi: "",
      sehir: `${sehir} Toplamı`,
      firmaSayisi: cityFirma,
      isGucu: cityIsGucu,
      acikTalep: cityTalep,
      alacakYogunlugu: formatAmount(cityAlacak),
      kesilmemisBaski: formatAmount(cityKesilmemis),
      gecikmisYogunluk: cityGecikmis,
      rowType: "sehir-toplam",
    });

    portfolyoFirma += cityFirma; portfolyoIsGucu += cityIsGucu; portfolyoTalep += cityTalep;
    portfolyoAlacak += cityAlacak; portfolyoKesilmemis += cityKesilmemis; portfolyoGecikmis += cityGecikmis;
  }

  // Portfolio total
  rows.push({
    id: `po-${++rowIdx}`,
    partnerAdi: "",
    sehir: "Portföy Toplamı",
    firmaSayisi: portfolyoFirma,
    isGucu: portfolyoIsGucu,
    acikTalep: portfolyoTalep,
    alacakYogunlugu: formatAmount(portfolyoAlacak),
    kesilmemisBaski: formatAmount(portfolyoKesilmemis),
    gecikmisYogunluk: portfolyoGecikmis,
    rowType: "portfolyo-toplam",
  });

  return rows;
}
