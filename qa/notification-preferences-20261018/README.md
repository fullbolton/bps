# Bildirim sesi tercihleri — 18 Ekim 2026

Hesabım ve talep bildirim kutusu aynı provider üzerinden çalışır. Tercih yalnız tarayıcıda hesap+şirket anahtarına on/off olarak yazılır; içerik saklanmaz. Kaydedilmiş açık tercih otomatik ses başlatmaz: yeni sekme/yenileme sonrası kullanıcı etkinleştirir. Kapatma diğer aynı kapsamdaki sekmeleri susturur; kullanıcı/şirket/rol değişiminde cihaz kapanır. Bekleyen etkinleştirme iptal edilebilir. Depolama, ses veya Web Locks hatasında ses etkinmiş gibi gösterilmez; görsel kutu devam eder.

## Ölçümler

- Genel uygulama 766/766 PASS (application.tap); sekiz yeni controller testi dahil.
- TypeScript ve Next production build PASS; statik 0 FAIL/1 mevcut unreachable-component WARN.
- Yerel gerçek GoTrue/PostgREST oturumuyla: Hesabım → sesi aç → bildirim kutusunda açık; kutudan kapat → Hesabım kapalı.
- Yenilemede tercih açık, etkinlik kapalı; ikinci sekmede otomatik etkinleştirme yok.
- İki sekmede etkinleştirip birinde kapatınca diğerinde kapalı durumu doğrulandı.
- 390px mobilde clientWidth=scrollWidth=375; mobile.png. Ses çıkışının insan tarafından duyulduğu iddia edilmez; AudioContext ve UI sonucu doğrulandı.
- Üretim salt okunur ön kontrolü 186 migration; yeni SQL yok. Yayın sonucu release.json ile eklenecek.

## Sınırlar

Bu ayar yönetici/operasyon için mevcut talep etiket/yanıt kutusunu kapsar. Görev ve duyuru olayları, push ve e-posta bu pakete dahil değildir. Başka tarayıcı/cihazla senkronizasyon yok. İlk liste sessiz ve mevcut sekmeler arası olay deduplikasyonu korunur. Yerel browser yazmaları yalnız sentetik hesapta yapıldı.

## Yayın

6cd6007, dpl_DzXDKuGn8wt2bQdPwAP45qAnrVJR: www.bpsys.net üzerinde READY bağımsız inspect ile doğrulandı. Canlı Hesabım ve bildirim kutusunda yeni kontroller ve başarılı boş liste okuması görüldü; gerçek hesap tercihi değiştirilmedi. Ayrıntı release.json.
