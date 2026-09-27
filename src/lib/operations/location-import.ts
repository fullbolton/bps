export type LocationRow = { code: string; name: string; city: string };
export const IMPORT_MAX_BYTES = 256 * 1024;

export function validateLocationRows(value: unknown): LocationRow[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 500) throw new Error("1–500 şube satırı gerekir.");
  const codes = new Set<string>();
  return value.map((row, index) => {
    if (!row || typeof row !== "object") throw new Error(`Satır ${index + 2}: geçersiz kayıt.`);
    const { code, name, city } = row;
    if (typeof code !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(code)) throw new Error(`Satır ${index + 2}: şube kodu 1–40 harf/rakam, tire veya alt çizgi olmalı.`);
    for (const [value, max] of [[name, 160], [city, 80]] as const) {
      if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\x00-\x1f\x7f]/.test(value)) throw new Error(`Satır ${index + 2}: şube adı veya il geçersiz.`);
    }
    if (codes.has(code)) throw new Error(`Satır ${index + 2}: ${code} dosyada tekrar ediyor.`);
    codes.add(code);
    return { code, name: name.trim(), city: city.trim() };
  });
}

// Strict quoted CSV; delimiter is chosen from the required header, never from data cells.
export function parseLocationCsv(source: string): LocationRow[] {
  if (new TextEncoder().encode(source).length > IMPORT_MAX_BYTES) throw new Error("Dosya 256 KiB sınırını aşıyor.");
  source = source.replace(/^\uFEFF/, "");
  const header = source.split(/\r?\n/, 1)[0];
  const separator = header.includes(";") ? ";" : ",";
  const rows: string[][] = []; let row: string[] = []; let cell = "";
  let quoted = false; let closed = false;
  const endCell = () => { row.push(cell); cell = ""; closed = false; };
  const endRow = () => { endCell(); rows.push(row); row = []; };
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"') { if (source[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else cell += c;
    } else if (c === separator) endCell();
    else if (c === "\n" || c === "\r") { if (c === "\r" && source[i + 1] === "\n") i++; endRow(); }
    else if (c === '"' && cell === "" && !closed) quoted = true;
    else { if (closed || c === '"') throw new Error("CSV tırnak yapısı geçersiz."); cell += c; }
  }
  if (quoted) throw new Error("CSV içinde kapanmamış tırnak var.");
  if (cell !== "" || row.length || closed) endRow();
  if (rows.shift()?.join(",") !== "sube_kodu,sube_adi,il") throw new Error("Başlık sube_kodu,sube_adi,il olmalı.");
  if (rows.some(r => r.length !== 3)) throw new Error("Her satır tam üç sütun içermeli; boş satırları kaldırın.");
  return validateLocationRows(rows.map(([code, name, city]) => ({ code, name, city })));
}
