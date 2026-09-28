import {importActualTypeScript} from './helpers/import-typescript.mjs';
// Executes actual TypeScript exports; no duplicate implementation.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// 1. Test edilen kopya — src/lib/calendar-date.ts ile AYNI olmalı
// ---------------------------------------------------------------------------
const {isIsoDate} = await importActualTypeScript(new URL('../src/lib/calendar-date.ts', import.meta.url));

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
console.log("isIsoDate  (kaynak: src/lib/calendar-date.ts)");
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
const {safeThrown} = await importActualTypeScript(new URL('../src/lib/email/safe-error.ts', import.meta.url));

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
console.log(`\n${cases.length + thrownCases.length} vaka + 4 statik kontrol · ${failed} FAIL`);
if (failed > 0) {
  console.error("qa:unit FAILED");
  process.exit(1);
}
console.log("qa:unit PASS");
