import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * BPS Platform Admin — /admin ağacı.
 *
 * ---------------------------------------------------------------------------
 * NEDEN AYRI SAYFA AĞACI
 * ---------------------------------------------------------------------------
 * Operatör eylemleri yüksek frekans / düşük risk; admin eylemleri düşük
 * frekans / YÜKSEK risk. İkisi aynı kabuğu paylaşırsa aynı hız varsayımıyla
 * tasarlanır, ve yanlışlıkla tıklanan bir düğme tenant'ın rol dağılımını
 * değiştirebilir.
 *
 * Ağaç ŞİMDİ ayrıldı, sonradan değil. Sonradan ayırmak "admin'i klonla,
 * birkaç izin kaldır" desenine dönüşür — devredilen admin'in en yaygın
 * kurulum hatası. Bugün Furkan hem platform admin hem üç tenant'ın yöneticisi;
 * tek panel yapılsaydı ikinci gerçek kullanıcı grubunda ayrıştırılamazdı.
 *
 * `(main)` layout'u KULLANILMIYOR: sidebar, tenant bağlamı ve rol tabanlı
 * menü oranın işi. Buranın bağlamı tenant'ın DIŞINDA.
 *
 * ---------------------------------------------------------------------------
 * YETKİ — İKİ KATMAN, BU İKİNCİSİ
 * ---------------------------------------------------------------------------
 * Asıl kapı `admin_*` RPC'lerinin İÇİNDE: her biri `is_platform_admin()`
 * kontrol eder ve yetkisiz çağrı `42501` ile düşer. Buradaki kontrol o kapıyı
 * tekrar etmiyor, kullanıcıyı boş bir ekrana sokmamak için var.
 *
 * ⚠ `role = 'yonetici'` bu kapı için YETERSİZ: prod'da dört tenant ve birden
 *   fazla yönetici var (Mek Group'ta üç). Platform admin ayrı bir bayrak,
 *   yükseltilmiş bir rol değil.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?returnTo=/admin");

  // FAIL-CLOSED: RPC hata verirse `data` true olmaz ve erişim reddedilir.
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (isAdmin !== true) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              Platform Yönetimi
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Kiracılar arası — bu ekran tek bir firmanın değil, kurulumun tamamının.
            </p>
          </div>
          <a
            href="/dashboard"
            className="text-xs text-blue-600 hover:underline"
          >
            Uygulamaya dön
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
