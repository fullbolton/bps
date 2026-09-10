# 044 — Haftalık personel listesinde gereksiz HTML tekrarları

2026-09-10 · Yerelde tamamlandı; yayımlanmadı.

043'ün PDF devam satırlarında her satır, ekrana ait tam personel listesini de gizli olarak taşıyordu. 100 personel için dokuz devam parçası oluştuğunda HTML'de 900 ekran adı + 100 yazdırma adı bulunuyordu. Ekran ve PDF doğruydu, fakat gereksiz içerik üretiliyordu.

Tam ekran listesi artık yalnız ilk satırda oluşturuluyor. Diğer satırlar sadece kendi yazdırma parçasını içeriyor. 100 personel örneğinde ad tekrarları 1.000'den 200'e indi: 100 ekran, 100 yazdırma. Sentetik belgenin toplam HTML boyutu (gömülü CSS dahil) 145.473 byte'tan 112.417 byte'a indi. Bu bir render süresi ölçümü değildir.

## Kabul

- Mevcut `qa-weekly-print.cjs`: ekran tek talep ve 100 isim; yazdırma 100 isim koşulları geçti.
- Tek kayıt, 40 kayıt ve 100 personel PDF'lerinin metni 043 ile birebir aynı.
- Üç çıktının toplam 10 sayfası PNG'ye çevrildi; önceden görsel kabulü yapılan 043 çıktılarıyla piksel hash'leri birebir aynı.
- TypeScript ve diff kontrolü geçti. Sadece WeeklyOperations içindeki gizli ekran listesinin render koşulu değişti; SQL ve CSV yolu değişmedi.
- Ölçüm: `supabase/manual/local-20260910-044.json`; sentetik çıktılar `/private/tmp/bps-print-044`.

## Güncel sınır ve sonraki adım

Bu otomatik tur production, push veya deploy yapmadı; canlı baseline 043 (`dpl_3496nCsZVRrsykaWEiCGJeKAdzyk`). 044 çalışma ağacında yerel farktır; eski yayın manifesti değiştirilmez.

Son kullanıcı izin turunda native Chrome erişimi çalıştı; buna rağmen Downloads dosya sistemi denemesi hâlâ `Operation not permitted` döndü. Chrome iç indirme sayfasının URL politikası ayrı kısıttır; başka yüzeyden aşılmayacak. Canlı CSV byte kontrolü ve native yazdırma diyalogu kabulü açık. Bu otomasyon aynı izin isteğini tekrar etmez veya üretim kontrolüne geçmez. Yeni somut bulgu olmadan aynı testleri tekrarlayıp yeni özellik biriktirmek yerine bu yerel düzeltme bir sonraki yetkili teslimde ele alınır.
