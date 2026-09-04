"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminTenantRow, AdminUserRow } from "@/lib/services/platform-admin";
import type { UserRole } from "@/context/AuthContext";
import { assignRoleAndTenantAction, createTenantAction } from "./actions";

/**
 * Platform Admin — etkileşim katmanı.
 *
 * ---------------------------------------------------------------------------
 * BU EKRANIN ASIL İŞİ: SESSİZ YARIM DURUMU GÖRÜNÜR KILMAK
 * ---------------------------------------------------------------------------
 * Mek Group kurulumunda rol ve üyelik üç kez ayrı ayrı yapıldı ve her seferinde
 * biri atlandı. Hiçbiri hata vermedi — kullanıcı giriş yaptı ve boş ekran gördü.
 *
 * Bu yüzden `uyelik_sayisi` sütunu bir süs değil, ekranın varlık sebebi:
 *   0  → hiç üyelik yok, hook claim yazamaz
 *   2+ → hook `v_count = 1`'de takılır, claim yine yazılmaz
 * İkisinde de sonuç aynı: kullanıcı hiçbir şey göremez ve sebebi ekranda
 * hiçbir yerde yazmaz. Burada yazıyor.
 *
 * Ve atama TEK FORM: rol ile tenant ayrı ayrı kaydedilemiyor, çünkü ayrı
 * kaydedilebilseydi aynı hata bu panelden de yapılabilirdi.
 */

const ROLES: UserRole[] = [
  "yonetici",
  "operasyon",
  "ik",
  "muhasebe",
  "goruntuleyici",
];

export default function AdminClient({
  tenants,
  users,
  loadError,
}: {
  tenants: AdminTenantRow[];
  users: AdminUserRow[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Atama formu — kullanıcı başına açılır, rol ve tenant BİRLİKTE seçilir.
  const [editing, setEditing] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("goruntuleyici");
  const [tenantId, setTenantId] = useState<string>("");

  // Tenant oluşturma
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");

  async function submitAssign(userId: string) {
    if (busy) return;
    if (!tenantId) {
      setMessage({ kind: "err", text: "Kiracı seçilmeli — rol tek başına atanamaz." });
      return;
    }
    setBusy(userId);
    setMessage(null);
    const r = await assignRoleAndTenantAction({ userId, role, tenantId });
    setBusy(null);
    if (!r.ok) {
      setMessage({ kind: "err", text: r.error });
      return;
    }
    setEditing(null);
    setMessage({ kind: "ok", text: "Rol ve kiracı üyeliği birlikte kaydedildi." });
    router.refresh();
  }

  async function submitTenant() {
    if (busy) return;
    setBusy("new-tenant");
    setMessage(null);
    const r = await createTenantAction({ slug: newSlug, name: newName });
    setBusy(null);
    if (!r.ok) {
      setMessage({ kind: "err", text: r.error });
      return;
    }
    setNewSlug("");
    setNewName("");
    setMessage({ kind: "ok", text: "Kiracı oluşturuldu." });
    router.refresh();
  }

  if (loadError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <strong>Veri okunamadı.</strong> {loadError}
        <p className="mt-1 text-xs text-red-700">
          Bu bir &quot;kayıt yok&quot; durumu değil — okuma başarısız oldu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={`rounded-md p-3 text-sm ${
            message.kind === "ok"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ---------------- Kiracılar ---------------- */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Kiracılar</h2>
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Slug</th>
                <th className="px-3 py-2 text-left font-medium">Ad</th>
                <th className="px-3 py-2 text-right font-medium">Üye</th>
                <th className="px-3 py-2 text-right font-medium">Firma</th>
                <th className="px-3 py-2 text-right font-medium">Sözleşme</th>
                <th className="px-3 py-2 text-right font-medium">Görev</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.tenant_id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{t.slug}</td>
                  <td className="px-3 py-2">{t.name}</td>
                  <td className="px-3 py-2 text-right">{t.uye_sayisi}</td>
                  <td className="px-3 py-2 text-right">{t.firma}</td>
                  <td className="px-3 py-2 text-right">{t.sozlesme}</td>
                  <td className="px-3 py-2 text-right">{t.gorev}</td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                    Kiracı yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Slug</label>
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="ornek-firma"
              className="rounded border border-slate-300 px-2 py-1 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Ad</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Örnek Firma A.Ş."
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={submitTenant}
            disabled={busy !== null || !newSlug.trim() || !newName.trim()}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy === "new-tenant" ? "Oluşturuluyor…" : "Kiracı Ekle"}
          </button>
        </div>
      </section>

      {/* ---------------- Kullanıcılar ---------------- */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Kullanıcılar</h2>
        <p className="text-xs text-slate-500 mb-3">
          <strong>Üyelik</strong> sütunu 1 dışında bir değer gösteriyorsa o kullanıcı
          giriş yapabilir ama <strong>hiçbir şey göremez</strong>: oturum jetonuna
          kiracı bilgisi yazılmaz ve hata da alınmaz.
        </p>
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">E-posta</th>
                <th className="px-3 py-2 text-left font-medium">Ad</th>
                <th className="px-3 py-2 text-left font-medium">Rol</th>
                <th className="px-3 py-2 text-left font-medium">Kiracı</th>
                <th className="px-3 py-2 text-right font-medium">Üyelik</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const sorunlu = u.uyelik_sayisi !== 1;
                return (
                  <tr key={u.user_id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">
                      {u.email}
                      {u.is_platform_admin && (
                        <span className="ml-1.5 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white">
                          platform
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{u.display_name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{u.role}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {u.tenant_slug ?? <span className="text-red-600">—</span>}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${
                        sorunlu ? "text-red-600" : "text-slate-700"
                      }`}
                      title={
                        u.uyelik_sayisi === 0
                          ? "Üyelik yok — jetona kiracı yazılmaz, kullanıcı hiçbir şey göremez"
                          : u.uyelik_sayisi > 1
                            ? "Birden fazla üyelik — jetona kiracı YAZILMAZ, kullanıcı hiçbir şey göremez"
                            : undefined
                      }
                    >
                      {u.uyelik_sayisi}
                      {sorunlu && " ⚠"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {editing === u.user_id ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as UserRole)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          <select
                            value={tenantId}
                            onChange={(e) => setTenantId(e.target.value)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                          >
                            <option value="">kiracı seç…</option>
                            {tenants.map((t) => (
                              <option key={t.tenant_id} value={t.tenant_id}>
                                {t.slug}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => submitAssign(u.user_id)}
                            disabled={busy !== null}
                            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {busy === u.user_id ? "Kaydediliyor…" : "Kaydet"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="text-xs text-slate-500 hover:underline"
                          >
                            Vazgeç
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(u.user_id);
                            setRole(u.role);
                            setTenantId(
                              tenants.find((t) => t.slug === u.tenant_slug)?.tenant_id ?? "",
                            );
                            setMessage(null);
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Rol + Kiracı
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Rol ve kiracı <strong>tek işlemde</strong> kaydedilir; biri başarısız olursa
          ikisi de yazılmaz. Mevcut üyelik <strong>değiştirilir</strong>, üstüne
          eklenmez — ikinci bir üyelik kullanıcının erişimini sessizce sıfırlardı.
          Kiracı değişirse kullanıcının <strong>oturumları sonlandırılır</strong> ve
          yeniden giriş yapması gerekir: kiracı bilgisi oturum jetonunda taşınır,
          eski jeton eski kiracıyı gösterirdi.
        </p>
      </section>
    </div>
  );
}
