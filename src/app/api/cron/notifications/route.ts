/**
 * BPS — e-posta bildirim cron ucu (dört tip, tek koşu).
 *
 * `/api/cron/contract-expiry`'nin yerini alır. Tek uç, çünkü dört tip de aynı
 * günlük tetikte, aynı transport'la, aynı deftere (`notification_log`) yazarak
 * çalışıyor; ayrı uçlar dört ayrı cron kaydı, dört auth kapısı ve dört log
 * satırı demekti.
 *
 * KAPSAM — Batch 10 kararının geri alınan kısmı YALNIZ e-postadır. Bu uç
 * uygulama içi bildirim, rozet, okundu durumu ya da push ÜRETMEZ; onlar A
 * aşamasının ayrı kararı.
 *
 * Akış:
 *   1. Bearer-auth (CRON_SECRET) — her şeyden önce, fail-closed.
 *   2. Feature flag — varsayılan kapalı.
 *   3. service_role istemcisi — alıcı sayımı bütün profiles/atama satırlarını
 *      görmeyi gerektirir; bu bir sistem işi, kullanıcı eylemi değil.
 *   4. Dört tipi sırayla koş, tip başına özet döndür.
 *
 * Bir tipin patlaması diğerlerini düşürmez: her tip kendi try/catch'inde,
 * hataları özet nesnesinde toplanır. Kısmi başarı, sessiz tam başarısızlıktan
 * iyidir — ve hangi tipin düştüğü loga yazılır.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { runContractExpiryRecallBatch } from "@/lib/email/contract-expiry-email";
import { runNotificationBatch, type KindRunResult } from "@/lib/email/notification-batches";
import { safeThrown } from "@/lib/email/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 1. Auth first — an unauthenticated caller learns nothing about flags or
  //    configuration. Fail closed when the secret is unset.
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  // 2. Single flag for the whole notification surface. Ops flips it only after
  //    the sending domain is verified (DKIM/SPF/DMARC) and the vendor account
  //    is warmed — the same gate the contract-expiry flow always had.
  if (process.env.BPS_NOTIFICATION_EMAILS_ENABLED !== "true") {
    // Skip de LOGLANIR. Eski uç bunu yazmıyordu ve sonuç şuydu: Vercel'de
    // yalnız "GET 200" satırı kalıyor, cron'un ne YAPTIĞI ancak DB'den dolaylı
    // okunabiliyordu. Çalıştığını görebilmek, çalışmasından ayrı bir
    // gereksinimdir (TASK_ROADMAP w).
    console.log("[cron/notifications] SKIPPED — BPS_NOTIFICATION_EMAILS_ENABLED is not 'true'");
    return NextResponse.json(
      { ok: true, skipped: true, reason: "BPS_NOTIFICATION_EMAILS_ENABLED is not 'true'" },
      { status: 200 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Missing Supabase env vars." }, { status: 500 });
  }
  const adminClient = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  // Mevcut akışın env adları korunuyor — yeni isim uydurmak, ops tarafında
  // zaten tanımlı olan değişkenleri sessizce devre dışı bırakırdı.
  const fromAddress = process.env.BPS_EMAIL_FROM ?? "BPS Bildirim <bildirim@bpsys.net>";
  const appUrl = (process.env.BPS_APP_URL ?? "https://bpsys.net").replace(/\/$/, "");

  console.log(`[cron/notifications] RUN START ${now.toISOString()} — flag açık, dört tip koşacak`);

  const results: Array<KindRunResult | { kind: string; fatal: string }> = [];

  // 3. contract_expiry — kendi toplayıcısını korur (sözleşme penceresi TZ
  //    duyarlı `computeRemainingDays` ile hesaplanıyor), yalnız defteri ortak.
  try {
    const r = await runContractExpiryRecallBatch(adminClient, now);
    results.push({
      kind: "contract_expiry",
      itemsFound: r.contractsEvaluated,
      mailsSent: r.recipientsSent,
      itemsSkippedIdempotent: r.recipientsSkippedIdempotent,
      itemsDroppedCrossTenant: r.recipientsDroppedCrossTenant,
      mailsFailed: r.recipientsFailed,
      errors: r.errors,
    });
  } catch (err) {
    results.push({
      kind: "contract_expiry",
      fatal: safeThrown(err),
    });
  }

  // 4. Üç yeni tip. Her biri izole — biri düşerse diğerleri koşmaya devam eder.
  for (const kind of ["task_overdue", "document_expiry", "appointment_reminder"] as const) {
    try {
      results.push(await runNotificationBatch(adminClient, kind, now, { fromAddress, appUrl }));
    } catch (err) {
      results.push({ kind, fatal: safeThrown(err) });
    }
  }

  for (const r of results) {
    if ("fatal" in r) {
      console.error(`[cron/notifications] ${r.kind} FATAL: ${r.fatal}`);
      continue;
    }
    console.log(
      `[cron/notifications] ${r.kind} found=${r.itemsFound} sent=${r.mailsSent} skipped=${r.itemsSkippedIdempotent} cross_tenant_dropped=${r.itemsDroppedCrossTenant} failed=${r.mailsFailed}`,
    );
    for (const e of r.errors) console.error(`[cron/notifications] ${r.kind}: ${e}`);
  }

  // 5. SESSİZ BAŞARISIZLIK KAPISI. `sendEmail` fırlatmaz — `RESEND_API_KEY`
  //    yoksa ya da vendor reddederse `{ok:false}` döner, damga geri alınır ve
  //    net sonuç "hiçbir şey olmamış" gibi görünür. Eski akış bu yüzden dört ay
  //    boyunca HTTP 200 dönerken tek satır bile yazmadı ve kimse fark etmedi
  //    (TASK_ROADMAP v).
  //
  //    Kural: HİÇ mail gitmediği HALDE hata varsa bu bir başarısızlıktır ve
  //    Vercel'in başarısızlık sinyaline bağlanır. Kısmi başarı 200 kalır — bir
  //    tip düştü diye tümünü kırmızıya çevirmek gürültü olurdu.
  const sentTotal = results.reduce((n, r) => n + ("fatal" in r ? 0 : r.mailsSent), 0);
  const hasFailure = results.some((r) => "fatal" in r || r.errors.length > 0 || r.mailsFailed > 0);

  if (sentTotal === 0 && hasFailure) {
    console.error("[cron/notifications] ALL SENDS FAILED — hiç mail gitmedi, hata var. HTTP 500.");
    return NextResponse.json(
      { ok: false, error: "All notification sends failed.", results },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, results }, { status: 200 });
}
