# Evrak takibinde gerçek sorumlu ve takip görevi — sonraki P08 dilimi

2026-09-09. 02000 ana PDF / ek protokol ayrımı tamamlandıktan sonraki plan.
Henüz uygulanmadı. Mevcut yenileme görev motorunu çoğaltmadan ilerle.

## Başlangıç ölçümü

- `documents` tüm yazılarda DB revision ilerletiyor. Ana PDF/ek protokol kimliği,
  sözleşme bağlamı ve sürüm geçmişi 01800–02000 ile korunuyor.
- `updateDocumentValidity()` dosya varlığını okuyup validity_date/status güncelliyor;
  expectedRevision istemiyor. Tarih güncellemesi gerçek takip sahibi oluşturmaz.
- Firma evrak listesi kategori, tarih ve sözleşmeyi gösteriyor. Ek protokol başlığı
  ayrı görünüyor; bağlı dosyadan sözleşmeye gidiliyor. Bağlı dosyanın firma listesinden
  silme düğmesi yok; DB geçmişi ayrıca koruyor.
- 01700 gerçek sözleşme yenileme görevi, 01300 task revision/geçmişi,01500 devir,
  01600 aktif iş bırakmayı engelleyen üyelik/rol kapısı zaten var.

## Kullanıcı sonucu

“Bu evrak için kim, hangi tarihe kadar neyi takip edecek?” sorusu gerçek bir görev
ve kullanıcıyla yanıtlanmalı. Evrak geçerlilik tarihi ile işin takip tarihi ayrı
alanlardır. Dosya yüklemek, tarih değiştirmek veya görevi tamamlamak evrakın hukuki
geçerliliğini doğrulamaz; sözleşmeyi kendiliğinden yenilemez.

## Uygulama sırası

1. Geçerlilik güncellemesini observed revision ile CAS yap. Gerçek takvim tarihini
   doğrula; dosyasız belgeyi tam sayma. Çakışmada kullanıcı eski veriyi sessizce
   ezmesin. Mevcut okuyucu/form/servis çağırıcılarını birlikte bul ve güncelle.
2. Dar ilişki/receipt migration'ı: document→task,tenant/company/opsiyonel contract,
   oluşturma komutu ve dayanak. İlk dilimde belge başına tek kalıcı takip ilişkisi;
   döngüsel görev üretme veya eski görevi sessizce yeniden açma yok. PDF sürümü
   değişince document kimliği aynı kaldığından ilişki korunur.
3. Yönetici, belge üzerindeki eylemden canlı üye ve takip tarihi seçer. RPC actor,
   verified tenant,rol,aktif firma,belge revision/bağlamı ve hedef üyenin yetkisini
   doğrular. Task+ilişki+receipt atomik. Aynı komut tekrarı aynı sonucu döndürür;
   iki ilk çağrı tek görev yaratır. 01700 ve belge yükleme kilit sıralarıyla uzlaştır;
   üyelik/rol değişimi, PDF finalize ve metadata update yarışlarını gerçek PG'de sınar.
4. Kart sahibi/tarihi/durumu her zaman task'tan okunur; receipt'teki ilk kişi canlı
   sahiplik değildir. Görev devri karta yansır; kişinin üyeliğini kaldırma mevcut
   01600 kapısıyla engellenir. Belge/firma/contract/task ilişkisinin silme ve bağlam
   değişimi kısıtlarını birlikte ele al. Genel firma evrakının var olan silmesini
   sebepsiz tamamen kapatma; bağlı takibin geçmişini koru.
5. Firma evrak ekranından gerçek görev kartı; gerekirse global evrak listesine aynı
   servis. Yetkisiz rol yazamaz. Okuma hatası “takip yok” sayılmaz. Mevcut01700
   sözleşme yenileme görevi ile yeni evrak takibinin amacı açıkça ayrılır.
6. Unit, native yarış ve gerçek yerel Auth/API; browser create→devir→yeni sahip,
   revision conflict,tekrar/tek görev,PDF yeni sürümü sonrası ilişki. Mevcut
   bildirim/cron tarihlerinin etkisini incele; yeni e-posta veya otomasyon ekleme.

## Sınırlar ve ortam

Bu bir doküman onayı/e-imza/otomatik hukuki süre motoru değildir. Kullanıcı kaynak
ve dayanağı kendisi girer; tarih tahmin edilmez. Eksik belgeyi AI tamamlandı saymaz.
02000 yalnız dedicated bps-supabase-acceptance üzerinde;20 yerel migration, gerçek
veri yedeği/temizliği, üretim migration, push ve deploy yok. .env.local remote
hedefli kaldığından testlerde kullanılmaz. Eski fixture scriptleri02000 mevcutken
01800/01900 fonksiyonlarını geri yazmamalı; yeni guard buna göre eklendi.
