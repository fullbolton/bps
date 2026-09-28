# M2m — Ana kayıt silinmesinde müşteri ve mizan geçmişini koruma

**Yerel; üretim SQL/push/deploy yok.** Temel commit: `2bb6c0db8e951c1bf75af8757ba4d4c51f95be56`.

## Bulgu ve değişiklik

Tablo yazma izinlerinin kaldırılması, foreign key üzerinden CASCADE veya SET NULL yapılmasını engellemez. Firma silinmesi contacts/notes kayıtlarını silebilir; profil silinmesi created_by/author_id alanlarını boşaltabilir; mizan yüklemesinin silinmesi bütün snapshot satırlarını silebilir. Bu dolaylı yollar modül kapalı olsa da etkiliydi.

002700 migration'ı beş ilişkiyi ON DELETE RESTRICT yapar:

| Çocuk / kolon | Ana kayıt | Önceki davranış |
|---|---|---|
| contacts.company_id | companies.id | CASCADE |
| contacts.created_by | profiles.id | SET NULL |
| notes.company_id | companies.id | CASCADE |
| notes.author_id | profiles.id | SET NULL |
| mizan_upload_rows.upload_id | mizan_uploads.id | CASCADE |

Bağlı kayıt varsa ana kaydın hard-delete işlemi reddedilir. Modül açık veya kapalı olması sonucu değiştirmez; geçmiş veriler kapalı dönemde de korunur. Firma pasifleştirme ve tenant üyeliği kaldırma çalışmaya devam eder; hiçbir geçmiş kaydın yazarını değiştirmez. Bağlantısız ana kayıt silinebilir. Kişi/not için yetkili kullanıcının mevcut açık silme komutu kaldırılmadı; bu migration dolaylı silme yollarını sınırlar.

Migration mevcut constraint adı, çocuk/ana tablo, kolon sırası, ON DELETE/UPDATE, MATCH SIMPLE, validation ve deferrability durumlarını kontrol eder. Beklenmeyen şemayı otomatik onarmaz. Ek bir CASCADE/SET NULL veya ON UPDATE mutasyonu varsa reddeder. Hata tüm değişiklikleri geri alır.

## Kontrol

Yeni sekiz PostgreSQL testi gerçek contacts/notes/mizan temel migration'larını ve yeni ilişki değişimini sentetik verilerle çalıştırır: beş constraint'in durumu; açık/kapalı modülde şirket silme; yazar profilinin korunması; mizan snapshot'ı; pasifleştirme/üyelik kaldırma; bağlantısız kayıt; şema sapmasında önceki DDL'in rollback'i; eşzamanlı çocuk ekleme ile bekleyen firma silme.

**131/131 PostgreSQL testi geçti. Statik denetim: 0 FAIL / 2 WARN** (commit öncesi yeni migration ve mevcut kullanılmayan CapacityRiskCard/TimelineList). Test envanteri başarılı.

Nihai sayılar `manifest.json`, DB ve statik çıktılar aynı dizindedir. Bu tur uygulama TS/TSX kodu değişmedi; 604 uygulama testi ve üretim derlemesinin önceki başarılı kanıtı `qa/tenant-module-notification-candidates-20260928/` içindedir, yeniden çalıştırılmış gibi sayılmaz. Commit hook tip kontrolü ayrıca çalışır. Dokuz modül DB suite'i birlikte çalıştırılır; beş eski DB suite'i ve yedi pending dosya bu kapsama dahil değildir. Canlı şema/katalog veya tarayıcı testi yapılmadı.

## Uygulama koşulu ve maliyet

002700, contacts/notes/mizan temel şemaları üzerinde bağımsız veri koruma adımıdır; önce gerçek constraint kataloğu beklenen beş tanımla karşılaştırılmalıdır. Yayın sırasında profiller, firmalar, yetkililer, notlar ve iki mizan tablosu ACCESS EXCLUSIVE kilitlenir: okuyucular ve yazarlar bekler. lock_timeout 15 saniye **her kilit beklemesi** için, statement_timeout 60 saniye **her statement** için geçerlidir; toplam transaction süresi garantisi değildir. Hata transaction'ı aborted duruma sokar; bağlantı ROLLBACK yapana/sonlanana kadar önce alınan kilitlerin kalabileceği hesaba katılmalıdır. Sakin zamanda kontrollü uygulanır.

Bu değişiklik, bağlı kaydı olan profilin fiziksel silinmesini de engeller. İleride fiziksel hesap/veri silme gerekiyorsa saklama/anonimleştirme süreci açıkça tasarlanmalıdır; üyelik kaldırma bu işlem değildir. Geçmişi topluca temizlemek için gizli bypass veya otomatik cascade eklenmedi.

## Kalanlar

Bu beş foreign key dışındaki bütün parent yollarının kapandığı iddia edilmez. Özellikle financial_summaries temel tablo tanımı repo migration'larında CREATE TABLE olarak bulunamadı; canlı katalog ölçümü olmadan varsayımsal constraint değişikliği yazılmadı. Mizan matched_company_id ve uploaded_by temel tanımda NO ACTION olduğundan zaten parent silmesini engeller; değiştirilmedi. Tenant üst ilişkileri, şirketin diğer çocukları, evrak/sözleşme/operasyon ilişkileri ayrı incelenmelidir. Owner/superuser doğrudan çocuk DELETE veya TRUNCATE CASCADE yetkileri bu migration'ın güvenlik sınırı değildir.

Genel modül kapatma UI'si hâlâ açılmadı. Açık iş/bağımlılık engelleri, diğer modül erişimleri, kalan definer/FK yolları, ayar mutasyonu ve gezinme/cache yenileme açık. Önceki frontend/worker sonrası direct-write/read cutover sıraları değişmedi; SQL'ler kör toplu uygulanmaz.
