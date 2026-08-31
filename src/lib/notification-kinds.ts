/**
 * BPS — e-posta bildirim tipleri, eşikleri ve alıcı kuralları.
 *
 * Tek kaynak: hem cron toplayıcıları hem e-posta kurucuları buradan okur.
 * Migration `20260827000200_create_notification_log.sql` KARAR 4: eşikler
 * kodda sabit, konfigüre edilebilir DEĞİL — `Ayarlar > Bildirim Kuralları`
 * sekmesi bugün boş bir placeholder (`ayarlar/page.tsx:617`), bağlı bir
 * kural altyapısı yok.
 *
 * KAPSAM SINIRI — Batch 10 kararının geri alınan kısmı YALNIZ e-postadır.
 * Bu dosya push, badge, okundu durumu ya da uygulama içi bildirim merkezi
 * için hiçbir şey tanımlamaz; onlar A aşamasının ayrı kararı.
 */

import type { UserRole } from "@/context/AuthContext";

/** DB'deki `notification_log.kind` CHECK listesiyle birebir aynı olmalı. */
export const NOTIFICATION_KINDS = [
  "contract_expiry",
  "task_overdue",
  "document_expiry",
  "appointment_reminder",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * Eşik anahtarları. `notification_log.threshold_key` sütununa yazılır ve
 * idempotency anahtarının parçasıdır — bir değeri değiştirmek, o tipin
 * geçmiş tüm gönderimlerini "hiç gönderilmemiş" hale getirir ve yeniden
 * mail attırır. Değiştirmeden önce bunu bilerek yap.
 */
export const NOTIFICATION_THRESHOLDS: Record<NotificationKind, string> = {
  // `getApproachingLevel("approaching")` ile hizalı — mevcut V1 davranışı.
  contract_expiry: "30d",
  // Gecikme bir gün sayısı değil, bir durum. Sayıya zorlamak anlamsız
  // olurdu (bkz. migration KARAR 1, threshold_days -> threshold_key).
  task_overdue: "overdue",
  // Evrak `süresi_yaklaşıyor` eşiğiyle aynı pencere.
  document_expiry: "30d",
  // Ziyaretten bir gün önce.
  appointment_reminder: "1d",
};

/** Gün cinsinden pencere. `task_overdue` için pencere yok (durum bazlı). */
export const NOTIFICATION_WINDOW_DAYS: Record<NotificationKind, number | null> = {
  contract_expiry: 30,
  task_overdue: null,
  document_expiry: 30,
  appointment_reminder: 1,
};

/** E-posta konusunda ve gövdesinde kullanılan Türkçe başlıklar. */
export const NOTIFICATION_LABELS: Record<NotificationKind, string> = {
  contract_expiry: "Süresi yaklaşan sözleşmeler",
  task_overdue: "Geciken görevler",
  document_expiry: "Süresi dolan evraklar",
  appointment_reminder: "Yarınki ziyaretler",
};

/**
 * Alıcı stratejisi — her tip için KİM mail alır.
 *
 * `owner`  : kaydın gerçek sahibi (`assigned_to_user_id`). A batch'i bu kolonu
 *            okunur yaptığı için mümkün; sahibi yoksa `fallbackToYonetici`
 *            devreye girer — sahipsiz iş sessizce kaybolmaz (WORKFLOW_RULES
 *            "sahipsiz iş yasağı" ile aynı yön).
 * `role`   : sabit bir rol kümesi (ROLE_MATRIX §4'teki okuma yetkisiyle
 *            hizalı — bildirim, kişinin zaten göremediği bir kaydı
 *            duyurmamalı).
 * `company`: firmayı gören taraf — global `yonetici` + o firmaya atanmış
 *            `partner`. Mevcut contract-expiry davranışı bu.
 */
export type RecipientStrategy =
  | { mode: "company"; includePartners: boolean }
  | { mode: "role"; roles: readonly UserRole[] }
  | { mode: "owner"; fallbackToYonetici: boolean };

/**
 * Görev OKUYABİLEN roller — ROLE_MATRIX §4 "Görev görüntüleme" satırı
 * (yönetici Evet · partner HOLD · operasyon Evet · ik Evet · muhasebe Hayır ·
 * görüntüleyici Hayır).
 *
 * Neden gerekli: `tasks.assigned_to_user_id` herhangi bir profili gösterebilir.
 * Bir görev `muhasebe` ya da `goruntuleyici` bir kullanıcıya atanmışsa, ona
 * bildirim göndermek "bildirim yetki genişletmez" kuralını çiğner — kişi
 * mailde okuduğu kaydı uygulamada AÇAMAZ.
 *
 * ⚠ `partner` LİSTEDE DEĞİL, ve bu bir eksiklik değil karar (2026-08-27, Codex
 * 2. tur). İlk hâlde içerideydi ve "atama zaten portföy içinden yapılır"
 * gerekçesiyle boşluk teorik sayılmıştı. Üç ölçüm bunu çürüttü:
 *   - Tenant üyeliği tenant'ı doğrular, `partner_company_assignments`'ı DEĞİL:
 *     partner'ın o görevin firmasına atanmış olduğu hiçbir yerde kontrol
 *     edilmiyordu.
 *   - Assignee picker'ın tenant/firma kapsamsız olduğu zaten kayıtlı (Step 3 b),
 *     yani portföy dışı atama gerçekten mümkün.
 *   - FROZEN/HOLD bir rol OLMAK, e-posta teslimatını durdurmaz. Login gate'i
 *     ne yaparsa yapsın cron o adrese mail atar.
 *
 * Alternatif, scope kontrolünü bildirim katmanına taşımaktı. Seçilmedi:
 * ROLE_MATRIX §4'te partner'ın BÜTÜN hücreleri `HOLD` — aktif yetkisi olmayan
 * bir rol için portföy altyapısı yazmak, verilmemiş bir ürün kararını koda
 * gömmek olurdu. Partner HOLD'dan çıkarıldığında burası yeniden açılır ve o
 * gün `current_user_has_company_scope` eşleniği bir kontrolle gelir.
 *
 * Pratik sonuç: partner'a atanmış geciken bir görev sahipsiz muamelesi görür ve
 * yöneticiye bildirilir. İş görünmez olmaz, yalnız doğru kişiye gider.
 */
export const TASK_READABLE_ROLES: readonly UserRole[] = [
  "yonetici",
  "operasyon",
  "ik",
];

export const NOTIFICATION_RECIPIENTS: Record<NotificationKind, RecipientStrategy> = {
  // Değişmedi: yonetici (global) + o firmanın partner'ları.
  contract_expiry: { mode: "company", includePartners: true },

  // Görevin sahibine gider. Sahipsizse yöneticiye — aksi halde tam da
  // kimsenin sahiplenmediği iş sessizce hiç bildirilmezdi.
  task_overdue: { mode: "owner", fallbackToYonetici: true },

  // ROLE_MATRIX §4 "Evrak görüntüleme": yonetici Evet, operasyon Evet,
  // ik Evet, muhasebe/goruntuleyici Hayır. Bildirim o satırı genişletmez.
  // `operasyon` bilerek DIŞARIDA: evrak uyumluluğunun sahibi ik, ve her
  // operasyon kullanıcısına günlük evrak maili atmak gürültü olurdu.
  document_expiry: { mode: "role", roles: ["yonetici", "ik"] },

  // `appointments` tablosunda sorumlu kolonu YOK (ölçüldü) — kayıttan bir
  // sahip çıkarılamıyor, bu yüzden firma tarafına düşüyor.
  //
  // ⚠ `contract_expiry`'den TEK FARKI: partner'a GİTMEZ. Partner'ın okuma
  // görünürlüğü ROLE_MATRIX'te HOLD; contract-expiry'nin partner'a gitmesi
  // ise daha önce kabul edilmiş, YAŞAYAN bir istisna. Bir istisnanın varlığı,
  // yeni bir yüzeyi aynı role otomatik açmaz — o ayrı bir ürün kararı ve
  // verilmedi. Partner HOLD'dan çıkarsa burası yeniden değerlendirilir.
  //
  // Randevuya gerçek bir sahip kolonu eklenirse strateji `owner`'a geçmelidir.
  appointment_reminder: { mode: "company", includePartners: false },
};

/**
 * `tasks.due_date` bir `text` kolonu (`date` değil — 20260407000800).
 * Gecikme karşılaştırması bu yüzden tip güvenli değil: kolon herhangi bir
 * metni tutabilir. Karşılaştırmadan önce ISO (YYYY-MM-DD) olduğu burada
 * doğrulanır, aksi halde satır atlanır.
 *
 * Bu bir çözüm değil, bir siper. Kolonun `date` olması gerekirdi; dönüşüm
 * ayrı bir kalem (TASK_ROADMAP).
 */
export function isIsoDate(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(t)) return false;
  // ROUND-TRIP ZORUNLU. `Date.parse` takvimde olmayan günleri reddetmez,
  // SESSİZCE KAYDIRIR: "2026-02-30" NaN değil, 2026-03-02 olur (ölçüldü).
  // Yalnız `Number.isFinite` bakan bir kontrol, olmayan bir tarihi geçerli
  // sayar ve o görevi iki gün geç "gecikmiş" gösterirdi.
  return new Date(t).toISOString().slice(0, 10) === value;
}
