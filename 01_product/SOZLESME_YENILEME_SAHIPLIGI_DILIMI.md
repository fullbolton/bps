# Sözleşme yenileme işinin gerçek sahibi — P08 yerel teslim

## 2026-09-09 — 01700 yerel teslim tamamlandı

Sözleşmeye tek ve açık yenileme ilişkisi + kalıcı creation receipt eklendi. Gerçek
owner/tarih/status mevcut tasks kaydından okunur; eski renewal_responsible_set ve
renewal_task_created boole'ları UI ve servis yazısından kaldırıldı, veri silinmedi.
Görüşme beyanı ayrı; responsible eski metni artık “Sözleşme sorumlu notu” etiketli.
Yönetici formunda aktif görev erişimli üye, takvim tarihi ve 1–2000 Unicode karakter
operasyon dayanağı gerekir. Yönetici/operasyon scoped okur; yaratma yöneticiye ait.
Mevcut kaldırılmış partner rolüne yeni izin verilmedi.

01700 contracts.revision DB trigger'ıyla her INSERT/UPDATE'de yönetilir; istemci
sayacı değiştiremez. Önizleme sonrası sözleşme yazısı yeni yaratmayı reddeder.
Actor/hedef profile SHARE sıralı → canlı scope/rol → company SHARE → contract
FOR UPDATE; yalnız READ COMMITTED. Aynı sözleşmede farklı komut çift göreve dönüşmez;
aynı komut+payload tarihsel task kimliğini tekrar verir, devir/kapanma/pasiflikten
sonra da yaratma sonucu değişmez. 01600 aktif üyelik/rol koruması aynen işler.
Görev/task history/link aynı transaction; geç link hatası hepsini geri alır.

Bağlı task/contract hard-delete RESTRICT/context guard ile engellenir; bağlı
sözleşmenin tenant/firma/kimliği ve task'ın contract_id'si değiştirilemez. Bu
kapsamda arşiv/yeni dönem açma yok. Görev kapanınca sözleşme statüsü değişmez.
Pasif firma yeni görev açamaz. Legacy flags geriye dönük görev üretmez. Manuel
başka bir sözleşme görevi açık renewal ilişkisi yoksa yenileme sayılmaz.

Kanıtlar:5 yeni unit (toplam101),18 native PostgreSQL kontrolü,7 gerçek yerel Auth/API.
Native: gerçek blocking PID ile aynı/farklı komut yarışı, contract edit yarışı,
admin üyelik taşıma yarışı; eski revision/actor/tenant/passive/assignee reddi,
late rollback, tekrar, devir ve ayrılış kapısı. API: başarılı cevabı düşüren fetch
ile aynı komut tekrarı →1task. Full paket15/15 exit0:
/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-1e7oOB/report.md.

Tarayıcı: sentetik contract ...0400; gerçek formda seçili 01.10.2026 önerisi,
sorumlu+dayanak girildi, çift tıklama→1task. Mevcut toplu devir→1iş/kaynakta0;
sözleşme kartı “Yenileme kabul yeni sorumlu” gösterdi. SQL sayı/sürüm/benzersiz
kimlik=1/1/1. Native tarih değiştirme bu turda denenmedi; önerilen tarih kullanıldı.

Sınırlar:17 migration yalnız dedicated synthetic ortamda. Tam prod şeması/owner
ve gerçek Storage/PDF kabulü yok. İlk migration ACCESS EXCLUSIVE contracts/tasks
okuma-yazmayı bloke eder; lock_timeout15s beklemeyi sınırlar, toplam işlem süresi
SLA'sı değildir. Retry komutu açık panel belleğinde; reload sonrası görev okunur,
yeni komutla mevcut görevin üstüne yazılmaz. UI listesi canlı push değildir;
Güncelle/yeniden açma son committed sahibi okur. Varsayılan cron/mail değiştirilmedi.
Üretim migration/temizlik/yedek/push/deploy yok.

Sıradaki: SOZLESME_BELGE_SURUMLERI_DILIMI.md. Aşağıdaki ilk taslak tarihsel plandır.


2026-09-09. Önce bu sözleşmeyi mevcut kodla uzlaştır, sonra uygula. 01500 toplu
görev devri ve01600 aktif iş/üyelik koruması dedicated yerelde tamamlandı. Üretime
migration/temizlik/push/deploy yok; testler sentetik ve yedek aktarımı yapılmaz.

## Koddan ölçülen başlangıç

`sozlesmeler/[id]/page.tsx` handleRenewalToggle, renewalDiscussionOpened /
renewalResponsibleSet / renewalTaskCreated boole'larını updateContractRenewal'a
ayrı alan olarak gönderiyor. “Sorumlu kişi atandı” ve “İlgili görev üretildi”
kutuları gerçek kullanıcı/görev bulunmadan true olabiliyor. `responsible` metin;
kullanıcı kimliği değil. `renewal_target_date` ve end_date ayrı mevcut alanlar.
`tasks.contract_id` gerçek ilişki, listTasksByContractId mevcut okuma. Yeni görev
motoru kurma. Eski flags true ise gerçek iş üretildi diye geriye dönük doldurma.

documents.contract_id bağlantısı ve çerçeve sözleşme/ek protokol kategorileri
zaten var. PDF replace yolu mevcut documents satırını yerinde güncelliyor;
eski dosyayı koruyan belge sürümü ilişkisi daha sonraki P08 dilimi. Önce sahiplik.
Dedicated test şemasında contracts/documents yok; task contract_id NULL CHECK'i
vardı. Gerekli gerçek alan/constraint'leri kapsayan açık sentetik fixture kurulmalı,
NULL kısıtı kontrollü kaldırılmalı ve contract FK eklenmeli. Tam prod şeması sayılmaz.

## Dar ilk teslim

Sözleşme detayında mevcut yenileme işi + sorumlusu + tarihi gösterilsin. Yönetici,
yoksa açık bir formdan sorumlu ve takip tarihi seçip mevcut tasks modelinde bağlı
iş oluştursun. Görüşme açıldı beyanı ayrı kalabilir; sorumlu/görev var sinyalleri artık
kullanıcı kutusundan değil doğrulanmış bağlı yenileme işinden türesin. Her sözleşme
görevi otomatik “yenileme” sayılmasın: açık ilişki/amaç kaydı gerekiyor. Görev devri
sonrası sorumlu aynı task'tan okunmalı; ikinci sorumlu alanı senkronize edilmeye çalışılmasın.

Tarih kullanıcı tarafından doğrulanan operasyon takip tarihidir. end_date veya
renewal_target_date öneri olabilir; fesih/ihbar hukuki son tarihi olduğu iddia edilmez.
Dayanak açıklaması veya ilişkili belge kaydı açıkça seçilir; yalnız belge bağlantısı
metnin hukukça doğrulandığı anlamına gelmez. Başlık/isim URL'den otorite alınmaz.

İlk sürümde mevcut yenileme işi varsa onu göster; yeni görev yaratıp üstünü örtme.
Yeni dönem açma/önceki işi arşivleme ayrı açık eylem olmadan otomatik yapılmaz.
Görevin tamamlanması sözleşmeyi yenilenmiş/aktif saymaz; sözleşme lifecycle değişmez.
Pasif firma yeni takip işi oluşturamaz; mevcut işi görme/devir/kapama korunur.

## Teknik ve kabul sırası

1. Güncel contract/document/task servisleri, rol kapıları ve cron mail tetiklerini oku.
   Mevcut renewal flag yazıcılarının hepsini rg ile bul; scope/örnek kayıtlarla sınırlı
   sanma. E-posta tarafına yeni otomatik gönderim ekleme.
2. Actor/verified tenant/canlı rol, company ve contract ilişkisini DB'de doğrulayan
   dar transaction. Sorumlu aktif üye + görev erişimli rol; 01600 trigger kullanılır.
   Tek yenileme ilişkisinin yarış kontrolü, receipt ile kayıp cevap tekrarı; başarısız
   task INSERT ilişkiyi de rollback etmeli. Kaynak sözleşme değiştiyse eski önizlemeyi
   reddetmek için revision/aynı transaction koşulunu kararlaştır; updated_at'ın tüm
   yazıcılarca gerçekten ilerlediğini ölçmeden CAS kabul etme.
3. Mevcut NewTaskModal veya dar bağlam formu; gerekli alanlar, tarih native picker,
   boş/başarısız/unknown okumayı ayır. Kullanıcıya boolean “sorumlu var” beyanı yerine
   gerçek kişi/ad görünümü. Ayrılmış isim varsa uydurma ad kullanma; geçmiş korunsun.
4. Unit sınırları, disposable native PostgreSQL yarış/rollback/privilege,
   gerçek dedicated Auth/API, sonra sentetik tarayıcı create→görev→devir→yeni sorumlu.
   01600 ile ayrılma kontrolünün yenileme task'ını da gördüğünü test et.
5. Repo/Vault kanıtlarını güncelle, mevcut kabul paketine gerekli testi ekle;
   sonrasında belge sürümü/ek protokol ve evrak yenileme aşamasını planla.

Sınırlar: mevcut43 raw-claim policy yeniden yazılmadı. Eski sözleşme/partner yetki
modeli genişletilmez. Görüntüleyici/muhasebe yeni aktif görev hedefi olamaz. Tam
kullanıcı hesabı kapatma ve oturum yönetimi P10;01600 yalnız üyelik/rol değişiminde
aktif işi korur. Yeni özelliği üretimde varmış gibi dokümante etme.


Son arayüz entegrasyonundan sonra hızlı paket+izole build6/6 exit0:
/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-LLpYVT/report.md.
Bu ek yalnız onCreated bağlı liste yenilemesi, tip/etiket ve kart semantiği sonrası
kontroldür; SQL değişmedi. Statik198 kaynak,0FAIL/2mevcutWARN. git diff --check temiz.
