/**
 * BPS — hata metinlerini loga güvenli hâle getirme.
 *
 * ---------------------------------------------------------------------------
 * NEDEN VAR
 * ---------------------------------------------------------------------------
 * Cron ucu `result.errors` dizisinin TAMAMINI `console.error` ile yazıyor ve o
 * satırlar Vercel loglarında duruyor. Dizinin içine ne koyduğumuz, doğrudan
 * loga ne yazdığımızdır.
 *
 * İlk düzeltmede yalnız `recipient.email` çıkarıldı — YETERSİZDİ (Codex 4. tur).
 * Geriye iki opak kaynak kalmıştı:
 *
 *   1. `sendEmail`'in `error` alanı — Resend'in kendi metni. Geçersiz bir
 *      adres reddedildiğinde vendor o adresi mesajın İÇİNDE tekrar edebilir.
 *      Yani adresi biz koymasak da mesajla birlikte geri gelebilir.
 *   2. Supabase `error.message` — serbest metin. Bugün PII taşımıyor olabilir,
 *      ama bunu garanti eden bir şey yok; sürüm değişince içeriği değişir.
 *
 * Kural: **loga yalnız KATEGORİ, KOD ve DAHİLİ ID gider.** Serbest metin
 * gitmez. Teşhis için kod yeterli (`23505` idempotency çakışması, `PGRST116`
 * satır yok, HTTP `422` vendor reddi); ayrıntı gerekirse o kodla vendor
 * panelinden ya da DB'den bakılır.
 *
 * ⚠ Bu dosyadaki fonksiyonların döndürdüğü değerler LOGLANABİLİR olmalıdır.
 *   Buraya serbest metin ekleyen bir değişiklik, sızıntıyı geri açar.
 */

/** Supabase / PostgREST hata nesnesinin loglanabilir kısmı. */
export function safeDbError(
  error: { code?: string | null; message?: string } | null | undefined,
): string {
  if (!error) return "unknown";
  const code = error.code;
  // `message` BİLEREK okunmuyor. Kod yoksa bile metin taşınmaz.
  return code ? `code=${code}` : "code=unknown";
}

/** Resend / transport hatasının loglanabilir kısmı. */
export function safeSendError(result: {
  status?: number;
  error?: string;
}): string {
  // Transport'un serbest metni (`result.error`) BİLEREK okunmuyor — vendor
  // reddettiği adresi mesajın içinde tekrar edebilir.
  if (typeof result.status === "number") return `http=${result.status}`;
  // Status yoksa neden ağ hatası ya da eksik konfigürasyondur; ikisi de
  // status üretmez ve ayrımı burada yapılamaz.
  return "transport=no-status";
}

/** Beklenmeyen exception'ın loglanabilir kısmı. */
export function safeThrown(err: unknown): string {
  // `err.message` BİLEREK okunmuyor: nereden geldiği bilinmiyor, içeriği
  // garanti edilemez. Sınıf adı teşhis için yeterli bir başlangıç.
  if (err instanceof Error) return `thrown=${err.name}`;
  return "thrown=unknown";
}
