# Banka şubesi ve dönemsel otel — yerel uçtan uca kabul

## 047 — 2026-09-10: Sektör tarayıcı yazma kabulü tamamlandı

046'nın 11 kontrolüne 3 grup eklendi; **14 grup geçti**. Aynı `BPS_PILOT_BROWSER=1` komutu artık yazmaları da çalıştırır. Yerel izole Chromium, geçici hesabın gerçek server action ve Supabase yollarını kullanır; route/RPC mock yok.

- Bankada tarayıcıdan yeni günlük talep açıldı, boşta olan personel atandı, Gelmedi seçildi, Personeli değiştir formuyla yeni yedek atandı. Reload sonrası tek yeni talep, yedek atama ve eski gelmedi geçmişi korundu.
- Otelde tarayıcıdan ayrı talep açıldı; mevcut talebin ikinci personeline Gelmedi bildirildi ve yeni yedek atandı. İlk bağımsız teyit edilmiş yedek yerinde kaldı. Reload sonrası iki gelmedi geçmişi ve mevcut geldi kaydı görüldü. Yeni talep açık bırakıldı; bu kayıt için atama yapıldığı iddia edilmez.
- Ayrı authenticated istemci banka/otel yeni taleplerini, yeni yedek kimliklerini ve kaldırılan atamaların absent geçmişini doğruladı. Tarayıcı runtime error listesi boş; iki yazma ekranı incelendi.
- Testin önceki haftalık/CSV rakamları yazmalardan **önceki** fikstüre aittir. Sonraki faza yanlışlıkla aynı toplamlar uygulanmadı.
- Yalnız bu koşumun şirketleri, çalışanları, operasyon kayıtları ve hesabı finally ile temizlendi.

Kanıt `supabase/manual/local-20260910-047.json`; sentetik ekranlar ve dosyalar `/private/tmp/bps-sector-pilot-zIGgRj`. SQL ve uygulama değişmedi. Gerçek müşteri pilotu, native yazdırma ve canlı CSV kontrolü ayrı açık; sektör tarayıcı yazma kabulü artık iletişim bloğunun önünde beklemiyor.

## 046 — 2026-09-10: Tarayıcı okuma, gezinme ve indirme kabulü geçti

045 fikstürü temizlenmeden önce `BPS_PILOT_BROWSER=1` ile `scripts/qa-local-sector-browser.mjs` çalışır. Ayrı Chromium profiline yalnız geçici yerel test hesabının oturum çerezleri bellekte aktarılır. Gerçek hesap/profil/Downloads erişimi kullanılmaz. Browser yalnız izole 3010 adresini kabul eder; parent test finally ile kayıtları temizler.

- Her iki firmada günlük → haftalık → günlük geçişinde firma ve gün korundu. Banka özetleri 9 talep / 9 ihtiyaç / 3 atama / 6 açık; otel 2 / 5 / 4 / 1 olarak ekranda doğrulandı.
- Gerçek CSV butonu iki dosyayı Chromium download olayıyla indirdi. Python CSV okuyucusu tüm iş alanlarını önceki HTTP çıktısıyla birebir karşılaştırdı. Her istekte değişen **Veri alınma zamanı** ISO olarak ayrıca doğrulandı; dosyaların byte düzeyinde aynı olduğu iddia edilmez.
- Otelde “Gerçekleşmeyi getir” ile 1 geldi, 1 gelmedi bildirimi, 3 bildirilmemiş aktif atama görüldü. Günlüğe dönüp reload sonrası eski gelmeyenin kaldırılmış ataması ve yeni yedeğin geldi bildirimi birlikte korundu.
- 1440 px haftalık ve 390 px günlük ekran görüntüleri incelendi; personel geçmişi ve butonlar okunuyor. Browser runtime error listesi boş. Bu dar mobil kontrol tüm cihazların kabulü değildir.
- Önceki 8 API/HTTP/yetki/cleanup grubu dahil **11 grup geçti**. Browser veri yazmadı; yedek atama bu koşumda API ile oluşturuldu. Gerçek müşteri pilotu değildir.

Kanıt: `supabase/manual/local-20260910-046.json`; sentetik dosya ve ekranlar `/private/tmp/bps-sector-pilot-FjjpWD`. Uygulama hashleri canlı 044 manifestiyle eşleşti; yeni uygulama/SQL/deploy yok.

İlk denemelerde testin tam etiket eşleştirmesi, asenkron select seçeneklerini beklememesi ve değişken CSV zamanını byte karşılaştırması düzeltildi; her başarısız koşumda da cleanup geçti. Bunlar uygulama düzeltmesi olarak sayılmadı.

Çalıştırma: `BPS_PILOT_HTTP_ORIGIN=http://127.0.0.1:3010 BPS_PILOT_BROWSER=1 BPS_PLAYWRIGHT_MODULE=<playwright modül yolu> BPS_CHROME_EXECUTABLE=<Chrome yolu> node scripts/qa-local-sector-pilot.mjs`. Öncesinde dedicated sentetik Supabase ve env dosyasız 3010 uygulama kopyası hazır olmalı.

Kalan: aynı iki sektör senaryosunun browser üzerinden **yazma** kabulü, gerçek müşteri pilotu, native yazdırma diyalogu ve canlı CSV byte kontrolü. 045'teki tarayıcı açığı bu dilimde yalnız yukarıdaki kapsamda kapandı.

## 045 — 2026-09-10: Birleşik Auth/RPC/HTTP kabulü geçti

`scripts/qa-local-sector-pilot.mjs` dedicated sentetik Supabase kimliğini ve Docker portlarını doğrular. Mevcut uygulamadan ayrı, env dosyasız kaynak kopyası 3010 portunda kullanıldı. Test kendi hesabını ve iki şirketini oluşturur; finally bloğu yalnız bu kimliklerin kayıtlarını ve hesabını temizler. Gerçek müşteri pilotu veya tarayıcı kabulü değildir.

- Banka: CSV'den İstanbul/Ankara/İzmir üç şube. Aynı komut tekrarı eski makbuzu döndürdü; yeni komutla aynı CSV üç satırı atladı. Üç gün/üç şube = 9 ihtiyaç, 3 atama, 6 açık. Her gün 3/1/2; aynı personel aynı gün ikinci şubeye atanamadı.
- İşe başlama: personelin varış beyanı teyit sayılmadı. Bağımsız teyidin tekrarı ikinci kayıt oluşturmadı; yeni oturumda tek teyit ve present görüldü.
- Otel: iki günün ihtiyacı 2 ve 3; 4 atama, 1 açık. Gelmeyen personel yerine yedek atandı; replacement tekrarı aynı sonucu verdi. Eski absent kaydı ve bildirim zamanı korundu. Yeni atama başlangıç planını devraldı ve bağımsız teyit edildi. Gerçekleşme: 1 present, 1 tarihsel absent, 3 unreported; plan toplamlarıyla aynı kavram değildir.
- İki şirketin gerçek loopback HTTP CSV dosyaları bağımsız Python CSV okuyucusunda firma kapsamı ve ihtiyaç/atama/açık toplamlarıyla eşleşti. Günlük okumalar haftalık toplamlarla uzlaştırıldı.
- Yanlış tenant ve mevcut oturumda rol kaybı reddedildi. Geçici sentetik kayıtlar ve hesap temizlendi.

Sekiz kontrol grubu geçti. Son rapor: `supabase/manual/local-20260910-045.json`; sentetik CSV dosyaları `/private/tmp/bps-sector-pilot-XCa0Rn`. Çalıştırma: `BPS_PILOT_HTTP_ORIGIN=http://127.0.0.1:3010 node scripts/qa-local-sector-pilot.mjs`. Araç yalnız iki sabit loopback adresini kabul eder; route kontrolü hesap oluşturmadan önce yapılır.

İlk koşumda CSV adımı 20 saniyede zaman aşımına uğradı; cleanup geçti. Kısıtlı curl bağlantı hatasından “sunucu kapalı” sonucu çıkarılması düzeltildi: 3000 portunda repo süreci vardı, ağ izinli istekte de 20 saniye yanıtsız kaldı. Mevcut süreç durdurulmadı. İzole 3010 koşumu geçti; günlük uzlaştırma eklenince son koşum yeniden geçti.

Uygulama dosyaları canlı 044 manifestiyle birebir eşleşiyor. Bu dilim test/kanıt ekler; yeni SQL veya ürün deploy'u gerektirmez. Açık kapılar: gerçek müşteri pilotu, iki senaryonun tarayıcı kabulü, native yazdırma diyalogu ve canlı CSV byte kontrolü. Yerel HTTP CSV ölçümü canlı dosya ölçümü diye etiketlenmez.

2026-09-09. Bu plan gerçek müşteri pilot onayı değildir. Yalnız dedicated sentetik ortam, mevcut RPC/UI akışları; üretime veri veya e-posta gönderilmez.

## Sonraki çalışma

İki isim temsili olacak: Sentetik Kent Bankası ve Sentetik Sahil Oteli. Mevcut test kayıtları temizlenmez; senaryo kendi kayıt kimliklerini tutar. Yeni senaryo sonuçları diğer senaryoların toplamı sanılmaz.

1. Banka: CSV ile İstanbul/Ankara/İzmir üç şube, tek kişilik üç gün talebi; tekrar aktarımda mükerrerlik kontrolü. Bir personel aynı gün iki şubeye atanamaz. Günlük plan, açık kişi ve haftalık kişi-gün aynı kaynakla uzlaştırılır.
2. Otel: iki güne farklı kapasite, toplu talep, iki personel; gelmedi bildirimi ve yerine personel. Eski bildirim tarihi korunur, aktif yerleştirme ve gerçekleşme karıştırılmaz.
3. İki senaryoda firma+tarih seçimi, günlük kayda geçiş ve CSV çıktı başlık/sayıları doğrulanır. CSV üretimi mali hakediş/bordro onayı değildir.
4. Yanlış tenant ve yetkisiz rol, aynı komut tekrarı mevcut testlerle birlikte doğrulanır. Tarayıcı kabulü API testinin yerine geçmez.
5. Çıktıya senaryo kimlikleri, beklenen/ölçülen rakam, hangi katmanın test edildiği ve açık kapılar yazılır. Sadece başarılı ölçümler tamamlandı işaretlenir.

## Açık kapılar

Gerçek kaynaklardan otomatik şube keşfi, müşterinin gerçek pilot kabulü, e-posta/PKCE/hook uçtan uca, üretim şema/owner/redirect ön kontrolü, ticari paket hakları. Eski talep verilerini taşıma veya silme bu senaryo içinde yapılmaz.
