# Kurtarma kabulü — ne kapandı, ne açık?

18 Ekim 2026. Bu bir üretimde çalıştırılacak SQL veya yedek alma talimatı değildir. Kullanıcı gerçek verinin tam içerik yedeğini onaylamamıştır; sentetik tatbikat bu sınırı değiştirmez.

| Alan | Ölçülen sonuç | Kalan |
|---|---|---|
| İş veritabanı | 120 tablo içerik hash'i; şema, sahiplik ve ACL eşitliği | Baştan kurulan sunucuda rol/eklenti/temel şema kurulumu |
| Sayaçlar | 3 sequence; başlangıç dışı called/uncalled ve nextval eşitliği | Gerçek işletim verisinin sayaç tutarlılığı |
| Dosya deposu | Yeni boş yerel file-backend; byte + extended attribute geri yükleme | Yönetilen bulut/S3 obje sürümleri ve sağlayıcı kurtarma yolu |
| Bekleyen işler | Dosyalı/dosyasız rezervasyon, finalize tekilliği, iptal ve temizlik | Gerçek operasyon kesintisi ve geri dönüş süresi hedefi |
| Auth | Parola, aktif access/refresh, hook; yedek öncesi kapatılmış refresh oturumu reddi | Snapshot sonrası erişim değişiklikleri, anahtar rotasyonu, MFA/e-posta |
| Uygulama | Ayrı tarayıcı koşusunda gerçek giriş ve evrak server action akışları | Tek birleşik yeni-sunucu/DB/Auth/Storage tarayıcı koşusu |

## Gerçek kurtarma öncesinde doğrulanacak sıra

1. Hedef sunucu/proje ve kurtarma noktası açıkça belirlenir. Bu testlerdeki geçici container isimleri üretim hedefi değildir.
2. Uygulama commit'i, migration ledger, platform sürümleri ve gerekli ayarların uyumlu olduğu ölçülür. Repo tarihsel temel DDL eksiği bu testle giderilmiş değildir.
3. DB ve obje deposunun aynı kurtarma noktasını temsil ettiği doğrulanır. DB dump tek başına dosya içeriğini kapsamaz.
4. Snapshot sonrası oturum/üyelik/parola iptalleri uzlaştırılır; yeni erişim açılmadan önce hangi kullanıcıların yeniden giriş yapması gerektiği kararlaştırılır.
5. Önce yalıtılmış hedefte Auth ve erişim ayrımı, sonra dosya içerikleri ve pending/cleanup işleri, ardından uygulama akışı kabul edilir.
6. Üretime yönlendirme ancak bu kanıtlar ve güncel yayın sırası doğrulandıktan sonra yapılır. Bu belgenin varlığı yayın/kurtarma tamamlandı demek değildir.

Gerçek üretim yedek kapsamı, geri dönülebilir süre (RPO) ve toparlanma süresi (RTO) ölçülmedi; sayısal taahhüt verilmez. Eldeki kanıtlar sentetik, aynı yerel sunucuya ait ve README'de tekrarlanabilir komutlarla bağlıdır.
