# Proje personel kodu koruması — 2026-09-28

Baz 9b8c9f8. İlk dar veri koruma bloğu yalnız personCode / eşleme code alanını kapsar. Kimlik doğrulaması, checksum veya kimlik sorgulaması yapılmaz.

## Kural ve kapsam

NFKC sonrasında boşluk, nokta, parantez ve tire çıkarılınca tam 11 ASCII rakam kalan personel kodu reddedilir. Tüm JS whitespace karakterleri SQL ile parite testinde doğrulandı. Bu konservatif kural 11 haneli normal iş kodunu da reddeder; kullanıcı ayrı iş kodu kullanmalıdır. P- önekli kodlar, 10/12 basamaklı sayılar, tarih ve UUID etkilenmez. Başka biçimlerde gizlenmiş kimlik verisini yakalama garantisi yoktur.

- Excel/CSV önizleme: satır bekletilir; accepted value null, hata kodu değeri içermez.
- Sunucu işlemleri: kişi eşleme araması, eşleme yazımı ve aktarım hazırlamada kontrol.
- DB migration 20260928000700: reporting_person_codes, reporting_person_code_events, reporting_imports rows/resolved/previous_rows için INSERT/UPDATE trigger kontrolü. RPC veya doğrudan yetkili yazım UI'yı atlayarak bu alanlara yasak kod kaydedemez.
- Migration önce üç tabloyu SHARE ROW EXCLUSIVE kilitler; aggregate-only preflight sıfır değilse transaction rollback. Eski kayıtlar değiştirilmez/silinmez. 5 saniye lock timeout, 60 saniye statement timeout; toplam işlem zamanı garantisi değil.
- Ham kaynak XLSX/CSV dosyaları, diğer kod alanları, serbest metinler ve telefon alanları bu bloğun dışında. Bu sürüm “sistemde kimlik verisi yoktur” garantisi vermez.

## Kabul

500 uygulama testi, 10 sentetik DB testi, tip/statik/üretim derlemesi. Dört yeni uygulama vakası + iki yeni DB vaka ve mevcut aktarım testinde doğrudan eşleme/RPC/JSON/audit yazma retleri. Gerçek DB fixture testleri transaction rollback; üretime test iş kaydı yok. Mevcut yasak kayıt senaryosunda migration'ın yardımcı fonksiyonları da geri alması test edildi.

İzole Supabase yayın dizisi /private/tmp/bps-person-code-db-20260928: 122 uygulanmış migration byte olarak aynı, dry run yalnız 20260928000700 gösterir. Uygulama koruması DB migration'dan sonra yayımlanır.
