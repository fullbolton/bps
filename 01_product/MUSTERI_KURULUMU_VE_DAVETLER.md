# Müşteri kurulumu ve davet yaşam döngüsü


## 02400 — davetle yeni hesap ve güvenli başlangıç

`/kayit`: kod+e-posta eşleşmesi, geçerlilik ve davet eden yetkisi doğrulanır; Auth `signUp` çağrılır. Giriş yapılmış oturum değiştirilmez. Auth e-posta doğrulaması açıksa doğrulama beklenir; aynı tarayıcıda PKCE `/auth/callback` dönüşü `/davet` ekranına götürür. Davet kodu URL'ye/metadata'ya koyulmaz; alıcı kabulde yeniden yapıştırır. Doğrulama zorunlu değilse Auth'un döndürdüğü oturumla kabul ekranına geçilir. Doğrulama mesajı hesap varlığını ifşa etmeyen koşullu metindir. Mevcut Auth signup/SMTP/CAPTCHA/rate-limit ayarları değiştirilmedi. Uygulamadaki kayıt ekranının davet kontrolü, Auth sağlayıcısının doğrudan signup API'sinin davete kapatıldığı iddiası değildir; davetsiz Auth hesabının tenant üyeliği yoktur.

Güvenlik düzeltmesi: eski `handle_new_user` kayıt metadata'sından rol seçiyordu. Yeni hesap daima görüntüleyici/non-admin, unitNULL ve üyeliksiz başlar; rol/admin/unit metadata'sı kabul edilmez. Mevcut profiller değiştirilmez. `prepare_invited_profile` doğrulanmış Auth e-postası + geçerli davet ile eksik eski profili güvenli varsayılanlarla onarır; mevcut role dokunmaz. Böylece minimal local fixture veya legacy eksik profil kabulü bozamaz. Asıl üyelik/rol ataması yine02300 atomik kabulüdür.

Kanıt:18nativeSQL (13davet regresyonu+5yeni kayıt/trigger/anon/kimlik kontrolü); gerçek yerel Auth signup'ta rol/admin metadata enjeksiyonu görüntüleyici/non-admin kaldı; profil hazırlama+kabul+tekrar ve özel liste sınırı geçti. Yerel API testi geçici Auth trigger'ını kurup kaldırdı, geçici kullanıcı/daveti temizledi; normal fixture eski API testleriyle uyumlu bırakıldı. Genel/type/build6/6,127operasyonunit,static223dosya0FAIL/2öncekiWARN. Rapor `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-TXpa14/report.md`. Runner22 adım; full22 bu tur çalıştırılmadı.

Browser: kayıt alanları ve mevcut oturumun korunması ölçüldü. **Yerel Auth email confirmations=false**: gerçek posta kutusu→PKCE bağlantısı→yeniden giriş/hook akışı ölçülmedi. Native doğrulanmamış hesap reddi ayrı ölçümdür, mail akışının yerine geçmez. Gerçek kişiye posta gönderilmedi. Prod signup/SMTP/redirect allowlist, aktif profile trigger ve token hook doğrulaması canlı geçiş kapısıdır; 02400 yalnız yerelde uygulandı. Eski raw-claim policy penceresi aynen sürer.

Sıradaki geliştirme: Dashboard eski staffing_demands/workforce_summary göstergelerini yeni günlük operasyonla birleştirme. E-posta/PKCE/hook uçtan uca kabulü açık kapı olarak korunur. Önceki 02300 “yeni hesap yok” notları tarihseldir.


## 02300 — mevcut hesaplara davet, yerel teslim

`/kurulum` üzerinde oluştur/listele/iptal ve `/davet` üzerinde kabul tamamlandı. 7 günlük, 256 bit rastgele kod; DB'de yalnız SHA-256 hash. Kimlik: `auth.users` e-postası, doğrulama ve ban kontrolü. Profil kilitleri sıralı, davet satırı sonra; üyelik/rol/kabul atomik. Oluşturanın yönetici üyeliği kabul anında tekrar kontrol edilir. Kod ve hash listede dönmez; son50 davet. UI yaratma yanıtı belirsizse aynı komutla tekrar dener. Bekleyen kod yalnız sayfa belleğindedir; reload/kayıp sonrası listeden iptal + yeni davet gerekir.

İlk sınır: mevcut BPS/Auth hesabı ve üyeliksiz, platform admin olmayan, görüntüleyici profili. Mevcut üyelik (aynı tenant dahil) veya daha yüksek profil rolü sessizce değiştirilmez. Partner/yönetici rolü davetle verilmez. Hesap oluşturma ve e-posta gönderme **henüz yok**; kod elle paylaşılır, bu geliştirmede kimseye e-posta gönderilmedi. Kod alıcının mevcut hesabıyla `/davet` ekranına yapıştırılır; URL/query/history içine token yerleştirilmez.

Üyeliksiz olup eski tenant claim'i taşıyan oturum kabul edilemez; önce yeniden giriş gerekir. Başarılı kabul `auth.sessions` kayıtlarını admin üyelik atamasıyla aynı sınırda siler; yeni giriş token hook'undan güncel üyelik alır. Mevcut access token'ların anlık iptal edildiği iddia edilmez (43 eski raw-claim policy değişmedi). Tekrar kabul aynı makbuzu döndürür ve kaldırılmış üyeliği yeniden yaratmaz. Kullanıcıya “kabul edildi, yeniden giriş yapın” ayrı durum olarak gösterilir. İlk kuruluma kadar token hook/prod Auth entegrasyonu ayrıca ölçülmeli; yerel fixture prod hook'u değildir.

Önceki Dashboard ve kurulum ekranlarındaki `app_metadata.active_tenant` varsayımı kaldırıldı. `useVerifiedTenant` hook'u sunucudaki üyelik doğrulamasını okur, hesap değişiminde sonucu temizler, yenilemede tekrar doğrular. Hatalı/eksik yanıt sıfır veri sayılmaz.

Kanıt: 13 native PostgreSQL kontrolü (paralel kabul, kabul/iptal yarışı, eski claim, tek üyelik, oturum silme dahil); gerçek sentetik Supabase Auth/RPC kabul-tekrar-listeleme ve yetki sınırı; 127 operasyon unit; genel/type/build6/6. Static221 dosya0FAIL/2öncekiWARN. Rapor `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-p0MVgJ/report.md`. İlk type kontrolündeki PromiseLike.catch sorunu düzeltildi; son build geçti. Runner21 adım oldu; full21 bu tur çalıştırılmadı.

Browser: yönetici davet oluşturdu, bekliyor→iptal görüldü ve kod alandan kaldırıldı; `/davet` eksik kod kontrolü geçti. Başarılı kabul API'de ölçüldü; alıcı hesabıyla tam browser yeniden giriş/hook akışı henüz ölçülmedi. Testte oluşturulan Auth hesapları ve API daveti temizlendi; tarayıcıdaki sentetik iptal daveti defterde tutuldu. 02300 yalnız yerel. Prod/push/deploy yok.

Sıradaki: yeni hesap için gerçek Auth davet/ilk giriş tasarımı ve yerel uçtan uca kabul (gerçek alıcıya gönderim olmadan). Ardından eski/yeni operasyon Dashboard kaynaklarının birleşmesi. Aşağıdaki ilk tasarım/02200 durum kaydı tarihseldir; bu üst kayıt günceldir.

2026-09-09 · P10 uygulama planı. Öncelik kaynağı: DASHBOARD_VE_SAAS_SIRASI.md.

## Envanter ve ilk teslim

`/admin`: platform admin tarafından tenant oluşturma ve mevcut hesabın rol/tenant ataması var. Normal tenant yöneticisi platform admin değildir. `/ayarlar` aktif tenant kullanıcılarını gösteriyor. Login erişim başvurusu davet değildir. Otomatik davet gönderme/kabul/iptal bulunamadı.

02200 ilk teslimi: yöneticiye özel `/kurulum`; gerçek mevcut kayıtlardan firma, aktif firmaya bağlı aktif lokasyon, kullanıcı, aktif personel, bugünden ileri aktif talep ve yerleştirme sayıları. Tenant üyeliği ve yönetici rolü RPC içinde doğrulanır. Mevcut kayıt bulunması, doğruluk/pilot kabulü veya kurulumun tamamlanması sayılmaz. Birbirinden bağımsız toplamlar aynı firmanın kurulmuş olduğunu kanıtlamaz; yüzde/“tamamlandı” rozeti kullanılmaz. Talep/yerleştirme bugünü İstanbul takvimine göre belirler. Yerel operasyon özelliği kapalıysa kurulum bu adımların bağlantılarını açmaz.

Akış: çalışma alanını doğrula → firmayı ekle → şubeleri toplu aktar → ekip erişimini gözden geçir → personeli tanımla → ilk günlük planı oluştur → haftalık çıktıyı kontrol et. Gerçek veri yazma mevcut ekranların yetki ve doğrulamalarından geçer. Kurulum ekranı yeni tenant veya örnek veri oluşturmaz, geçmişi sıfırlamaz.

## Sıradaki teslim: davet

1. Private davet tablosu: tenant, normalize hedef e-posta, izinli rol, oluşturan, süre sonu, iptal/kabul zamanları, kabul eden, komut kimliği. Ham token saklanmaz; güçlü rastgele token hash'i. Tek kullanımlık ve idempotent komut. Listeleme token/hash döndürmez.
2. Yönetici yalnız doğrulanmış kendi tenant'ına davet açar/iptal eder. İlk davet rolü operasyon/İK/muhasebe/görüntüleyici ile sınırlanır. Partner portföy bağları ve yeni yönetici yetkisi ayrı karardır; platform admin bayrağı davetle verilemez.
3. Kabul için gerçek Auth oturumu ve doğrulanmış e-postanın eşleşmesi zorunlu. E-posta profile/client beyanından alınmaz. Süresi dolmuş, iptal edilmiş veya başka hesapça kabul edilmiş davet reddedilir.
4. Profil satırı kilidi mevcut üyelik yazıcılarıyla aynı sırada alınır. Başka tenant üyeliği varsa taşınmaz; mevcut admin devir/aktif iş korumasına yönlendirilir. Aynı tenant üyesinin rolü sessizce yükseltilmez. Kabul ve üyelik atomik; tekrarlı kabul yeni üyelik doğurmaz.
5. Üyelik değişince access-token tenant claim'i yenilenmeli; refresh başarısızlığı kabulün başarısız olduğu şeklinde sunulmamalı. Kabul makbuzu yeniden okunabilir olmalı.
6. E-posta gönderimi ayrı teslim/sunum sınırı: kullanıcı açıkça gönder dediğinde, izinli alıcıya; token/log/URL gizliliği ve origin kontrolü. Bu ilk teslim dışarıya e-posta göndermez. Token-only bağlantı elde etmek üyelik yetkisi değildir.
7. Gerçek Supabase Auth şeması, token hook'u ve üyelik tetikleyicileri yerel kabulde doğrulanmadan prod'a uygulanmaz. Auth kullanıcısı/şifreyi SQL ile elle üretme yok; mevcut kayıt/giriş akışı incelenerek kabul ekranına bağlanır.

## Kabul kapıları

Kurulum: boş alan, yalnız pasif firma/lokasyon, farklı tenant, üyeliği olmayan/eski claim, yanlış actor/rol, İstanbul gün sınırı, iptal/geçmiş talep ve kaldırılmış atama; transport/şema hatası asla sıfır sayılmaz. Read-only RPC'nin ham özel tabloları açmadığı doğrulanır.
Davet: iki paralel kabul, kabul/iptal yarışı, son kullanma sınırı, yanlış e-posta, eksik e-posta doğrulaması, başka tenant üyeliği, yanıt kaybından tekrar, rol/üyelik iptali, yetkisiz listeleme; ayrı Auth/API/browser kabulü.

## Durum

02200 kurulum ekranı yerelde tamamlandı. 10 native PostgreSQL kontrolü, gerçek Auth/RPC yetki kontrolleri, 125 operasyon unit testi ve genel/type/build kabulü 6/6 geçti. Static 217 dosya, 0 FAIL/2 önceki WARN. Rapor: `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-OJ0x5Y/report.md`. Runner artık 20 adımlık; tüm20 bu tur çalıştırılmadı. Yerel fixture eksik tenants.name alanı yalnız guarded sentetik fixture ile tamamlandı; prod şeması değiştirilmedi. Tarayıcıda Dashboard→kurulum ve mevcut sayaçlar doğrulandı. Davet tasarımı hazır; davet migration/kod/gönderimi henüz uygulanmadı. Prod/push/deploy yok.
