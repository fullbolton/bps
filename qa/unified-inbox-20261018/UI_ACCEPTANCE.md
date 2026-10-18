# Ortak bildirim kutusu — yerel uygulama kabulü

18 Ekim 2026. Aşağıdaki ilk kabul kaydı tarihsel yerel kanıttır. Paket daha sonra a0230dd / 190 migration ile yayımlandı; güncel yayın kanıtı release.json, sonraki kabul ayrıntıları RELEASE_PREPARATION.md içindedir.

## Tamamlananlar

- Tek ConversationInbox paneli legacy ve unified veri sözleşmesini gösterir; ikinci kopya panel yok.
- NEXT_PUBLIC_BPS_WORKSPACE_INBOX_ENABLED=true ortak RPC'leri açar. Varsayılan kapalıdır; eski conversation flag ve eski uçlar korunur. Sunucu da yeni flag'i doğrular.
- Her ortak okuma/okundu çağrısı istemcinin beklediği aktör+şirketi sunucu auth ve doğrulanmış tenant ile karşılaştırır. Hata, bozuk cevap, null/string boolean başarı sayılmaz; SQL ayrıntıları kullanıcıya sızmaz.
- Tip+UUID kimliği sayfalama/React key/okundu/seste ortak. İlk başarılı yükleme sessiz, eski sayfada otomatik yenileme durur. Kaynak erişimleri SQL tarafından korunur.
- Görev mevcut /gorevler?gorev=UUID TaskLinkOpener üzerinden açılır. İlk planın URL hedefi yok tespiti yanlıştı; yeni hedef yazılmadı.
- Duyuru kısa önizleme ve tam metin açılımı ile kutuda okunur. Dashboard'un ilk üç kaydına bağlı değildir. Ayrı detay sayfası eklenmedi.
- Hesabım ses kontrolü unified kapsamına uyarlanır; legacy durumda yönetici/operasyon sınırı korunur.

## Ölçülen kabul

- 780/780 uygulama testi, 19/19 hedefli action/parser/account testi.
- TypeScript temiz; Next production build başarılı; statik tarama 0 FAIL / 1 mevcut WARN (CapacityRiskCard, TimelineList).
- Envanter 139 application, 27 database, 7 önceki pending dosyası. Pending testler bu pakette kapandı iddiası yok.
- Gerçek yerel Storage HTTP harness, izole PostgreSQL/Auth/PostgREST ile açıldı; dört aday yalnız bu veritabanına uygulandı. Gerçek komutlardan 31 duyuru + 1 görev üretildi. Üretim verisine dokunulmadı.
- Tarayıcıda kutu 32 okunmamış gösterdi. Duyuru tam metni açıldı. Okundu sonrası 31 oldu.
- İlk sayfa 30, sonraki sayfayla 32 satır; başka sayfa düğmesi kalktı; en yeniye dönüş çalıştı.
- Görev bağlantısı doğru sentetik görevin detay panelini açtı; görevin açık durumu değişmedi.
- 390×844 görünümde görev/duyuru, tam metin ve okundu kontrolleri görünür ve kullanılabilir: mobile.png.
- Sentetik sekme kapatıldı, viewport sıfırlandı, yerel harness SIGTERM ile temiz kapatıldı.

## Çalıştırma

BPS_LOCAL_BROWSER=1 BPS_BROWSER_MODULES=1 BPS_BROWSER_INBOX=1 NEXT_PUBLIC_BPS_MODULE_CHANGES_ENABLED=true NEXT_PUBLIC_BPS_CONVERSATION_ENABLED=true NEXT_PUBLIC_BPS_WORKSPACE_INBOX_ENABLED=true node qa/contract-write-20261015/storage-http.mjs

Hazır olduğunda yalnız harness'in bps_storage_http_<PID> veritabanına:
NODE_PATH=/tmp/bps-module-release-runtime/node_modules node qa/unified-inbox-20261018/browser-seed.mjs bps_storage_http_<PID>

browser-seed yalnız bu yerel ad desenini kabul eder; 33 sentetik kayıt oluşturur, tekrar çalıştırmak daha fazla kayıt üretir.

## İlk kabul anında kalanlar (tarihsel)

Dört QA SQL adayının tarihli migration paketine alınması; güncel üretim katalog/ledger doğrulaması ve tam sıra provası. Büyük alıcı sayısında sorgu/trigger maliyet ölçümü; üyelik/modül değişikliğiyle eşzamanlı okundu yarışlarının tamamlanması. Üç kaynaklı tarayıcı testi, rol/şirket değişimi ve yeni UI ile sekmeler arası ses kabulü ayrıca yapılmalı. Mevcut parser/DB/ses testleri bunların tümünü tarayıcıda doğruladığımız anlamına gelmez.

Son üretim kaydı 6cd6007 / 186 migration; bu tur üretim yeniden sorgulanmadı. Yeni flag üretimde açılmadı. Otomatik e-posta veya push eklenmedi.


## Yayın sonrası rol kabulü

`role-matrix.tap`: 10 alt senaryo + üst test = 11/11 gerçek yerel PostgreSQL testi. Önceki yönetici/operasyon/İK/muhasebe kontrollerine ek olarak:

- Görüntüleyici yalnız 12 duyuru görür; duyuruyu okundu yapabilir, gizli görev/talep bildirimini okundu yapamaz.
- Partner rolüne geçince eski üyelik sürümlü token reddedilir; yeni seçim/üyelik sürümüyle de ortak kutu ve duyuru okundu çağrısı reddedilir.
- Konuşma yetki reddi eski API'de P0001/COMM_FORBIDDEN; görev reddi 42501. İlk test yanlış biçimde ikisinde de 42501 bekledi, test gerçek sözleşmeye düzeltildi; ürün yetkileri değiştirilmedi.
- `workspace-inbox-actions.test.mjs` 7/7: gerçek ConversationInbox dış bileşeni beş izinli rolü açar; partner/bilinmeyen/yükleniyor/bağlamsız durumda görünmez. Rol ve şirket değişimi alt bileşen anahtarını değiştirir, eski liste yaşam döngüsü yeniden kullanılamaz.

Son madde enjekte edilmiş bağımlılıklarla bileşen kontrolüdür; DOM/tarayıcı kabulü değildir. Her rolün ayrı tarayıcı kabulü ve fiziksel ses ölçümü hâlâ yapılmış sayılmaz. Bu tur üretim verisi, SQL veya uygulama yayını değiştirilmedi.
