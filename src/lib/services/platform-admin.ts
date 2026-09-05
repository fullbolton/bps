/**
 * BPS servis katmanı — Platform Admin (/admin).
 *
 *     /admin ekranları
 *         |
 *     src/lib/services/platform-admin.ts   <- BU DOSYA
 *         |
 *     admin_* RPC'leri (SECURITY DEFINER)
 *         |
 *     tenants · tenant_memberships · profiles
 *
 * ---------------------------------------------------------------------------
 * NEDEN DOĞRUDAN TABLO OKUMASI YOK
 * ---------------------------------------------------------------------------
 * `tenants` ve `tenant_memberships` PostgREST'e KAPALI: RLS açık, policy sıfır,
 * `anon`/`authenticated` grant'i yok. Bu kasıtlı ve güvenli, bozulmuyor —
 * policy eklenmedi. Erişim `SECURITY DEFINER` RPC'ler üzerinden.
 *
 * `service_role` de KULLANILMIYOR. `qa:static`'in `service_role-confined`
 * kuralı onu dört dosyaya kilitliyor (cron · healthz · demo-request ·
 * access-request) ve bu sınır bilinçli. RPC yolu o sınırı hiç zorlamıyor.
 *
 * ---------------------------------------------------------------------------
 * YETKİ NEREDE
 * ---------------------------------------------------------------------------
 * Her `admin_*` RPC kendi içinde `is_platform_admin()` kapısını taşır ve
 * yetkisiz çağrıda `42501` ile düşer. Bu dosyadaki ve UI'daki kontroller
 * İKİNCİ katmandır — tek katman değil. Yani bir ekran yanlışlıkla açılsa bile
 * veri gelmez.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { UserRole } from "@/context/AuthContext";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Dönüş şekilleri — RPC imzalarıyla birebir
// ---------------------------------------------------------------------------

export interface AdminTenantRow {
  tenant_id: string;
  slug: string;
  name: string;
  uye_sayisi: number;
  firma: number;
  sozlesme: number;
  gorev: number;
}

export interface AdminUserRow {
  user_id: string;
  email: string;
  display_name: string;
  role: UserRole;
  is_platform_admin: boolean;
  /** Tek üyelik varsayımı gereği tek slug; yoksa null. */
  tenant_slug: string | null;
  /**
   * 1 DIŞINDAKİ her değer bir arızadır ve UI bunu göstermek zorundadır:
   *   0  → hiç üyelik yok, hook claim yazamaz
   *   2+ → hook `v_count = 1` koşulunda takılır, claim yine yazılmaz
   * İkisinde de kullanıcı giriş yapar ve BOŞ EKRAN görür, hata almaz.
   */
  uyelik_sayisi: number;
}

export class PlatformAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformAdminError";
  }
}

/**
 * RPC hatasını kullanıcıya gösterilebilir bir mesaja çevirir.
 *
 * Ham `error.message` KULLANILMIYOR — `safe-error.ts`'te öğrenilenin aynısı:
 * vendor/DB metni ne taşıdığı garanti olmayan serbest metindir. Yalnız kod
 * okunur ve bilinen kodlar Türkçeye eşlenir.
 */
function rpcError(error: { code?: string | null } | null): PlatformAdminError {
  const code = error?.code ?? "unknown";
  if (code === "42501") return new PlatformAdminError("Bu işlem için yetkiniz yok.");
  if (code === "23503") return new PlatformAdminError("Kullanıcı veya kiracı bulunamadı.");
  if (code === "23505") return new PlatformAdminError("Bu slug zaten kullanılıyor.");
  if (code === "23514") return new PlatformAdminError("Geçersiz rol değeri.");
  if (code === "22023") return new PlatformAdminError("Slug ve ad zorunludur.");
  return new PlatformAdminError(`İşlem başarısız (kod: ${code}).`);
}

// ---------------------------------------------------------------------------
// Okuma
// ---------------------------------------------------------------------------

export async function listTenants(client: Client): Promise<AdminTenantRow[]> {
  const { data, error } = await client.rpc("admin_list_tenants");
  if (error) throw rpcError(error);
  return (data ?? []) as AdminTenantRow[];
}

export async function listUsers(client: Client): Promise<AdminUserRow[]> {
  const { data, error } = await client.rpc("admin_list_users");
  if (error) throw rpcError(error);
  return (data ?? []) as AdminUserRow[];
}

/** Çağıranın kendisi platform admin mi. UI kapısı için. */
export async function currentUserIsPlatformAdmin(client: Client): Promise<boolean> {
  const { data, error } = await client.rpc("is_platform_admin");
  // Hata durumunda FAIL-CLOSED: yetki varsayılmaz.
  if (error) return false;
  return data === true;
}

// ---------------------------------------------------------------------------
// Yazma
// ---------------------------------------------------------------------------

/**
 * Rol ve tenant üyeliğini ATOMİK atar.
 *
 * ⚠ İki ayrı çağrı yapılamaz. `supabase-js` transaction desteklemiyor; rolü
 * yazıp üyelikte hata alan bir akış, tam olarak Mek Group kurulumunda üç kez
 * yaşanan sessiz yarım-durumu üretirdi. Atomiklik RPC gövdesinden geliyor.
 *
 * ⚠ Üyelik EKLENMİYOR, DEĞİŞTİRİLİYOR: RPC önce kullanıcının bütün üyeliklerini
 * siler. `custom_access_token_hook` yalnız tek üyelikte claim yazdığı için,
 * ikinci bir üyelik kullanıcının erişimini SESSİZCE sıfırlardı.
 *
 * ⚠ OTURUM (Codex P1): tenant bir JWT claim'i; üyelik değişince kullanıcının
 * elindeki token eski tenant'ı taşımaya devam ederdi. RPC, üyelik kümesi
 * değiştiğinde `auth.sessions`'ı siler — refresh imkânsızlaşır, kullanıcı en
 * geç JWT süresi dolunca yeniden girer ve doğru claim'i alır. Yalnız rol
 * düzeltmesinde (aynı tenant) oturum korunur; rol canlı okunur. Kalan pencere
 * yalnız claim'e güvenen 43 policy için; profiles okuması ve görev atanan
 * guard'ı claim'i canlı üyelikle doğrular (20260904000100, KARAR 6).
 *
 * ⚠ BİLİNEN SONUÇ (20260904000100 ile birlikte): kullanıcı başka tenant'a
 * taşınırsa, eski tenant'ta ona atalı görevler "başka kiracının üyesine atalı"
 * duruma düşer ve `tasks_update` WITH CHECK'i o görevlerin HER güncellemesini
 * yeniden atanana kadar reddeder. Sessiz değil (RLS hatası görünür), ama
 * taşımadan önce bilinmeli. Tespit: profiles_tenant_scope_post_apply_verify §6.
 */
export async function assignRoleAndTenant(
  client: Client,
  input: { userId: string; role: UserRole; tenantId: string },
): Promise<void> {
  const { error } = await client.rpc("admin_assign_role_and_tenant", {
    p_user_id: input.userId,
    p_role: input.role,
    p_tenant_id: input.tenantId,
  });
  if (error) throw rpcError(error);
}

export async function createTenant(
  client: Client,
  input: { slug: string; name: string },
): Promise<string> {
  const slug = input.slug.trim().toLowerCase();
  const name = input.name.trim();
  if (!slug || !name) throw new PlatformAdminError("Slug ve ad zorunludur.");
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new PlatformAdminError("Slug yalnız küçük harf, rakam ve tire içerebilir.");
  }

  const { data, error } = await client.rpc("admin_create_tenant", {
    p_slug: slug,
    p_name: name,
  });
  if (error) throw rpcError(error);
  return data as string;
}
