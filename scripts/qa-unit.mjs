/**
 * BPS QA — saf fonksiyon regresyon testleri.
 *
 * `qa:static` metin/desen kontrolü yapar; bu dosya DAVRANIŞ kontrol eder.
 * Bağımlılık yok, test framework'ü yok — projede kurulu değil ve tek bir
 * fonksiyon için kurmak orantısız olurdu. Koşum: `npm run qa:unit`.
 *
 * Buraya yalnız iki koşulu birden sağlayan şeyler girer:
 *   1. saf fonksiyon (I/O yok, DB yok),
 *   2. sessizce yanlış olabilir — hata vermeden kötü sonuç üretir.
 *
 * ---------------------------------------------------------------------------
 * KOPYA SORUNU VE ÇÖZÜMÜ
 * ---------------------------------------------------------------------------
 * Kaynak TypeScript, bu dosya düz JS — fonksiyon doğrudan import edilemiyor
 * (projede TS loader yok). Naif çözüm gövdeyi kopyalamaktır, ama o zaman test
 * KAYNAĞI değil KENDİ KOPYASINI doğrular ve kaynak değişince sessizce yeşil
 * kalır. Tam olarak REVIEW_STANDARD §9'un uyardığı sınıf.
 *
 * Bunun yerine iki adım:
 *   1. Kopya, davranış vakalarıyla test edilir.
 *   2. Kopyanın kaynakla AYNI OLDUĞU ayrıca doğrulanır (normalize edilmiş
 *      metin karşılaştırması). Kaynak değişirse test kırmızıya döner ve
 *      "kopyayı güncelle" der — sessizce geçmez.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// 1. Test edilen kopya — src/lib/notification-kinds.ts ile AYNI olmalı
// ---------------------------------------------------------------------------
function isIsoDate(value) {
  if (!value) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(t)) return false;
  return new Date(t).toISOString().slice(0, 10) === value;
}

// ---------------------------------------------------------------------------
// 2. Davranış vakaları
// ---------------------------------------------------------------------------
const cases = [
  ["2026-08-27", true, "normal gün"],
  ["2024-02-29", true, "gerçek artık yıl günü — reddedilmemeli"],
  [
    "2026-02-30",
    false,
    "TAKVİMDE YOK. Date.parse bunu NaN yapmaz, sessizce 2026-03-02'ye kaydırır. " +
      "Round-trip kontrolü olmadan 'geçerli' sayılıyordu ve görev iki gün geç gecikmiş görünürdü.",
  ],
  ["2025-02-29", false, "artık yıl DEĞİL — 2025-03-01'e kayar"],
  ["2026-13-01", false, "ay 13 — Date.parse zaten NaN döner"],
  ["2026-00-10", false, "ay 00"],
  ["27.08.2026", false, "TR biçimi — due_date bir text kolonu, bu değer oraya girebilir"],
  ["2026-8-27", false, "sıfır dolgusuz — regex reddetmeli"],
  ["", false, "boş metin"],
  [null, false, "null"],
  [undefined, false, "undefined"],
  ["bugün", false, "serbest metin"],
];

let failed = 0;
console.log("BPS QA Unit — saf fonksiyon regresyonları\n");
console.log("isIsoDate  (kaynak: src/lib/notification-kinds.ts)");
for (const [input, expected, why] of cases) {
  const got = isIsoDate(input);
  const ok = got === expected;
  if (!ok) failed++;
  const label = (input === null ? "null" : input === undefined ? "undefined" : JSON.stringify(input)).padEnd(14);
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"} ${label} → ${String(got).padEnd(5)}${ok ? "" : ` (beklenen ${expected})`}`);
  if (!ok) console.log(`       ${why}`);
}

// ---------------------------------------------------------------------------
// 2b. safeThrown — yazılabilir `Error.name` sızdırmamalı
// ---------------------------------------------------------------------------
// Kaynak: src/lib/email/safe-error.ts
// Bu fonksiyonun ilk hâli `err.name` okuyordu ve `Error.name` YAZILABİLİR bir
// instance alanı olduğu için serbest metni loga taşıyordu. Aşağıdaki ilk iki
// vaka tam olarak o sızıntıyı temsil ediyor.
function safeThrown(err) {
  if (err instanceof TypeError) return "thrown=TypeError";
  if (err instanceof RangeError) return "thrown=RangeError";
  if (err instanceof SyntaxError) return "thrown=SyntaxError";
  if (err instanceof ReferenceError) return "thrown=ReferenceError";
  if (err instanceof Error) return "thrown=Error";
  return "thrown=unknown";
}

const mutatedName = new Error("boom");
mutatedName.name = "recipient@example.com";
class RenamedError extends Error {}
Object.defineProperty(RenamedError, "name", { value: "leak@example.com" });

const thrownCases = [
  [mutatedName, "thrown=Error", "YAZILABİLİR name — eski kod bunu loga taşıyordu"],
  [new RenamedError("x"), "thrown=Error", "constructor.name da yeniden tanımlanabilir"],
  [new TypeError("t"), "thrown=TypeError", "gerçek tip korunmalı"],
  [new RangeError("r"), "thrown=RangeError", "gerçek tip korunmalı"],
  ["düz metin", "thrown=unknown", "Error olmayan"],
  [{ name: "leak@x.com" }, "thrown=unknown", "sahte error nesnesi"],
  [null, "thrown=unknown", "null"],
];

console.log("\nsafeThrown  (kaynak: src/lib/email/safe-error.ts)");
for (const [input, expected, why] of thrownCases) {
  const got = safeThrown(input);
  const ok = got === expected;
  if (!ok) failed++;
  const label = (input === null ? "null" : typeof input === "object" && input instanceof Error ? input.constructor.name : JSON.stringify(input)).slice(0, 14).padEnd(14);
  console.log(`  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"} ${label} → ${got.padEnd(20)}${ok ? "" : ` (beklenen ${expected})`}`);
  if (!ok) console.log(`       ${why}`);
}

// safe-error.ts'in serbest metin okumadığını statik olarak da doğrula.
const safeSrc = readFileSync(join(here, "..", "src", "lib", "email", "safe-error.ts"), "utf8");
const forbidden = [/err\.name/, /constructor\.name/, /error\.message/, /result\.error\b/];
console.log("\nsafe-error.ts serbest metin okumuyor mu");
for (const pat of forbidden) {
  const body = safeSrc.split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//")).join("\n");
  const hit = pat.test(body);
  if (hit) failed++;
  console.log(`  ${hit ? "\x1b[31mFAIL\x1b[0m" : "\x1b[32mPASS\x1b[0m"} ${String(pat).padEnd(22)} ${hit ? "← KOD İÇİNDE OKUNUYOR, sızıntı riski" : "okunmuyor"}`);
}

// ---------------------------------------------------------------------------
// 3. Kopya ↔ kaynak eşitliği — testin kendi kopyasını doğrulamasını engeller
// ---------------------------------------------------------------------------
const norm = (s) => s.replace(/\s+/g, " ").trim();
const src = readFileSync(join(here, "..", "src", "lib", "notification-kinds.ts"), "utf8");
const found = src.match(/export function isIsoDate\([\s\S]*?\n\}/);

console.log("\nkopya ↔ kaynak eşitliği");
if (!found) {
  console.log("  \x1b[31mFAIL\x1b[0m isIsoDate kaynakta bulunamadı (yeniden adlandırıldı mı?)");
  failed++;
} else {
  // Kaynaktaki gövdeyi imza ve yorumlardan arındırıp karşılaştır.
  const srcBody = norm(
    found[0]
      .replace(/^export function isIsoDate\([^)]*\)[^{]*\{/, "")
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\}$/, ""),
  );
  const copyBody = norm(
    isIsoDate.toString().replace(/^function isIsoDate\([^)]*\)\s*\{/, "").replace(/\}$/, ""),
  );
  if (srcBody === copyBody) {
    console.log("  \x1b[32mPASS\x1b[0m kopya kaynakla birebir aynı");
  } else {
    failed++;
    console.log("  \x1b[31mFAIL\x1b[0m KOPYA KAYNAKTAN SAPTI — bu test artık kaynağı doğrulamıyor.");
    console.log(`       kaynak: ${srcBody}`);
    console.log(`       kopya : ${copyBody}`);
    console.log("       Düzelt: yukarıdaki kopyayı kaynakla eşitle, sonra vakaları gözden geçir.");
  }
}

console.log(`\n${cases.length + thrownCases.length} vaka + 1 eşitlik + 4 statik kontrol · ${failed} FAIL`);
if (failed > 0) {
  console.error("qa:unit FAILED");
  process.exit(1);
}
console.log("qa:unit PASS");
