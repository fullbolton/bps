# Bana gelenler — ilk etkileşim paketi

Kapsam: mevcut talep konuşmalarındaki etiket ve yanıt bildirimleri. Yeni görev atama ve duyuru bildirimleri bu pakette üretilmez. Mevcut conversation feature flag ve yönetici/operasyon erişimi korunur. Yeni SQL veya izin genişletme yoktur.

## Kullanıcı davranışı

- Üst çubukta okunmamış sayısı; kutuda Bana gelenler başlığı, yeni kayıtların belirgin kartı, üç satırlık önizleme ve Talebi aç bağlantısı.
- Kutu açılmadan, görünür ve çevrimiçi sekmede 30 saniyede bir son 30 bildirim sorgulanır. İlk açılış, görünürlüğe dönüş ve bağlantıya dönüşte de kontrol yapılır. Bu bir Realtime/push garantisi değildir; sunucu ve ağ gecikmesi eklenebilir.
- Önceki bildirimler elle yüklenir. Kullanıcı kutu açıkken geçmişi inceliyorsa otomatik sorgu durur; En yeniye dön veya kutuyu yeniden açma son sayfayı getirir.
- Link, açık formun NavigationGuard kontrolünden geçer. Bağlantıya gitmek okundu sayılmaz; Okundu işaretle işlemi sunucudan doğrulanır. Okundu bilgisi işin tamamlandığı veya metnin anlaşıldığı iddiası değildir.
- Escape ve dışarı tıklama kutuyu kapatır. Mobilde genişliğe sığan panel ve en az 44px butonlar vardır.

## Ses

Varsayılan sessizdir. Sesi aç kullanıcı hareketi AudioContext'i etkinleştirir ve kısa deneme sesi üretir. Tercih bu sekmenin ömrü içindir; tam sayfa yenileme, oturum/şirket değişimi ve kapatma sesi sıfırlar. Sayfa kapalıyken veya görünmezken ses/push yoktur. Tarayıcı ses politikasına takılırsa kullanıcıya tekrar açması söylenir, görsel bildirimler devam eder.

İlk başarılı veri okuması sessiz başlangıçtır: eski bildirimler açılışta topluca çalmaz. Sonraki okumada yeni görülen okunmamış kimlikler adaydır. Aynı tarayıcıdaki sekmeler Web Locks + localStorage ile aynı olay için tek ses talep eder. Mesaj içeriği kaydedilmez; yalnız son 300 olay kimliği ve zaman tutulur. Bir dakika içindeki ek olaylar sessizce tüketilir, daha sonra tekrar çalınmaz. Bu sınırlı geçmiş uzun dönemli tam teslim garantisi değildir. Depolama/kilit hatasında koordinasyonsuz sese düşülmez. Ses kaybı mümkündür (örneğin kayıt ayrıldıktan sonra sekme kapanır); görsel gelen kutusu asıl kaynaktır.

Tek cihazda koordinasyon vardır; cihazlar arası ses tekilleştirme yoktur. Bildirim oluşturma/teslim zamanı ile sorgu zamanı aynı şey değildir. Görev atamaları, önemli duyurular, kullanıcı bildirim tercihleri ve kapalı uygulamaya push sonraki paketlerdir.

## Güvenilirlik

Bileşen kullanıcı + tenant + rol anahtarıyla yeniden kurulur; eski istek sonuçları kapatılmış bileşene uygulanmaz. Inbox server action doğruladığı actor/tenant kimliğini döndürür; istemci bunu beklediği kapsamla karşılaştırır. Gövde/isim eski şirkete taşınmaz. Yinelenen inbox kimlikleri ve geçersiz iş günleri reddedilir. Hata ve çevrimdışılık sıfır okunmamış gibi gösterilmez. API yetkisi mevcut Supabase RPC kontrollerinde kalır.

## Kaynaklar

- https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices — kullanıcı etkileşiminden AudioContext oluşturma/uyandırma.
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API — aynı origin sekmelerinde koordinasyon.

Bu teknik paket, araştırılan geniş duyuru geliştirmesini (başlık, hedef kitle, arşiv, teyit) tamamlamaz.
