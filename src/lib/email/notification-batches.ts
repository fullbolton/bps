/**
 * BPS — üç yeni e-posta bildirim tipinin toplayıcısı ve göndericisi.
 *
 *   task_overdue          geciken görevler   → görevin sahibine
 *   document_expiry       süresi dolan evrak → yonetici + ik
 *   appointment_reminder  yarınki ziyaret    → firmayı görenlere
 *
 * `contract_expiry` bu dosyada DEĞİL — kendi dosyasında kaldı
 * (`contract-expiry-email.ts`), yalnız defteri `notification_log`'a taşındı.
 *
 * ---------------------------------------------------------------------------
 * SPAM KORUMASI — alıcı başına TİP başına TEK mail
 * ---------------------------------------------------------------------------
 * Bir kullanıcının on geciken görevi varsa on mail almaz: o tipteki bütün
 * kalemleri tek bir mailde listelenir. Damgalar yine KALEM BAŞINA atılır, yani
 * idempotency tanesi tanesine korunur — yarın iki yeni görev gecikirse mail
 * yalnız o ikisini içerir, dünkü sekizi tekrar anlatmaz.
 *
 * Bu bir "günlük özet" DEĞİLDİR. Modül planındaki özet/digest fikri tipleri
 * TEK mailde birleştirir ve `TASK_ROADMAP`'te Contract Expiry canlı pilotuna
 * sıralama-bloklu duruyor. Buradaki gruplama tip içinde kalır ve o kararı
 * ne verir ne de ima eder.
 *
 * ---------------------------------------------------------------------------
 * GÖNDERİM SIRASI
 * ---------------------------------------------------------------------------
 * Bir mailin kalemleri önce TEK TEK damgalanır, sonra tek mail gönderilir.
 * Gönderim başarısızsa o mailin BÜTÜN damgaları geri alınır — aksi halde
 * kalemler "gönderildi" görünür ve bir daha hiç denenmez.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  NOTIFICATION_LABELS,
  NOTIFICATION_RECIPIENTS,
  NOTIFICATION_THRESHOLDS,
  NOTIFICATION_WINDOW_DAYS,
  isIsoDate,
  TASK_READABLE_ROLES,
  type NotificationKind,
} from "@/lib/notification-kinds";
import {
  dedupeRecipients,
  fetchProfilesByIds,
  fetchProfilesByRoles,
  resolveCompanyRecipients,
  loadTenantScope,
  type RecipientRow,
  type TenantScope,
} from "@/lib/email/notification-recipients";
import { stampNotification, rollbackStamp } from "@/lib/email/notification-log";
import { sendEmail } from "@/lib/email/resend-transport";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/appointment-types";
import type { UserRole } from "@/context/AuthContext";

type Client = SupabaseClient<Database>;

export interface KindRunResult {
  kind: NotificationKind;
  itemsFound: number;
  mailsSent: number;
  itemsSkippedIdempotent: number;
  /** Alıcının üye olmadığı tenant'a ait olduğu için düşen kalem sayısı. */
  itemsDroppedCrossTenant: number;
  mailsFailed: number;
  errors: string[];
}

/** Bir alıcıya gidecek tek bir kalem. */
interface Item {
  entityId: string;
  tenantId: string;
  /** Mailde görünen tek satır. */
  line: string;
  /** Sıralama anahtarı — en acil üstte. */
  sortKey: string;
}

function isoDay(d: Date): string {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function formatDateTR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = iso.slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : iso;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Toplayıcılar — her biri (alıcı → kalemler) haritası döndürür
// ---------------------------------------------------------------------------

/**
 * Geciken görevler.
 *
 * İki kaynak birlikte kullanılıyor:
 *   - `status = 'gecikti'` — STATUS_DICTIONARY'nin kendi gecikme değeri
 *   - `status IN ('acik','devam_ediyor')` VE `due_date` bugünden önce
 *
 * İkincisi gerekli çünkü `gecikti` statüsünü otomatik yazan bir mekanizma
 * YOK (ölçüldü: `tasks.due_date` hiçbir yerde karşılaştırılmıyor). Yalnız
 * statüye bakılsaydı, kimse elle işaretlemediği sürece hiçbir bildirim
 * çıkmazdı.
 *
 * `due_date` bir `text` kolonu, `date` değil. ISO doğrulaması yapılmadan
 * karşılaştırılırsa çöp değerler sessizce "gecikmiş" sayılabilir — bu yüzden
 * `isIsoDate` süzgeci var ve geçmeyen satır ATLANIR, tahmin edilmez.
 * (`isIsoDate` round-trip yapar: `2026-02-30` gibi takvimde olmayan bir gün
 * `Date.parse`'ı geçer ama reddedilir — ölçüldü.)
 *
 * AÇIK KARAR — `status = 'gecikti'` bu süzgece TABİ DEĞİL, bilerek:
 * statü açık bir insan beyanıdır ("bu görev gecikti"), `due_date` ise yalnız
 * yardımcı bilgi. Bozuk bir tarih yüzünden, birinin elle gecikmiş işaretlediği
 * gerçek bir görevi bildirmemek yanlış tarafa düşmek olurdu. Böyle bir satır
 * yine bildirilir ve mailde termin alanı "tarih yok" yazar — uydurulmuş bir
 * tarih gösterilmez.
 */
async function collectTaskOverdue(
  client: Client,
  now: Date,
): Promise<{ byRecipient: Map<string, { recipient: RecipientRow; items: Item[] }>; found: number; errors: string[] }> {
  const errors: string[] = [];
  const today = isoDay(now);
  const byRecipient = new Map<string, { recipient: RecipientRow; items: Item[] }>();

  const { data: rows, error } = await client
    .from("tasks")
    .select("id, title, status, due_date, assigned_to_user_id, tenant_id, company_id")
    .in("status", ["acik", "devam_ediyor", "gecikti"]);

  if (error) {
    errors.push(`tasks fetch failed: ${error.message}`);
    return { byRecipient, found: 0, errors };
  }

  const overdue = (rows ?? []).filter((t) => {
    if (t.status === "gecikti") return true;
    if (!isIsoDate(t.due_date)) return false;
    return t.due_date < today;
  });

  if (overdue.length === 0) return { byRecipient, found: 0, errors };

  const strategy = NOTIFICATION_RECIPIENTS.task_overdue;
  const ownerIds = Array.from(
    new Set(overdue.map((t) => t.assigned_to_user_id).filter((v): v is string => Boolean(v))),
  );
  const owners = await fetchProfilesByIds(client, ownerIds);
  if (owners.error) errors.push(owners.error);

  // Sahipsiz görevler için yönetici yedeği — "sahipsiz iş yasağı" ile aynı
  // yön: sahibi olmayan iş sessizce kimseye bildirilmemiş olmaz.
  let fallback: RecipientRow[] = [];
  if (strategy.mode === "owner" && strategy.fallbackToYonetici) {
    const y = await fetchProfilesByRoles(client, ["yonetici"]);
    if (y.error) errors.push(y.error);
    fallback = y.rows;
  }

  for (const t of overdue) {
    const assignee = t.assigned_to_user_id ? owners.byId.get(t.assigned_to_user_id) : undefined;

    // ROL KAPISI — bildirim yetki genişletmez. `assigned_to_user_id` herhangi
    // bir profili gösterebilir; görevi OKUYAMAYAN bir role (muhasebe,
    // goruntuleyici) mail atmak, kişiye açamayacağı bir kaydı anlatmak olurdu.
    // Böyle bir durumda görev sahipsiz muamelesi görür ve yöneticiye düşer —
    // sessizce kaybolmasındansa doğru kişiye gitmesi yeğdir.
    const owner =
      assignee && TASK_READABLE_ROLES.includes(assignee.role as (typeof TASK_READABLE_ROLES)[number])
        ? assignee
        : undefined;
    const unreadableAssignee = assignee !== undefined && owner === undefined;

    const targets = owner ? [owner] : fallback;
    const due = isIsoDate(t.due_date) ? formatDateTR(t.due_date) : "tarih yok";
    const suffix = owner
      ? ""
      : unreadableAssignee
        ? ` (atanan kişi görevleri göremiyor: ${assignee.role})`
        : " (atanmamış)";
    const line = `${t.title} — termin: ${due}${suffix}`;

    for (const r of dedupeRecipients(targets)) {
      let bucket = byRecipient.get(r.id);
      if (!bucket) {
        bucket = { recipient: r, items: [] };
        byRecipient.set(r.id, bucket);
      }
      bucket.items.push({
        entityId: t.id,
        tenantId: t.tenant_id,
        line,
        sortKey: isIsoDate(t.due_date) ? t.due_date : "9999-12-31",
      });
    }
  }

  return { byRecipient, found: overdue.length, errors };
}

/**
 * Süresi yaklaşan / dolan evraklar.
 *
 * `documents.validity_date` bir gerçek `date` kolonu (NULL = süresiz), bu
 * yüzden pencere doğrudan SQL'de filtrelenebiliyor — görevlerdeki metin
 * kolonu sorunu burada yok.
 *
 * Alıcı: `yonetici` + `ik`. `operasyon` bilerek dışarıda — ROLE_MATRIX §4
 * evrak okumasını ona da veriyor ama evrak uyumluluğunun sahibi `ik`, ve
 * her operasyon kullanıcısına günlük evrak maili atmak gürültü olurdu.
 */
async function collectDocumentExpiry(
  client: Client,
  now: Date,
): Promise<{ byRecipient: Map<string, { recipient: RecipientRow; items: Item[] }>; found: number; errors: string[] }> {
  const errors: string[] = [];
  const byRecipient = new Map<string, { recipient: RecipientRow; items: Item[] }>();
  const today = isoDay(now);
  const windowDays = NOTIFICATION_WINDOW_DAYS.document_expiry ?? 30;
  const upper = addDays(today, windowDays);

  const { data: rows, error } = await client
    .from("documents")
    .select("id, name, validity_date, tenant_id")
    .not("validity_date", "is", null)
    .lte("validity_date", upper);

  if (error) {
    errors.push(`documents fetch failed: ${error.message}`);
    return { byRecipient, found: 0, errors };
  }
  if ((rows ?? []).length === 0) return { byRecipient, found: 0, errors };

  const strategy = NOTIFICATION_RECIPIENTS.document_expiry;
  const roles: readonly UserRole[] =
    strategy.mode === "role" ? strategy.roles : (["yonetici"] as const);
  const targets = await fetchProfilesByRoles(client, roles);
  if (targets.error) errors.push(targets.error);
  if (targets.rows.length === 0) return { byRecipient, found: rows?.length ?? 0, errors };

  for (const d of rows ?? []) {
    const expired = (d.validity_date ?? "") < today;
    const line = `${d.name} — ${expired ? "süresi doldu" : "geçerlilik"}: ${formatDateTR(d.validity_date)}`;
    for (const r of targets.rows) {
      let bucket = byRecipient.get(r.id);
      if (!bucket) {
        bucket = { recipient: r, items: [] };
        byRecipient.set(r.id, bucket);
      }
      bucket.items.push({
        entityId: d.id,
        tenantId: d.tenant_id,
        line,
        sortKey: d.validity_date ?? "9999-12-31",
      });
    }
  }

  return { byRecipient, found: rows?.length ?? 0, errors };
}

/**
 * Yarınki ziyaretler.
 *
 * `appointments` tablosunda sorumlu kolonu YOK (ölçüldü) — kayıttan bir sahip
 * çıkarılamıyor. Bu yüzden alıcı firma tarafı: **yalnız `yonetici`.**
 *
 * `contract_expiry` ile aynı strateji AMA aynı alıcı kümesi DEĞİL: orada
 * partner da var, burada yok (`includePartners: false`). Partner'ın okuma
 * görünürlüğü ROLE_MATRIX'te HOLD; contract-expiry'nin partner'a gitmesi
 * kabul edilmiş yaşayan bir istisna ve bir istisna yeni bir yüzeyi aynı role
 * otomatik açmaz. Randevuya gerçek bir sahip kolonu eklenirse strateji
 * `owner`'a geçmelidir.
 */
async function collectAppointmentReminder(
  client: Client,
  now: Date,
): Promise<{ byRecipient: Map<string, { recipient: RecipientRow; items: Item[] }>; found: number; errors: string[] }> {
  const errors: string[] = [];
  const byRecipient = new Map<string, { recipient: RecipientRow; items: Item[] }>();
  const target = addDays(isoDay(now), NOTIFICATION_WINDOW_DAYS.appointment_reminder ?? 1);

  const { data: rows, error } = await client
    .from("appointments")
    .select("id, meeting_type, attendee, meeting_date, company_id, tenant_id, status")
    .eq("status", "planlandi")
    .eq("meeting_date", target);

  if (error) {
    errors.push(`appointments fetch failed: ${error.message}`);
    return { byRecipient, found: 0, errors };
  }
  if ((rows ?? []).length === 0) return { byRecipient, found: 0, errors };

  const companyIds = Array.from(new Set((rows ?? []).map((a) => a.company_id)));
  const apptStrategy = NOTIFICATION_RECIPIENTS.appointment_reminder;
  const { byCompany, errors: recErrors } = await resolveCompanyRecipients(client, companyIds, {
    includePartners: apptStrategy.mode === "company" ? apptStrategy.includePartners : false,
  });
  errors.push(...recErrors);

  const { data: companyRows } = await client
    .from("companies")
    .select("id, name")
    .in("id", companyIds);
  const companyNameById = new Map((companyRows ?? []).map((c) => [c.id, c.name]));

  for (const a of rows ?? []) {
    // `appointments`'ta konu/başlık kolonu YOK — görüşme tipi ve varsa
    // katılımcı, kaydı tanımaya yeten en yakın alanlar.
    const kindLabel = APPOINTMENT_TYPE_LABELS[a.meeting_type] ?? "Ziyaret";
    const who = a.attendee ? ` · ${a.attendee}` : "";
    const line = `${companyNameById.get(a.company_id) ?? "—"} — ${kindLabel}${who} (${formatDateTR(a.meeting_date)})`;
    for (const r of byCompany.get(a.company_id) ?? []) {
      let bucket = byRecipient.get(r.id);
      if (!bucket) {
        bucket = { recipient: r, items: [] };
        byRecipient.set(r.id, bucket);
      }
      bucket.items.push({ entityId: a.id, tenantId: a.tenant_id, line, sortKey: a.meeting_date });
    }
  }

  return { byRecipient, found: rows?.length ?? 0, errors };
}

// ---------------------------------------------------------------------------
// Ortak gönderim: damgala → tek mail → başarısızsa hepsini geri al
// ---------------------------------------------------------------------------

function buildGroupedEmail(
  kind: NotificationKind,
  recipient: RecipientRow,
  items: Item[],
  appUrl: string,
): { subject: string; text: string; html: string } {
  const label = NOTIFICATION_LABELS[kind];
  const subject = `BPS — ${label} (${items.length})`;
  const lines = items.map((i) => i.line);

  const text = [
    `Merhaba ${recipient.display_name},`,
    "",
    `${label} (${items.length}):`,
    ...lines.map((l) => `- ${l}`),
    "",
    appUrl,
    "",
    "Bu e-posta BPS tarafından otomatik gönderildi.",
  ].join("\n");

  const html = [
    `<p>Merhaba ${escapeHtml(recipient.display_name)},</p>`,
    `<p><strong>${escapeHtml(label)}</strong> (${items.length}):</p>`,
    "<ul>",
    ...lines.map((l) => `<li>${escapeHtml(l)}</li>`),
    "</ul>",
    `<p><a href="${escapeHtml(appUrl)}">BPS'te aç</a></p>`,
    `<p style="color:#666;font-size:12px">Bu e-posta BPS tarafından otomatik gönderildi.</p>`,
  ].join("\n");

  return { subject, text, html };
}

async function sendGrouped(
  client: Client,
  kind: NotificationKind,
  byRecipient: Map<string, { recipient: RecipientRow; items: Item[] }>,
  fromAddress: string,
  appUrl: string,
  scope: TenantScope,
  result: KindRunResult,
): Promise<void> {
  const thresholdKey = NOTIFICATION_THRESHOLDS[kind];

  for (const { recipient, items } of byRecipient.values()) {
    // 0. TENANT KAPSAMI — alıcının üye OLMADIĞI tenant'ın kalemleri düşer.
    //    Tek yerde uygulanıyor çünkü üç toplayıcının üçü de aynı sızıntıyı
    //    üretebilir: `profiles`'ta tenant_id olmadığı için rol/owner/firma
    //    yollarının hiçbiri kendiliğinden tenant'a daralmıyor.
    const scopedItems = items.filter((i) => scope.isMember(i.tenantId, recipient.id));
    const droppedByTenant = items.length - scopedItems.length;
    if (droppedByTenant > 0) {
      result.itemsDroppedCrossTenant += droppedByTenant;
    }
    if (scopedItems.length === 0) continue;

    // 1. Kalem kalem damgala. Zaten damgalı olanlar bu mailin dışında kalır.
    const stamped: Item[] = [];
    for (const item of scopedItems) {
      const key = {
        kind,
        entityId: item.entityId,
        recipientProfileId: recipient.id,
        thresholdKey,
        tenantId: item.tenantId,
      };
      const outcome = await stampNotification(client, key);
      if (outcome.status === "already_sent") {
        result.itemsSkippedIdempotent++;
        continue;
      }
      if (outcome.status === "failed") {
        result.errors.push(`stamp failed (${kind}/${item.entityId}/${recipient.id}): ${outcome.error}`);
        continue;
      }
      stamped.push(item);
    }

    if (stamped.length === 0) continue;

    // 2. Tek mail — bu koşuda yeni damgalanan kalemler.
    stamped.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    const email = buildGroupedEmail(kind, recipient, stamped, appUrl);
    const send = await sendEmail({
      from: fromAddress,
      to: recipient.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    if (send.ok) {
      result.mailsSent++;
      continue;
    }

    // 3. Gönderim başarısız — bu mailin BÜTÜN damgalarını geri al, yoksa
    //    kalemler "gönderildi" görünür ve bir daha hiç denenmez.
    result.mailsFailed++;
    // Adres DEĞİL, profil id. Bu dizinin tamamı cron uçunda `console.error`
    // ile Vercel loglarına yazılıyor; e-posta adresi oraya düşmemeli.
    // `recipient.id` korelasyon için yeterli — kim olduğu `profiles`'tan
    // bakılır, log tek başına kişisel veri taşımaz.
    result.errors.push(`send failed (${kind} → profile ${recipient.id}): ${send.error ?? "unknown"}`);
    for (const item of stamped) {
      const rb = await rollbackStamp(client, {
        kind,
        entityId: item.entityId,
        recipientProfileId: recipient.id,
        thresholdKey,
        tenantId: item.tenantId,
      });
      if (!rb.ok) {
        // Sessiz geçilmez: bu kalem kalıcı olarak "gönderildi" görünecek
        // ve maili hiç almayacak. Operasyonun görmesi gereken tek şey bu.
        result.errors.push(
          `ROLLBACK FAILED (${kind}/${item.entityId}/${recipient.id}): ${rb.error ?? "unknown"} — bu kalem bir daha denenmeyecek`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Dışa açık koşucu
// ---------------------------------------------------------------------------

export async function runNotificationBatch(
  client: Client,
  kind: Exclude<NotificationKind, "contract_expiry">,
  now: Date,
  config: { fromAddress: string; appUrl: string },
): Promise<KindRunResult> {
  const result: KindRunResult = {
    kind,
    itemsFound: 0,
    mailsSent: 0,
    itemsSkippedIdempotent: 0,
    itemsDroppedCrossTenant: 0,
    mailsFailed: 0,
    errors: [],
  };

  const collected =
    kind === "task_overdue"
      ? await collectTaskOverdue(client, now)
      : kind === "document_expiry"
        ? await collectDocumentExpiry(client, now)
        : await collectAppointmentReminder(client, now);

  result.itemsFound = collected.found;
  result.errors.push(...collected.errors);

  if (collected.byRecipient.size === 0) return result;

  // Tenant haritası yüklenemezse HİÇ MAİL GÖNDERİLMEZ. Sızdırmaktansa
  // göndermemek: bir koşu kaçmak telafi edilebilir, yanlış tenant'a giden
  // kayıt adları geri alınamaz.
  const { scope, error: scopeError } = await loadTenantScope(client);
  if (scopeError) result.errors.push(scopeError);
  if (!scope.loaded) {
    result.errors.push(
      `tenant scope unavailable — ${kind} için hiç mail gönderilmedi (fail-closed)`,
    );
    return result;
  }

  await sendGrouped(client, kind, collected.byRecipient, config.fromAddress, config.appUrl, scope, result);
  return result;
}
