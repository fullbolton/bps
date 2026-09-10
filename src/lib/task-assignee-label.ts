/** Display only; never used to decide assignment or write permission. */
export function taskAssigneeLabel(
  task: { assigned_to_user_id: string | null; assigned_to: string | null },
  currentName: string | undefined,
  directory: "loading" | "error" | "ready",
): string {
  if (!task.assigned_to_user_id) {
    const legacy = task.assigned_to?.trim();
    return legacy ? `${legacy} (eski kayıt)` : "Atanmadı";
  }
  if (directory === "loading") return "Atanan kişi yükleniyor…";
  if (directory === "error") return "Atanan kişi bilgisi alınamadı";
  if (currentName === undefined) return "Atanan kullanıcı listede yok";
  return currentName.trim() || "Adı belirtilmemiş kullanıcı";
}
