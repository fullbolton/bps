/**
 * Morning hotel email draft generator.
 * Pure formatter — takes a pre-built HotelEmailContext and returns a
 * plain-text draft. Data fetching is the caller's responsibility so the
 * helper stays free of both mock and Supabase dependencies.
 */

export interface HotelEmailContext {
  tarih: string;
  firmalar: { firmaAdi: string; lokasyon: string; aktifKisi: number }[];
  toplamKisi: number;
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
