"use server";

/**
 * BPS Platform Admin — Server Actions.
 *
 * Yetki kapısı `admin_*` RPC'lerinin İÇİNDE (`is_platform_admin()`), burada
 * tekrar edilmiyor. Buradaki tek kontrol oturumun varlığı; yetkisiz bir çağrı
 * RPC'den `42501` ile döner ve kullanıcıya "yetkiniz yok" olarak gösterilir.
 *
 * ⚠ `service_role` KULLANILMIYOR. `tenants` / `tenant_memberships` PostgREST'e
 * kapalı olduğu halde bu akış çalışıyor, çünkü RPC'ler `SECURITY DEFINER`.
 * `qa:static`'in `service_role-confined` kuralı bozulmadan kalıyor.
 */

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  assignRoleAndTenant,
  createTenant,
  PlatformAdminError,
} from "@/lib/services/platform-admin";
import type { UserRole } from "@/context/AuthContext";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

function toResult(err: unknown): AdminActionResult {
  // Yalnız kendi hata sınıfımızın mesajı kullanıcıya gösterilir; o mesajlar
  // `platform-admin.ts`'te SQLSTATE kodundan üretiliyor. Ham DB metni buraya
  // hiç ulaşmıyor.
  if (err instanceof PlatformAdminError) return { ok: false, error: err.message };
  return { ok: false, error: "İşlem başarısız." };
}

/**
 * Rol + tenant üyeliğini ATOMİK atar.
 *
 * Bu iki iş neden ayrılamaz: Mek Group kurulumunda üç kez ayrı yapıldı ve
 * üçünde de bir parçası atlandı — rol atanmadı, ya da üyelik yazılmadı.
 * Hiçbiri hata vermedi; kullanıcı giriş yapıp boş ekran gördü.
 */
export async function assignRoleAndTenantAction(input: {
  userId: string;
  role: UserRole;
  tenantId: string;
}): Promise<AdminActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum geçersiz: lütfen tekrar giriş yapın." };

  try {
    await assignRoleAndTenant(supabase, input);
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function createTenantAction(input: {
  slug: string;
  name: string;
}): Promise<AdminActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum geçersiz: lütfen tekrar giriş yapın." };

  try {
    await createTenant(supabase, input);
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}
