# Ana ekran kartlarının sınırlı okumaları

Dashboard sözleşme/evrak/kritik tarih kartları için bütün listeleri indirmez. Filtreler LIMIT'ten önce veritabanına gönderilir. Sözleşme ve evrak kartlarında en fazla 5, kritik tarihlerde 4 satır gelir. Kartta kullanılmayan alanlar seçilmez. Firma KPI'sı yalnız HEAD/count sorgusudur; firma adları görünen kart ve yüklenmiş görev referansları için id/name olarak, 75 kimliklik parçalarla okunur.

- Sözleşme: aktif, bitiş günü İstanbul'da bugün veya sonrası; bitiş tarihi ve id sırası.
- Evrak: açık eksik durumu, olmayan/boş dosya yolu, 30 gün içinde veya geçmişte geçerlilik tarihi ya da tarihsiz ama tam olmayan kayıt. Güncel durum mevcut currentDocumentStatus ile hesaplanır. Yenilenmiş ileri tarihli dosyanın eski saklı uyarısı kartı doldurmaz. Güncelleme tarihi azalan, id artan sıra korunur.
- Kritik tarih: bugün + 30 gün dahil, geçmiş tarihler dahil; tarih ve id sırası.
- Tarih aralıkları ve görünen kalan gün aynı İstanbul takvim gününe dayanır. Diğer ekranların tarih yardımcıları bu değişiklikte değiştirilmedi.

Exact count, kartın beklediğinden kısa sunucu yanıtını fark etmek için kullanılır. Hata/eksik yanıt boş ve sağlıklı kart gibi gösterilmez. RLS aynen uygulanır. Bu ayrı sorgular tek atomik snapshot değildir; eşzamanlı değişikliklerde kartlar ve KPI farklı anları temsil edebilir. Exact count maliyeti ve uçtan uca hız kazanımı ölçülmedi; kanıtlanan iyileştirme transfer edilen satır/alan sınırıdır.

Görevler kartının bütün açık görevleri okuma yöntemi ve görev listesi arama/sayfalama işi bu pakette tamamlanmadı. Diğer ekranların tam liste okuyucuları silinmedi. Migration veya indeks değişikliği yok.

Testler gerçek Supabase query builder ile filtre, limit, sıra ve projection'ı; kısa sunucu cevabı, eksik count, yinelenen satır, hata ve şirket kimliği batch'lerini sınar. Canlı HEAD kontrolleri sorgu sözdizimi/şemasını denetler; kullanıcı RLS doğrulaması sayılmaz.
