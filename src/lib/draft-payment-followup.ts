/**
 * Batch 9 Phase 2 — Payment follow-up draft generator.
 * Template-based. Produces a formal payment inquiry draft
 * using firma name and ticari baskı data.
 */

interface TicariBaskiContext {
  gecikmisAlacak?: string;
  kesilmemisBekleyen?: string;
}

export function generatePaymentFollowup(
  firmaAdi: string,
  tb: TicariBaskiContext,
): string {
  const today = new Date().toISOString().split("T")[0];

  const lines: string[] = [
    "Sayın Yetkili,",
    "",
    `${firmaAdi} ile süregelen iş birliğimiz kapsamında, güncel ödeme durumuna ilişkin bilgilendirme yapmak istiyoruz.`,
    "",
  ];

  if (tb.gecikmisAlacak) {
    lines.push(`Kayıtlarımıza göre ${tb.gecikmisAlacak} tutarında gecikmiş alacağımız bulunmaktadır.`);
  }

  if (tb.kesilmemisBekleyen) {
    lines.push(`Ayrıca ${tb.kesilmemisBekleyen} tutarında henüz faturaya dönüşmemiş bekleyen hizmet bedeli mevcuttur.`);
  }

  lines.push("");
  lines.push("Ödeme planı ve mevcut duruma ilişkin görüşlerinizi paylaşmanızı rica ederiz.");
  lines.push("");
  lines.push(`Tarih: ${today}`);
  lines.push("");
  lines.push("Saygılarımızla,");
  lines.push("BPS Ticari Takip");

  return lines.join("\n");
}
