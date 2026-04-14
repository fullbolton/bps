"use client";

/**
 * BPS Login Page — minimal internal login experience.
 * Includes inline access request form (not a separate signup page).
 * No public registration. No social login. No marketing copy.
 */

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  SURFACE_PRIMARY,
  SURFACE_CANVAS,
  BORDER_DEFAULT,
  RADIUS_DEFAULT,
  RADIUS_SM,
  TYPE_BODY,
  TYPE_CAPTION,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_LINK,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  BUTTON_BASE,
} from "@/styles/tokens";

// ---------------------------------------------------------------------------
// Login form
// ---------------------------------------------------------------------------

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Giriş başarısız. E-posta veya şifre hatalı.");
      setLoading(false);
      return;
    }

    router.push(returnTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className={`block ${TYPE_CAPTION} ${TEXT_SECONDARY} mb-1`}>
          E-posta
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
          className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          placeholder="ornek@bps.local"
        />
      </div>

      <div>
        <label htmlFor="password" className={`block ${TYPE_CAPTION} ${TEXT_SECONDARY} mb-1`}>
          Şifre
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
        />
      </div>

      {error && (
        <p className={`${TYPE_CAPTION} text-red-600`}>{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !email || !password}
        className={`w-full py-2.5 ${TYPE_BODY} font-medium ${BUTTON_PRIMARY} ${RADIUS_SM} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Access request form
// ---------------------------------------------------------------------------
//
// Operating model: user submits only Ad Soyad + E-posta. Yönetici assigns
// role and scope internally from the Ayarlar > Erişim Talepleri tab. Birim
// is no longer user-selected at this surface.
//
// Write-contract compatibility: the access_requests table was created in
// Phase 2A with a required `birim` column. Rather than widen scope with a
// schema migration in this batch, a neutral default ("diger") is stamped
// silently on insert. The existing Ayarlar review flow already maps
// "diger" → "Diğer", so no review-tab change is required.

function AccessRequestForm({ onBack }: { onBack: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    const { error: insertError } = await supabase
      .from("access_requests")
      .insert({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        birim: "diger",
      });

    if (insertError) {
      if (insertError.code === "23505" || insertError.message?.includes("duplicate") || insertError.message?.includes("unique")) {
        setError("Bu e-posta ile bekleyen bir talep zaten mevcut.");
      } else {
        setError("Talep gönderilemedi. Lütfen tekrar deneyin.");
      }
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="space-y-6">
        <div className="text-center pt-1 pb-2">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center ring-1 ring-green-600/15">
            <span className="text-green-600 text-xl leading-none" aria-hidden>
              ✓
            </span>
          </div>
          <p className={`${TYPE_BODY} font-medium text-slate-800`}>
            Erişim talebiniz alındı.
          </p>
          <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-2 max-w-xs mx-auto leading-relaxed`}>
            Onay ve hesap tanımı yöneticiniz tarafından yürütülür; sistem otomatik bildirim veya davet göndermez.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className={`w-full justify-center ${BUTTON_BASE} ${BUTTON_SECONDARY}`}
        >
          Giriş ekranına dön
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="access-full-name" className={`block ${TYPE_CAPTION} ${TEXT_SECONDARY} mb-1`}>
          Ad Soyad
        </label>
        <input
          id="access-full-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="name"
          className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          placeholder="Ad Soyad"
        />
      </div>

      <div>
        <label htmlFor="access-email" className={`block ${TYPE_CAPTION} ${TEXT_SECONDARY} mb-1`}>
          E-posta
        </label>
        <input
          id="access-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          placeholder="ornek@sirket.com"
        />
      </div>

      {error && (
        <p className={`${TYPE_CAPTION} text-red-600`}>{error}</p>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <button
          type="submit"
          disabled={loading || !fullName.trim() || !email.trim()}
          className={`w-full py-2.5 ${TYPE_BODY} font-medium ${BUTTON_PRIMARY} ${RADIUS_SM} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? "Gönderiliyor..." : "Erişim talebini gönder"}
        </button>

        <button
          type="button"
          onClick={onBack}
          className={`w-full py-2 ${TYPE_CAPTION} ${TEXT_SECONDARY} hover:text-slate-600 transition-colors`}
        >
          <span className={`${TEXT_LINK} hover:underline`}>Giriş ekranına dön</span>
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "request">("login");

  return (
    <div className={`min-h-screen ${SURFACE_CANVAS} flex items-center justify-center px-4`}>
      <div
        className={`w-full max-w-sm ${SURFACE_PRIMARY} border ${RADIUS_DEFAULT} p-8 transition-shadow ${
          mode === "request"
            ? "border-blue-200/80 shadow-sm ring-1 ring-blue-100/90"
            : BORDER_DEFAULT
        }`}
      >
        {/* BPS branding */}
        <div className={`text-center ${mode === "request" ? "mb-6" : "mb-8"}`}>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">BPS</h1>
          <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-1`}>Partner Staff — İç Ofis Operasyon</p>
          {mode === "request" && (
            <p
              className={`${TYPE_CAPTION} font-medium text-blue-700/90 mt-3 pt-3 border-t border-slate-100`}
            >
              Erişim talebi
            </p>
          )}
        </div>

        {mode === "login" ? (
          <>
            <Suspense fallback={
              <div className={`text-center py-4 ${TYPE_BODY} ${TEXT_MUTED}`}>Yükleniyor...</div>
            }>
              <LoginForm />
            </Suspense>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setMode("request")}
                className={`${TYPE_CAPTION} ${TEXT_LINK} hover:underline`}
              >
                Hesabınız yok mu? Erişim talebi gönderin
              </button>
            </div>
          </>
        ) : (
          <AccessRequestForm onBack={() => setMode("login")} />
        )}
      </div>
    </div>
  );
}
