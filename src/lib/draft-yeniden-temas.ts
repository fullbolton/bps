/**
 * Ticari Temas — Yeniden Temas (re-engagement) draft generator.
 * Template-based. Produces a professional check-in / re-engagement draft
 * for aktif firms with stale contact.
 * Draft-first, human-approved. No sending. No tracking.
 */

interface YenidenTemasContext {
  firmaAdi: string;
  anaYetkili: string;
  sonGorusme: string;
  aktifSozlesme: number;
}

export function generateYenidenTemasDraft(ctx: YenidenTemasContext): string {
  const today = new Date().toISOString().split("T")[0];

  const lines: string[] = [
    `Sayın ${ctx.anaYetkili},`,
    "",
    `${ctx.firmaAdi} ile süregelen iş birliğimiz kapsamında kısa bir değerlendirme görüşmesi yapmak istiyoruz.`,
    "",
  ];

  if (ctx.sonGorusme && ctx.sonGorusme !== "—") {
    lines.push(`Son görüşmemiz ${ctx.sonGorusme} tarihinde gerçekleşmişti.`);
  }

  if (ctx.aktifSozlesme > 0) {
    lines.push(`Şu anda ${ctx.aktifSozlesme} aktif sözleşme kapsamında birlikte çalışmaktayız.`);
  }

  lines.push("");
  lines.push("Mevcut operasyonun değerlendirilmesi ve olası ihtiyaçlarınızın görüşülmesi için uygun bir zaman diliminde bir araya gelmekten memnuniyet duyarız.");
  lines.push("");
  lines.push(`Tarih: ${today}`);
  lines.push("");
  lines.push("Saygılarımızla,");
  lines.push("BPS Satış Ekibi");

  return lines.join("\n");
}
