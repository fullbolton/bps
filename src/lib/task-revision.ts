export function requireTaskRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Görev sürümü doğrulanamadı. Sayfayı yenileyin; sorun sürerse şema güncellemesini kontrol edin.");
  }
  return value;
}
export class TaskConflictError extends Error {
  constructor() {
    super("Görev başka bir işlemle değişti veya artık erişilemiyor. Güncel kaydı yükleyip tekrar düzenleyin.");
    this.name = "TaskConflictError";
  }
}
