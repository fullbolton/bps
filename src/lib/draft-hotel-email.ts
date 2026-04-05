/**
 * Batch 9 — Morning hotel email draft generator.
 * Template-based. Produces a consolidated daily email draft
 * covering active workforce deployments across all firms.
 */

import { MOCK_IS_GUCU } from "@/mocks/aktif-isgucu";

export interface HotelEmailContext {
  tarih: string;
  firmalar: { firmaAdi: string; lokasyon: string; aktifKisi: number }[];
  toplamKisi: number;
}

export function getHotelEmailContext(): HotelEmailContext {
  const today = new Date().toISOString().split("T")[0];
  const firmalar = MOCK_IS_GUCU.map((ig) => ({
    firmaAdi: ig.firmaAdi,
    lokasyon: ig.lokasyon,
    aktifKisi: ig.aktifKisi,
  }));
  const toplamKisi = firmalar.reduce((sum, f) => sum + f.aktifKisi, 0);
  return { tarih: today, firmalar, toplamKisi };
}

export function generateHotelEmailDraft(ctx: HotelEmailContext): string {
  const lines: string[] = [
    "Sayın Yetkili,",
    "",
    `${ctx.tarih} tarihi itibarıyla aktif personel konaklama bilgileri aşağıdadır:`,
    "",
  ];

  for (const f of ctx.firmalar) {
    lines.push(`• ${f.firmaAdi} — ${f.lokasyon}: ${f.aktifKisi} kişi`);
  }

  lines.push("");
  lines.push(`Toplam: ${ctx.toplamKisi} kişi`);
  lines.push("");
  lines.push("Konaklama düzenlemelerinin yukarıdaki bilgiler doğrultusunda yapılmasını rica ederiz.");
  lines.push("");
  lines.push("Saygılarımızla,");
  lines.push("BPS Operasyon");

  return lines.join("\n");
}
