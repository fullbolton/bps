# M2o — Modül değişiklik önizlemesi

Yerel geliştirme. Üretim SQL, push, deploy veya tarayıcı kabulü yapılmadı.

## Sonuç

`preview_workspace_modules_v1` şirket yöneticisine tek snapshot içinde mevcut ayarları, seçilen taslağı, kapatılacak modülleri, bağımlılık ihlallerini ve bilinen açık iş kontrollerini döndürür. Ayarları değiştirmez. `advisoryOnly=true`, `mutationAvailable=false` her sonuçta zorunludur. Boş engel listesi kapatma yetkisi veya tüm kontrollerin tamamlandığı anlamına gelmez.

İstemci servisinde tek 12 saniye zaman sınırlı RPC vardır. Yanıt şirket/kullanıcı/üyelik/seçim sürümü/ayar revizyonu ve istenen taslakla karşılaştırılır. Eksik, tekrarlı, yanlış modüllü veya boolean olmayan kontroller reddedilir. Bağımlılıkları ihlal eden bir taslak önizlenebilir; bağımlılıklar sessizce açılmaz veya topluca kapatılmaz. Kullanıcı metinleri ve uygulamadaki mevcut çözüm sayfaları merkezi katalogdadır.

## 15 açık iş kontrolü

| Modül | Kontrol |
|---|---|
| Görevler | Tamamlandı/iptal dışında kalan görevler |
| Takvim | Tamamlandı/iptal dışında kalan randevular; ertelenmiş kayıtlar dahil |
| Sözleşmeler | Süresi doldu/feshedildi dışında kalan sözleşmeler; taslak ve imza bekleyen dahil |
| Personel havuzu | İşlenmesi bekleyen aktarım satırları |
| Operasyon | Tamamen doldu/iptal dışında eski personel talepleri |
| Operasyon | Bugün veya gelecekteki iptal edilmemiş günlük talepler |
| Operasyon | Bugün veya gelecekte kaldırılmamış görevlendirmeler |
| Operasyon | Onaylanmamış çalışma kayıtları; geçmiş tarihliler dahil |
| Operasyon | İptal edilmemiş ve bitiş tarihi geçmemiş/açık uçlu sabit kadrolar |
| Operasyon | Arşivlenmemiş, bitiş tarihi gelmemiş tekrarlı planlar |
| Proje raporlama | Kapatılmamış dönemler |
| Proje raporlama | Onaylanmamış/iptal edilmemiş aktarımlar |
| Müşteriler | Firmaya bağlı tamamlanmamış görevler |
| Takvim | Randevuya bağlı tamamlanmamış görevler |
| Sözleşmeler | Sözleşmeye bağlı tamamlanmamış görevler |

Her kontrol yalnız gerçekten kapatılacak modül için çalışır, tenant filtresi ve EXISTS kullanır. Kişi adları, içerikler veya tüm kayıt listeleri taşınmaz. Tarih sınırı oturum saat diliminden bağımsız Europe/Istanbul günüdür. Tanınmayan/null iş durumları bitmiş kabul edilmez. Personel aktarımında held/blocked satırların işlemi sonuçlanmıştır; bu kontrol yalnız pending ve bilinmeyen durumları engel sayar, tekrar işleme politikasını değiştirmez.

## Güvenlik ve eşzamanlılık sınırı

- Authenticated grant yöneticilik vermez: gerçek workspace bağlamında `yonetici` şarttır. Anon/service_role çalıştıramaz.
- Beklenen actor/tenant/revision uyuşmazsa sonuç üretilmez. Üyelik/seçim nesli mevcut context fonksiyonu ve istemci parser'ıyla kontrol edilir.
- STABLE fonksiyon tek statement snapshot'ı kullanır. Bu bir rezervasyon veya kayıt anındaki karar değildir.
- Gelecekteki ayar mutasyonu config kilidini alıp üyelik/revizyonu ve iş engellerini yeniden kontrol etmelidir. Mevcut writers aynı kilit protokolüne alınmadan kapatma açılmaz.
- Henüz evrak upload, finans, duyuru, havuzdaki diğer iş akışları ve tüm çapraz modül bağlarının eksiksiz kontrolü iddia edilmiyor. Müşteri ana kayıtlarının varlığı tek başına engel sayılmıyor; arşiv verisi kalabilir.
- SQL hata/eksik tablo/bozuk config durumunda boş başarılı rapor yoktur. Frontend ve DB timeout hataları yeniden otomatik yazma başlatmaz; bu endpoint zaten salt okunurdur.
- UI henüz ayarlara bağlanmadı. Bu blok önizleme servis sözleşmesini ve 15 bilinen kontrolü tamamlar; genel modül yönetiminin tamamı değildir.

## Test kapsamı

25 gerçek PostgreSQL senaryosu; production preview SQL + gerçek workspace/foundation fonksiyonları. İş tabloları yalnız bu SELECT'ler için gereken kolonları içeren sentetik fixture'lardır; tam üretim şeması/RLS/indeks performansı testi değildir. Her iş türünde kendi tenant/başka tenant/bitmiş kayıt ayrımı, rol ve revision reddi, İstanbul gün sınırı, yanlış şema hatası ve gerçek SQL yanıtının TypeScript parser uyumu test edilir.

7 yeni uygulama testi gerçek TypeScript kodunu çalıştırır. Çözüm bağlantılarının mevcut sayfalara gittiği, eksik/yanlış yanıtın reddi, bağımlılık taslağı ve taşıma hataları kapsanır. Tam uygulama ve 11 modül DB suite sonucu eşlik eden loglarda; beş eski bağımsız DB suite bu blokta çalıştırılmadı.

## Uygulama sırası

Foundation 20260928000900 ve başvurulan iş tabloları gereklidir. Yeni dosya yalnız read-only expand'dir; herhangi bir mevcut cutover sırasını değiştirmez. Kalan erişim sınırları ve canlı kabul bitmeden modül kapatma/kaydetme ekranı yayınlanmaz.
