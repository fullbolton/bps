/**
 * BPS — `notification_log` yazma katmanı (idempotency defteri).
 *
 * Mevcut contract-expiry akışının deseni buraya taşındı ve genelleştirildi:
 *
 *   STAMP-FIRST, SEND-SECOND, gönderim başarısızsa STAMP ROLLBACK.
 *
 * Neden bu sıra: gönderim ile damga arasında bir çökme olursa, damga önce
 * atılmışsa sonuç "bir alıcı bir maili kaçırdı" olur; damga sonra atılsaydı
 * sonuç "aynı mail tekrar gönderildi" olurdu. İkincisi kullanıcıya doğrudan
 * zarar verir ve geri alınamaz, birincisi bir sonraki tetikte telafi
 * edilebilir. V1 için bilinçli takas — mevcut akıştan devralındı.
 *
 * Bu dosya YALNIZ service_role istemcisiyle çağrılır (cron). Tablo RLS açık
 * ve policy'siz: kullanıcı bağlamından bir YAZMA denemesi RLS ihlaliyle
 * HATA döner (sessizce sıfır satır değil — o yalnız OKUMA için geçerli, boş
 * sonuç gelir). Yani yazma tarafı fail-closed, okuma tarafı sessiz-boş.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { NotificationKind } from "@/lib/notification-kinds";
import { safeDbError } from "./safe-error";

type Client = SupabaseClient<Database>;

export interface NotificationStampKey {
  kind: NotificationKind;
  entityId: string;
  recipientProfileId: string;
  thresholdKey: string;
  /** VERİDEN gelir — tetikleyen kaydın kendi tenant'ı, oturumdan DEĞİL. */
  tenantId: string;
}

export type StampOutcome =
  | { status: "stamped" }
  | { status: "already_sent" }
  | { status: "failed"; error: string };

/**
 * Damgayı at. Aynı anahtar zaten varsa (Postgres 23505) bu bir hata değil,
 * "bu bildirim daha önce gönderilmiş" cevabıdır.
 */
export async function stampNotification(
  client: Client,
  key: NotificationStampKey,
): Promise<StampOutcome> {
  const { data, error } = await client
    .from("notification_log")
    .insert({
      kind: key.kind,
      entity_id: key.entityId,
      recipient_profile_id: key.recipientProfileId,
      threshold_key: key.thresholdKey,
      tenant_id: key.tenantId,
    })
    .select("kind")
    .maybeSingle();

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return { status: "already_sent" };
    return { status: "failed", error: safeDbError(error) };
  }

  // Beklenmeyen: hata yok ama satır dönmedi. Bu bir RLS senaryosu DEĞİL —
  // yazma RLS'e takılsaydı hata dönerdi (üstteki nota bak). Buraya yalnız
  // PostgREST'in beklenmedik bir cevabı düşer. "Gönderilmiş" sayılır: yanlış
  // tarafa düşmek, aynı maili ikinci kez atmaktan iyidir.
  if (!data) return { status: "already_sent" };

  return { status: "stamped" };
}

/**
 * Gönderim başarısız olduğunda damgayı geri al ki bir sonraki koşu yeniden
 * denesin. Rollback'in kendisi başarısız olursa bu SESSİZ GEÇİLMEZ: o satır
 * kalıcı olarak "gönderildi" görünür ve mail hiç gitmez.
 */
export async function rollbackStamp(
  client: Client,
  key: NotificationStampKey,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client
    .from("notification_log")
    .delete()
    .eq("kind", key.kind)
    .eq("entity_id", key.entityId)
    .eq("recipient_profile_id", key.recipientProfileId)
    .eq("threshold_key", key.thresholdKey);

  if (error) return { ok: false, error: safeDbError(error) };
  return { ok: true };
}
