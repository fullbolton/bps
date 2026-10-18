/** Keep the uncertain upload form intact while the user checks its receipt. */
export default function DocumentUploadReviewHelp() {
  return <aside className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
    <p>Aynı dosyayı tekrar yüklemeyin. Önce Evraklar listesini ve Yarım kalan yüklemeler bölümünü kontrol edin.</p>
    <p className="mt-1">Dosya ulaşmışsa mevcut yüklemeyi tamamlayabilirsiniz. Dosya görünmüyorsa işlem hâlâ sürüyor olabilir.</p>
    <a href="/evraklar#yarim-kalan-yuklemeler" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center font-medium underline">
      Yüklemeleri yeni sekmede kontrol et
    </a>
    <p className="text-xs">Bu form ve seçtiğiniz dosya burada kalır.</p>
  </aside>;
}
