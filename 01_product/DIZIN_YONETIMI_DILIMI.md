# Şube ve personel dizini

## A — Aranabilir dizin (yerelde tamamlandı)

Seçili firmanın şubeleri ve doğrulanmış çalışma alanının personeli ayrı görünür.
Personel firmaya aitmiş gibi etiketlenmez. Yönetici ve operasyon okuyabilir; diğer
roller ve anon erişemez. Yeni alan/tablo yok; salt-okunur RPC ile 50 satır/sayfa.
Kod/ad/il (şube), kod/ad (personel) araması; tümü/aktif/pasif filtresi. Arama metni
harfi harfine alt dizedir: yüzde ve alt çizgi wildcard değildir. Büyük/küçük harf
karşılaştırması PostgreSQL lower/collation davranışını izler; aksan kaldırılmaz.
Şube kodları metin olarak kalır, baştaki sıfırlar korunur. Elle eklenmiş kodsuz
şube “Kod yok” görünür; id'den hayali kod türetilmez.

Toplam ve sayfa aynı DB snapshot'ındandır. Farklı sayfalar arasında kayıt değişirse
sıralama kayabilir; tüm sayfalar tek donmuş snapshot iddiası yok. Ofset boş sayfaya
kayarsa ilk sayfaya dön bağlantısı; veri hatası boş dizin sayılmaz. Önce rol, tenant,
firma kapsamı doğrulanır. Pilot bayrağı tüm yeni yüzeylerde geçerlidir.

## B — Kontrollü aktiflik (yerelde tamamlandı)

Yalnız yönetici aktiflik değiştirebilir. Pasife alma mevcut talep/atama/bildirimleri
silmez; yeni işlemler kapalı olur. Şube güncellemesi şirket SHARE → lokasyon UPDATE;
atama şirket → talep → lokasyon SHARE → personel UPDATE sırasındadır. Güncelleyici
talep kilidi istemediğinden ters sıra oluşturmaz. Aktiflik revision'ı eski ekranı,
kalıcı komut kimliği tekrar gönderimi kontrol eder. Yanıt kaybı ve kapatılmış komut
önceki protokole uyar. Son kabul aşağıdaki B uygulama bölümündedir.

## A kabulü — B öncesi, 2026-09-09

01100 sadece dedicated sentetik yerelde uygulandı. 66 birim / 163 DB / 37 yerel API
kontrolü geçti; tsc temiz, qa:static183 dosya 0 FAIL/2 eski WARN. Native 37 yarış
önceki yazma aşamasına aittir, salt-okunur dizin için yeniden çalıştırılmadı.
IAB: 51 şube 1–50 / 51–51 sayfaları; Pasif filtresi yalnız Dizin kabul00002;
000000000000001 kod araması tam sıfırlarla bulundu; personel BROWSER-01 araması,
çalışma alanı kapsamı, mobil390px/scrollWidth390 ve console boş doğrulandı.
İki şube sentetik sayfalama fixture'ı olarak yerelde eklendi (biri başlangıçta pasif).
Hiçbir mevcut gerçek kayıt pasife alınmadı. B aktiflik yönetimi henüz kodlanmadı.

Sınırlar: her sayfa ayrı snapshot; arama substring/full scan, performans benchmark'ı
iddiası yok. En fazla 1000050 eşleşme/1000000 ofset; üstünde dar arama isteyen hata.

Son kapı: BPS_DAILY_OPERATIONS_ENABLED=true npm run build exit0; git diff --check temiz. Yerel dev dedicated sentetik Supabase ile yeniden başladı; .env.local değiştirilmedi.

## B uygulama ve kabul — 2026-09-09

01200 yalnız dedicated sentetik yerelde uygulandı. Her iki dizin tablosuna
`directory_revision` eklendi. Manager-only ops_set_directory_active; actor/verified
tenant/rol profil SHARE kilidinden sonra kontrol edilir. Şube değişimi company SHARE
sonra location UPDATE alır, request kilidi almaz. Atama location SHARE kilidi eklendi;
worker mevcut FOR UPDATE kontrolünü korur. Aktifleştirme pasif firmada reddedilir;
pasife alma ve tarihsel gerçekleşme düzeltmesi izinli kalır. Her yeni kabul edilen
komut, aktiflik değeri aynı olsa bile revision'ı artırır ve audit üretir; aynı komut
özgün sonucu tekrar döndürür. UI yalnız ters duruma geçiş önerir.

Ölçüm: 68 unit / 181 PGlite / 48 native yarış / 42 gerçek yerel API-service kontrolü
geçti. tsc temiz; static184 dosya 0 FAIL/2 eski WARN. Yarışlarda gerçek backend beklemesi
ölçüldü: atama ↔ worker/location pasifliği, yeni/toplu talep, replacement, eski revision,
komut kapatma ve manager rolünün kaybı. Aynı cmd yanıt kaybı tekrarında tek revision/audit;
aktif→pasif→aktif dönüşünde eski revision reddedildi. Geçmiş atama/bildirim korunuyor.

IAB: Dizin kabul00001 pasife al/yeniden aktifleştir; bekleyen kimlik temiz. Yerel
sentetik browser hesabı operasyon rolünde dizini okuyabiliyor, aktiflik düğmesi0;
hesap yöneticiye geri alındı. Personel dialogu390px, scrollWidth390; Vazgeç yeni
bildirim üretmedi. Console error/warn boş. Üretim/temizlik/push/deploy yok.

Son kapı: BPS_DAILY_OPERATIONS_ENABLED=true npm run build exit0; git diff --check temiz. Yerel dev yalnız dedicated sentetik Supabase ile yeniden başladı. .env.local değiştirilmedi; test hesabı yönetici ve test şubesi aktif bırakıldı.
