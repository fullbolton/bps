/**
 * BPS — bildirim alıcısı çözümleme.
 *
 * Üç strateji, `notification-kinds.ts` tarafından tipe bağlanır:
 *   company : global `yonetici` + o firmaya atanmış `partner`
 *   role    : sabit rol kümesi
 *   owner   : kaydın gerçek sahibi (`assigned_to_user_id`), sahipsizse yönetici
 *
 * TEMEL KURAL — bildirim yetki genişletmez. Bir alıcı, ancak zaten
 * görebildiği bir kaydın bildirimini alır. `role` stratejisinin rol kümeleri
 * ROLE_MATRIX §4'ün okuma satırlarıyla hizalı tutulur; bir bildirim, kişinin
 * uygulamada açamayacağı bir kaydı e-postayla anlatmamalıdır.
 *
 * Yalnız service_role istemcisiyle çağrılır: alıcı sayımı bütün
 * `profiles` ve `partner_company_assignments` satırlarını görmeyi gerektirir,
 * kullanıcı bağlamında RLS bunların çoğunu gizlerdi.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { UserRole } from "@/context/AuthContext";

type Client = SupabaseClient<Database>;

export interface RecipientRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
}

function hasEmail(p: {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
}): p is RecipientRow {
  return Boolean(p.email) && Boolean(p.display_name) && Boolean(p.role);
}

// ---------------------------------------------------------------------------
// TENANT KAPSAMI — bildirim tenant sınırını AŞMAMALI
// ---------------------------------------------------------------------------

/**
 * Tenant üyelik haritası: hangi profil hangi tenant'ta üye.
 *
 * NEDEN ZORUNLU: `profiles` tablosunda `tenant_id` YOK (ölçüldü — bu, picker'ın
 * da kapsamsız olmasının sebebi, Step 3 (b)). Dolayısıyla "role göre profil
 * çek" sorgusu kaçınılmaz olarak BÜTÜN tenant'ların profillerini getirir.
 * Cron `service_role` ile çalıştığı için RLS de daraltmaz.
 *
 * Bu filtre olmasaydı: her `yonetici`/`ik`, BAŞKA tenant'ların evraklarının,
 * görevlerinin ve randevularının bildirimini alırdı — kayıt adlarıyla birlikte.
 * Bilinen tenant-kapsamsız assignee picker yüzünden bir görevin başka tenant'ın
 * kullanıcısına atanması da mümkün, yani `owner` yolu da açıktı.
 *
 * Kaynak `tenant_memberships` (repo dışı tablo, `PROD_SCHEMA_DRIFT.md`).
 */
export interface TenantScope {
  /** Profil, o tenant'ın üyesi mi? Üyelik bilinmiyorsa FALSE (fail-closed). */
  isMember(tenantId: string, profileId: string): boolean;
  /** Haritanın hiç yüklenemediği durumu ayırt etmek için. */
  loaded: boolean;
}

export async function loadTenantScope(
  client: Client,
): Promise<{ scope: TenantScope; error?: string }> {
  const { data, error } = await client
    .from("tenant_memberships")
    .select("user_id, tenant_id");

  const byTenant = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    let set = byTenant.get(row.tenant_id);
    if (!set) {
      set = new Set<string>();
      byTenant.set(row.tenant_id, set);
    }
    set.add(row.user_id);
  }

  const loaded = !error;
  const scope: TenantScope = {
    loaded,
    // FAIL-CLOSED: harita yüklenemediyse hiç kimse üye sayılmaz ve o koşuda
    // hiç mail gitmez. Alternatifi — hata durumunda herkese göndermek —
    // tam da bu filtrenin engellediği sızıntıyı üretirdi.
    isMember: (tenantId, profileId) =>
      loaded && (byTenant.get(tenantId)?.has(profileId) ?? false),
  };

  return {
    scope,
    error: error
      ? `tenant_memberships fetch failed: ${error.message}`
      : undefined,
  };
}

/** Aynı kişi iki yoldan gelebilir (hem yönetici hem atanmış partner). */
export function dedupeRecipients(rows: RecipientRow[]): RecipientRow[] {
  const byId = new Map<string, RecipientRow>();
  for (const r of rows) if (!byId.has(r.id)) byId.set(r.id, r);
  return Array.from(byId.values());
}

/** Belirli rollerdeki tüm profiller. */
export async function fetchProfilesByRoles(
  client: Client,
  roles: readonly UserRole[],
): Promise<{ rows: RecipientRow[]; error?: string }> {
  const { data, error } = await client
    .from("profiles")
    .select("id, email, display_name, role")
    .in("role", roles as UserRole[]);

  if (error)
    return {
      rows: [],
      error: `profiles(${roles.join(",")}) fetch failed: ${error.message}`,
    };
  return { rows: (data ?? []).filter(hasEmail) };
}

/** Tek tek id'lerle profil çözümleme (owner stratejisi için). */
export async function fetchProfilesByIds(
  client: Client,
  ids: string[],
): Promise<{ byId: Map<string, RecipientRow>; error?: string }> {
  if (ids.length === 0) return { byId: new Map() };
  const { data, error } = await client
    .from("profiles")
    .select("id, email, display_name, role")
    .in("id", ids);

  if (error)
    return {
      byId: new Map(),
      error: `profiles by id fetch failed: ${error.message}`,
    };
  return { byId: new Map((data ?? []).filter(hasEmail).map((p) => [p.id, p])) };
}

/**
 * Firma bazlı alıcılar: her firma için `yonetici` (global) + o firmaya
 * atanmış, HÂLÂ `partner` rolünde olan kullanıcılar.
 *
 * Rol filtresi savunma katmanı: atama satırı eski bir rol değişiminden
 * kalmış olabilir, o kişiye artık mail gitmemeli.
 */
export async function resolveCompanyRecipients(
  client: Client,
  companyIds: string[],
  opts: { includePartners: boolean },
): Promise<{ byCompany: Map<string, RecipientRow[]>; errors: string[] }> {
  const errors: string[] = [];
  const byCompany = new Map<string, RecipientRow[]>();
  if (companyIds.length === 0) return { byCompany, errors };

  const yonetici = await fetchProfilesByRoles(client, ["yonetici"]);
  if (yonetici.error) errors.push(yonetici.error);

  const partnerIdsByCompany = new Map<string, Set<string>>();
  const allPartnerIds = new Set<string>();

  // Atama sorgusu da bayrağa TABİ. İlk hâlde yalnız profil sorgusu gate'liydi
  // ve bu, "partner'ı dışarıda bırakan çağrılar için sorgu hiç koşmaz"
  // yorumunu yanlış kılıyordu — yorum doğruydu, kod değildi.
  if (opts.includePartners) {
    const { data: pcaRows, error: pcaError } = await client
      .from("partner_company_assignments")
      .select("partner_user_id, company_id")
      .in("company_id", companyIds);
    if (pcaError)
      errors.push(
        `partner_company_assignments fetch failed: ${pcaError.message}`,
      );

    for (const row of pcaRows ?? []) {
      let set = partnerIdsByCompany.get(row.company_id);
      if (!set) {
        set = new Set<string>();
        partnerIdsByCompany.set(row.company_id, set);
      }
      set.add(row.partner_user_id);
      allPartnerIds.add(row.partner_user_id);
    }
  }

  let partnerById = new Map<string, RecipientRow>();
  // partner'ın okuma görünürlüğü ROLE_MATRIX'te HOLD ve her yüzey ona
  // açılmaz (bkz. notification-kinds.ts, appointment_reminder notu).
  if (allPartnerIds.size > 0) {
    const { data: partnerRows, error: partnerError } = await client
      .from("profiles")
      .select("id, email, display_name, role")
      .in("id", Array.from(allPartnerIds))
      .eq("role", "partner");
    if (partnerError)
      errors.push(`partner profiles fetch failed: ${partnerError.message}`);
    partnerById = new Map(
      (partnerRows ?? []).filter(hasEmail).map((p) => [p.id, p]),
    );
  }

  for (const companyId of companyIds) {
    const partners = !opts.includePartners
      ? []
      : Array.from(partnerIdsByCompany.get(companyId) ?? [])
          .map((pid) => partnerById.get(pid))
          .filter((r): r is RecipientRow => r !== undefined);
    byCompany.set(companyId, dedupeRecipients([...yonetici.rows, ...partners]));
  }

  return { byCompany, errors };
}
