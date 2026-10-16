# Yayın sırası — 16 Ekim 2026

Durum: güncel üretim ledger 129, son 20261004001400. Güncel yalnız-şema kopyasında 53 aday geçti. Uygulama 686/686, tip kontrolü ve yerel adresle üretim derlemesi başarılı. Bu belge yayın gerçekleştirildiğini göstermez.

## Birlikte geçiş gerektiren durum

Eski uygulama tabloya doğrudan yazıyor. Yeni uygulama appointment_execute_v1, contract_execute_v1, contract_delete_v1 ve document_* komutlarını kullanıyor. Yeni uygulamayı önce açmak eksik RPC hatası; tüm migration'ları önce uygulamak eski uygulamada yazma hatası doğurabilir. Eski tarayıcı sekmeleri ve arka plan yazıcıları da hesaba katılmalı.

Özellikle 20261013000200 takvim, 20261015000200/000400 sözleşme yazma/silme, 20261016000600/000700/000800 evrak yazma kapılarını kapatır. 20261015000600 ve 20261016000900 Storage silme/legacy yollarını sınırlar. İlk 31 aday da görev/firma/not/kişi ve diğer modüllerde eski yolları kapatan adımlar içerir. Bazı dosyalar yeni komut ile kapıyı aynı transaction'da ekler; sadece dosya adındaki cutover kelimesine göre ayırmak güvenli değildir.

## Uygulama sırası

1. Sürüm commit'i ve uzak dal yedeği doğrulanır; Vercel yayınlanacak commit açıkça seçilir. İşlem öncesi ledger yeniden okunur, 53 dosyanın hashleri full/result.json ile karşılaştırılır. Kaynak değişmişse prova yenilenir.
2. Yazma trafiği için doğrulanmış bakım/geçiş mekanizması hazırlanır. Sadece banner veya kullanıcıya mesaj yeterli değildir: eski sekmeler, API/server action çağrıları, zamanlanmış servis yazıcıları ve Storage yolları da durmalıdır. Bu mekanizma bu pakette uygulanmış veya ölçülmüş değildir. Doğrulanmadan eşzamanlı canlı trafik altında tek paket geçişe başlanmaz.
3. Trafik durduktan sonra yalnız bu 53 dosyalık izole yayın klasörü üzerinden sayısal sırayla migration uygulanır. 20260722000200 eski taslağı kesinlikle dahil edilmez. Her transaction sonucu ve uzak ledger kaydı ölçülür; hatada sonraki adım çalıştırılmaz.
4. Yeni uygulamanın doğrulanan commit'i dağıtılır; gerçek ortam değişkenleri/feature flagleri kontrol edilir. Modül kapatma mutationAvailable=false olarak korunur.
5. Oturum, şirket seçimi, takvim oluşturma/tamamlama, sözleşme düzenleme, evrak yükleme/kurtarma/iptal/temizlik yetkileri kimlikli kabulden geçirilir. Başarılı olmadan trafik tekrar açılmaz. Eski sekmelere yeni sürüm yükletilir.
6. Canlı commit, migration listesi, kabul kanıtı ve güncel ilerleme kaydı tek yayın kaydında birleştirilir.

## Hata ve geri dönüş

Şema geçişinden sonra eski uygulamaya kör rollback yapılmaz: kapatılan raw yazma yollarını kullanacaktır. Hatalı migration kendi transaction'ını geri alır; daha önce commit edilen migration'lar kalır. Trafik kapalı tutulur, uygulanmış prefix ledger üzerinden saptanır, aynı şemayla uyumlu uygulama/düzeltme hazırlanır. Veritabanını resetleme, tablo/veri silme veya uygulanan tarihsel migration'ı değiştirme yoktur.

## Açık kalanlar

- Yazma trafiğini gerçekten durduran bakım mekanizması ve tekrar açma kabulü.
- Gerçek veri hacminde kilit/backfill maliyeti; boş sentetik prova bunu ölçmez.
- Gerçek Vercel ortamıyla son build/dağıtım, uzak yedek ve yayın sonrası kabul.
- Tam DB suite bu tur yeniden çalıştırılmadı; envanterde 27 DB ve 7 pending dosya bulunması hepsinin geçtiği anlamına gelmez.


## Uygulama bakım kapısı — uygulandı, varsayılan kapalı

`BPS_MAINTENANCE_MODE=1` sunucu ortam değişkeniyle middleware bütün istekleri oturum yenilemeden önce HTTP 503 ile durdurur. GET cron, server action POST, API ve uzantılı yollar dahil; header/URL ile bypass yok. GET HTML için Türkçe sayfa, diğer istekler için MAINTENANCE JSON kodu, HEAD için boş gövde döner. no-store ve Retry-After:120 gönderilir; mutasyon otomatik yeniden denenmez. Ortam değeri tam olarak 1 değilse mevcut oturum davranışı korunur. Üretim ortamı bu tur değiştirilmedi.

Gerçek yerel Next sunucusunda Supabase adresi erişilemezken altı HTTP yolu/yöntemi ve Türkçe HTML kabulü geçti. Kanıt maintenance-http.json. Kapı tüm dağıtımlara kendiliğinden yayılmaz: eski deployment URL'leri ve doğrudan Supabase/Storage bağlantıları dışarıdadır. Başlamış işlemleri iptal etmez veya boşaldıklarını kanıtlamaz. Eksik DB/Storage yazma bariyeri ve in-flight drain kabulü kapanmadan tam bakım koruması sayılmaz. Bu kodu içeren yeni sürümün önce SQL'siz/uyumsuz biçimde canlıya alınması da çözüm değildir; gerekirse mevcut canlı sürüme yalnız bu bağımsız kapı taşınır ve bakım açık dağıtım ayrıca doğrulanır.


16 Ekim: Geçici DB yayın bariyeri prototipi qa/release-chain-20261016/barrier altında hazır. Yerel 90 tabloda mevcut DML bekleme/okumaya izin, authenticated/service/Storage session_user reddi, SECURITY DEFINER yolu, yeni tablo extend ve atomik kaldırma dahil 9 kontrol geçti. Doğrudan admin migration DML’i açık. SQL otomatik migration değil; aday sayısı 53. Üretimde uygulanmadı. Gerçek Storage HTTP, üretim bağlantı kimliği ve bariyer açık tam 53 zincir provası bekliyor; fiziksel dosya aktarımı/drain bütünüyle kanıtlanmadı.
