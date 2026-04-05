/**
 * Mock template-based suggestion engine — Batch 7.
 * Not an LLM. Produces plausible structured suggestions from prompts
 * and firma context using simple template logic.
 *
 * Will be replaced by a real LLM API call in a future connection step.
 */

export interface FirmaContext {
  firmaAdi: string;
  sektor?: string;
}

export interface TaskSuggestion {
  baslik: string;
  oncelik: string;
  kaynak: string;
}

/**
 * Generates a structured note suggestion from a user prompt.
 * Template-based: wraps the user's description in a consistent note format
 * with firma name, date, and structured sections.
 */
export function suggestNote(prompt: string, firma: FirmaContext): string {
  const today = new Date().toISOString().split("T")[0];
  const trimmed = prompt.trim();

  if (!trimmed) return "";

  // Simple structured note template
  const lines = [
    `Firma: ${firma.firmaAdi}`,
    `Tarih: ${today}`,
    "",
    trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
    "",
    "Takip: Gerekirse ilgili görev veya randevu açılmalıdır.",
  ];

  return lines.join("\n");
}

/**
 * Generates a structured task suggestion from a user prompt.
 * Template-based: extracts a task title from the prompt,
 * assigns priority based on urgency keywords, defaults source to "manuel."
 */

const URGENCY_KEYWORDS = ["acil", "hemen", "kritik", "bugün", "derhal"];
const HIGH_KEYWORDS = ["takip", "kontrol", "hazırla", "gönder", "planla", "ara", "sor", "ilet", "bildir"];

export function suggestTask(prompt: string, firma: FirmaContext): TaskSuggestion {
  const trimmed = prompt.trim();
  const lower = trimmed.toLowerCase();

  // Determine priority from keywords
  let oncelik = "normal";
  if (URGENCY_KEYWORDS.some((k) => lower.includes(k))) {
    oncelik = "kritik";
  } else if (HIGH_KEYWORDS.some((k) => lower.includes(k))) {
    oncelik = "yuksek";
  }

  // Extract a task title: capitalize first sentence, truncate to reasonable length
  const firstSentence = trimmed.split(/[.!?\n]/)[0].trim();
  const baslik = firstSentence.length > 60
    ? firstSentence.slice(0, 57) + "..."
    : firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1);

  return {
    baslik: `${baslik} — ${firma.firmaAdi}`,
    oncelik,
    kaynak: "manuel",
  };
}
