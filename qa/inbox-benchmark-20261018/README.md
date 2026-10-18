# Bildirim kutusu benchmark ve uygulama kararı

18 Ekim 2026. Resmi kaynaklar yeniden araştırıldı:

- Asana: https://help.asana.com/s/article/inbox — bildirim türü filtreleme, okunmamışa döndürme ve arşivleme.
- monday.com: https://support.monday.com/hc/en-us/articles/360015535060-Bell-Notifications — metin/bağlam arama ve okundu sonrası bildirimle çalışmaya devam etme.
- monday.com: https://support.monday.com/hc/en-us/articles/115005309885-The-Update-Feed-Inbox — akış filtreleri ve toplu okundu. Update Feed ile kişisel bildirim kutusu aynı ürün yüzeyi değildir; tek özellikmiş gibi aktarılmadı.

## BPS'e uygulanan

Operasyon çalışanı/yönetici yoğun ortak kutuda aradığı işi bulabilsin diye metin arama, görev/duyuru/talep türü seçimi ve yalnız okunmamış filtresi eklendi. Varsayılan tümü; filtre temizleme tek işlem. Türkçe küçük harf dönüşümü kullanılır. Filtreler yalnız yüklenen sayfalara uygulanır; etiket ve sonuç sayısı bu sınırı açıkça belirtir. Global okunmamış rozet sunucudan geldiği gibi kalır. Eşleşme olmasa da sonraki sayfa düğmesi korunur; tüm arşivde arama veya tüm sonuçları getirme iddiası yoktur. Sunucu erişim sınırları değişmedi.

## Bilinçli olarak ertelenen

Arşiv, okunmamışa geri alma ve toplu okundu: yeni server komutu, güncel üyelik/modül/olay erişimi, yarış ve idempotency kabulü gerekir. Kullanıcı görmediği geçmişi yanlışlıkla temizleyen istemci döngüsü eklenmedi. Tüm geçmişte arama ihtiyaç olduğunda filtreli sunucu cursor sözleşmesi tasarlanmalı; mevcut local filtre onun yerine sunulmaz.

## Kabul

14/14 hedefli action/bileşen testi; TypeScript temiz; statik 0 FAIL/0 WARN; diff kontrolü temiz. Yeni filtre testi Türkçe arama, kaynak+arama kesişimi, temizleme, okunmamış, sayfalama ve global sayacın korunmasını çalıştırır. Bunlar gerçek bileşen callback testleri; DOM/tarayıcı kabulü değildir. Yeni SQL yok. Bu paket ve önceki bağlantı düzeltmesi yereldedir; tarayıcı kabulü ve üretim yayını yapılmadı. Önceki 787 genel test/build kanıtı önceki kaynak içindir; bu filtre değişikliğinin tüm suite/build sonucu olarak sunulmaz.
