"use server";

/**
 * BPS Firmalar — Server Actions (firma seviyesi)
 *
 * `firmalar/[id]/actions.ts` tek bir firmanın içindeki işleri taşır
 * (yetkili, evrak, not). Bu dosya firmanın KENDİSİNİ yaratan yolu taşır,
 * o yüzden bir üst seviyede.
 *
 * `createCompanyAction`, B batch'inin inline firma yaratma yolu: randevu ve
 * talep formlarından çağrılır — yani ilişkinin BAŞLADIĞI yerlerden.
 * Sözleşme ve görev formlarında bilerek yok: sözleşme ilişkinin olgunlaştığı
 * yer (oraya gelmiş firma zaten portföyde olmalı), görev ise firmasız da
 * olabilecek iç işleri kapsıyor.
 *
 * Bugüne kadar firma yaratmanın tek yolu Excel import'uydu ve o servis
 * katmanını atlayıp doğrudan yazıyordu (lib/import/import-service.ts). Bu
 * eylem aynı payload şeklini servis katmanına taşıyor; tek fark `status`,
 * import'taki `aktif` yerine `aday`.
 *
 * Rol guard'ı BURADA var ve RLS ile hizalı: prod'da
 * `companies_insert_yonetici` INSERT policy'si rolü ve tenant'ı kontrol
 * ediyor, partner dalı yok (ROLE_MATRIX Partner HOLD ile tutarlı). Yani iki
 * kapı aynı şeyi söylüyor — access_requests'te düzelttiğimiz "uygulama bir
 * şey sanır, RLS başka şey yapar" durumu burada yok.
 *
 * service_role hiç kullanılmıyor.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createCompany,
  findCompaniesByExactName,
} from "@/lib/services/companies";
import type { CompanyCreateInput } from "@/lib/services/companies";

export type CreateCompanyActionResult =
  | { ok: true; companyId: string; companyName: string }
  | {
      ok: false;
      reason: "duplicate";
      duplicates: Array<{ id: string; name: string; status: string }>;
    }
  | { ok: false; reason: "error"; error: string };

/**
 * Yeni firma yarat (inline).
 *
 * Aynı isimde firma varsa VARSAYILAN OLARAK YAZMAZ — `reason: "duplicate"`
 * ile eşleşenleri döner ki arayüz "zaten var, onu mu seçmek istersin?"
 * diyebilsin. Kullanıcı yine de yaratmak isterse çağrı
 * `confirmDuplicate: true` ile tekrarlanır.
 *
 * Bu bir benzersizlik kuralı DEĞİL: `companies.name` üzerinde unique
 * constraint yok ve iki gerçek firma aynı adı taşıyabilir. Bloklamak, meşru
 * bir kaydı imkânsız hale getirirdi. Amaç yalnız "listede zaten var, fark
 * etmedin" durumunu yakalamak.
 */
export async function createCompanyAction(
  input: CompanyCreateInput,
  options?: { confirmDuplicate?: boolean },
): Promise<CreateCompanyActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      reason: "error",
      error: "Oturum geçersiz: lütfen tekrar giriş yapın.",
    };
  }

  const name = input?.name?.trim() ?? "";
  if (!name) {
    return { ok: false, reason: "error", error: "Firma adı zorunludur." };
  }

  // Rol guard — yonetici-only. `current_user_role()` (profiles.role), asla
  // user_metadata: o alan kullanıcının kendi yazabildiği bir yer.
  const { data: roleData, error: roleError } = await supabase.rpc(
    "current_user_role",
  );
  if (roleError || roleData !== "yonetici") {
    return {
      ok: false,
      reason: "error",
      error: "Yetkisiz: firma oluşturma yetkiniz yok.",
    };
  }

  const { data: tenantId, error: tenantError } = await supabase.rpc(
    "current_user_active_tenant",
  );
  if (tenantError || typeof tenantId !== "string" || tenantId.length === 0) {
    return { ok: false, reason: "error", error: "Aktif kiracı çözümlenemedi." };
  }

  try {
    if (!options?.confirmDuplicate) {
      const existing = await findCompaniesByExactName(supabase, name);
      if (existing.length > 0) {
        return {
          ok: false,
          reason: "duplicate",
          duplicates: existing.map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
          })),
        };
      }
    }

    const company = await createCompany(supabase, input, { tenantId });
    return { ok: true, companyId: company.id, companyName: company.name };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      error: err instanceof Error ? err.message : "Firma oluşturulamadı.",
    };
  }
}
