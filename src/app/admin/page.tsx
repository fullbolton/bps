import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  listTenants,
  listUsers,
  PlatformAdminError,
} from "@/lib/services/platform-admin";
import type { AdminTenantRow, AdminUserRow } from "@/lib/services/platform-admin";
import AdminClient from "./AdminClient";

/**
 * Platform Admin — tenant ve kullanıcı görünümü.
 *
 * Server component: veri `admin_*` RPC'leriyle burada okunur, etkileşim
 * `AdminClient`'a devredilir. Layout zaten yetkiyi doğruladı; buraya
 * ulaşılıyorsa çağıran platform admin'dir.
 */
export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();

  // Layout yetkiyi doğruladı, ama okuma yine de RPC üzerinden ve RPC kendi
  // kapısını taşıyor. Hata olursa boş liste değil, hata gösterilir —
  // "veri yok" ile "okuyamadım" ayrı şeyler.
  let tenants: AdminTenantRow[] = [];
  let users: AdminUserRow[] = [];
  let loadError: string | null = null;
  try {
    [tenants, users] = await Promise.all([listTenants(supabase), listUsers(supabase)]);
  } catch (err) {
    tenants = [];
    users = [];
    // Yalnız kendi hata sınıfımızın mesajı gösterilir — o mesajlar SQLSTATE
    // kodundan üretiliyor. Beklenmeyen/transport hatasının serbest metni
    // kullanıcıya ulaşmaz (Codex P2; actions.ts'teki kuralın aynısı).
    loadError =
      err instanceof PlatformAdminError ? err.message : "Veri okunamadı.";
  }

  return (
    <AdminClient tenants={tenants} users={users} loadError={loadError} />
  );
}
