/** Known database denials are definite failures; network errors stay uncertain. */
export function moduleAccessMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  if (error.code === 'BM001') return 'Bu işlem için gereken modül çalışma alanında kapalı.';
  if (error.code === '55000') return 'Çalışma alanı ayarları doğrulanamadı. Sayfayı yenileyip tekrar deneyin.';
  if (error.code === '42501') return 'Hesap veya çalışma alanı yetkisi değişti. Sayfayı yenileyin.';
  if (error.code === '25000') return 'İşlem ortamı doğrulanamadı. Yeniden deneyin.';
  return null;
}
