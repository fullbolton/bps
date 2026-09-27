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
import { safeDbError } from "./safe-error";
import { readNotificationPages } from "./read-pages";
import { completeRows } from "@/lib/supabase/complete-result";

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
  const unavailable = (error: string) => ({
    scope: { loaded: false, isMember: () => false } as TenantScope,
    error,
  });
  const byTenant = new Map<string, Set<string>>();
  try {
    const rows = await readNotificationPages(
      (from, to) => client.from("tenant_memberships")
        .select("user_id, tenant_id", { count: "exact" })
        .order("tenant_id").order("user_id").range(from, to),
      row => typeof row.tenant_id === "string" && row.tenant_id && typeof row.user_id === "string" && row.user_id
        ? JSON.stringify([row.tenant_id, row.user_id]) : null,
    );
    for (const row of rows) {
      const members = byTenant.get(row.tenant_id) ?? new Set<string>();
      members.add(row.user_id);
      byTenant.set(row.tenant_id, members);
    }
  } catch {
    return unavailable("tenant_memberships fetch failed: code=READ_INCOMPLETE");
  }
  return { scope: { loaded: true, isMember: (tenantId, profileId) => byTenant.get(tenantId)?.has(profileId) ?? false } };

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
  if (!roles.length) return { rows: [] };
  try {
    const rows = await readNotificationPages(
      (from, to) => client.from("profiles")
        .select("id, email, display_name, role", { count: "exact" })
        .in("role", [...new Set(roles)]).order("id").range(from, to),
      row => typeof row.id === "string" && row.id && roles.includes(row.role as UserRole) ? row.id : null,
    );
    return { rows: rows.filter(hasEmail) };
  } catch {
    return { rows: [], error: "profiles by role fetch failed: code=READ_INCOMPLETE" };
  }
}

/** Tek tek id'lerle profil çözümleme (owner stratejisi için). */
export async function fetchProfilesByIds(
  client: Client,
  ids: string[],
): Promise<{ byId: Map<string, RecipientRow>; error?: string }> {
  const uniqueIds = [...new Set(ids)];
  const byId = new Map<string, RecipientRow>();
  const failed = (code: string) => ({ byId: new Map<string, RecipientRow>(), error: `profiles by id fetch failed: ${code}` });
  try {
    for (let offset = 0; offset < uniqueIds.length; offset += 100) {
      const chunk = uniqueIds.slice(offset, offset + 100);
      const { data, error, count } = await client
        .from("profiles")
        .select("id, email, display_name, role", { count: "exact" })
        .in("id", chunk);
      if (error) return failed(safeDbError(error));
      const seen = new Set<string>();
      for (const profile of completeRows(data, count, "profiles")) {
        if (!chunk.includes(profile.id) || seen.has(profile.id)) return failed("code=INVALID_PROFILE_SET");
        seen.add(profile.id);
        if (hasEmail(profile)) byId.set(profile.id, profile);
      }
    }
    return { byId };
  } catch {
    return failed("code=INCOMPLETE_PROFILES");
  }

}

/** Complete assignment rows for bounded company ID batches. */
export async function fetchCompanyPartnerAssignments(client: Client, companyIds: string[]) {
  const ids = [...new Set(companyIds)];
  const rows: { company_id: string; partner_user_id: string }[] = [];
  try {
    for (let offset = 0; offset < ids.length; offset += 100) {
      const chunk = ids.slice(offset, offset + 100);
      const pageRows = await readNotificationPages(
        (from, to) => client.from("partner_company_assignments")
          .select("partner_user_id, company_id", { count: "exact" })
          .in("company_id", chunk).order("company_id").order("partner_user_id").range(from, to),
        row => chunk.includes(row.company_id) && typeof row.partner_user_id === "string" && row.partner_user_id
          ? JSON.stringify([row.company_id, row.partner_user_id]) : null,
      );
      rows.push(...pageRows);
    }
    return { rows };
  } catch {
    return { rows: [], error: "partner assignments fetch failed: code=READ_INCOMPLETE" };
  }
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
  if (yonetici.error) return { byCompany, errors: [yonetici.error] };

  const partnerIdsByCompany = new Map<string, Set<string>>();
  const allPartnerIds = new Set<string>();

  // Atama sorgusu da bayrağa TABİ. İlk hâlde yalnız profil sorgusu gate'liydi
  // ve bu, "partner'ı dışarıda bırakan çağrılar için sorgu hiç koşmaz"
  // yorumunu yanlış kılıyordu — yorum doğruydu, kod değildi.
  if (opts.includePartners) {
    const assignments = await fetchCompanyPartnerAssignments(client, companyIds);
    if (assignments.error) return { byCompany, errors: [assignments.error] };

    for (const row of assignments.rows) {
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
    const partners = await fetchProfilesByIds(client, Array.from(allPartnerIds));
    if (partners.error) return { byCompany, errors: [partners.error] };
    partnerById = new Map([...partners.byId].filter(([, profile]) => profile.role === "partner"));
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
