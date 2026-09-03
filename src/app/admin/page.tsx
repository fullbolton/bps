import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listTenants, listUsers } from "@/lib/services/platform-admin";
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
    loadError = err instanceof Error ? err.message : "Veri okunamadı.";
  }

  return (
    <AdminClient tenants={tenants} users={users} loadError={loadError} />
  );
}
