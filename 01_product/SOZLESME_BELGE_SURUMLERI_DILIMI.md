# Sözleşme belge sürümleri — P08 ilk yerel teslim

## 2026-09-09 — ilk sürüm geçmişi dilimi yerelde tamamlandı

01800 contract_document_versions özel ledger'ı, mevcut PDF referansının metadata
baseline'ı ve sonraki değişimlerin sürüm kaydı eklendi. Güncel documents kimliği
korunur; her storage_path değişikliği eski referansı geçmişte tutar. Dosya adı,
actor kimliği/DB display_name, tarih ve baseline/upload ayrımı kaydedilir. Yeni
obje Storage owner_id ile gerçek actor'a bağlanır. Byte/hash taraması baseline
üzerinde yapılmadı; “önceki kayıt” yükleyeni tarihsel etikettir, doğrulanmış actor
olarak gösterilmez. Kalıcı doğrulanmış checksum henüz yok.

Tüm document yazılarında DB revision ilerler; PDF replace servisi gösterilen
revision ile CAS yapar. İkinci eski yazı sıfır satır→hata, sürüm üretmez. Metadata
validity/status değişimi yeni dosya sürümü üretmez. Contract/document bağlamı
sürüm kaydı varken taşınamaz; dosya yolu NULL yapılamaz/eski dosya yeniden bağlanamaz.
Path unique indeksi aynı objenin iki concurrent sürüm kaydına girmesini engeller.
Belge/contract FK ve trigger hard-delete'i engeller; ilişkili ekranda anlaşılır hata.

Yeni sürüm oluşturma manager + canlı verified tenant + aktif/aday company;
profile SHARE ve company/contract/object SHARE altında tekrar doğrulanır. READ
COMMITTED gerekli. Dosyanın gerçek Storage metadata kaydı ve actor sahipliği
aranır. Blob ve metadata iki ayrı sistemdir: başarısız CAS sonrasında yüklenen
kullanılmayan dosya kalabilir. 01800 upload receipt veya otomatik temizleme değildir.

Storage mevcut izinlerine ek restrictive DELETE/UPDATE koruması retained path'i
sildirmez/ezdirmez. object_id FK Storage metadata silmeyi engeller. Retained object
SELECT de canlı üyelikle daralır; eski Storage/documents okuyucu rolleri manager/op/IK
korunur. Sözleşme geçmişi/path RPC'si contract sayfası yetkisi manager/op'a açıktır.
43 eski policy gövdesi yeniden yazılmadı; yeni restrictive Storage politikaları
bu dilimin dosyalarını korur. Yeni izin verilmedi.

UI: PDF okuma hatası “PDF yüklenmemiş” sayılmaz; okuma tamamlanmadan yükleme açılmaz.
Sürüm listesi son50 (+51 ilehasMore), güncel işareti ve60sn signed eski dosya linki.
Bekleyen file handler ref ile korunur; değişim CAS. Tarayıcı eski ve yeni sentetik
sürüm listesini, Güncel işaretini ve eski sürüm linkini gösterdi;673px görsel kontrol.
Native file chooser ile yükleme/değiştirme bu turda ölçülmedi. Yükleme/replace ve
byte indirmeleri gerçek Auth/Storage API ile ölçüldü; browser kabulünü abartma.

Kanıt:4yeni unit,105toplam;18native PDF,10gerçek yerel Storage/Auth kontrolü.
Native: baseline/actor, CAS ve gerçek blockingPID yarışı, metadata-only update,
context/deletion guard, privateledger, op/IK/foreign/passive/staleclaim, object
sahibi, late rollback. Gerçek API: iki farklı sentetik PDF signed download byte
karşılaştırması, staledocCAS, delete/upsert koruması, opread, forgedtenant.
Ek kritik API yarışı: psql publish transaction objeyi SHARE kilitlerken gerçek
Storage remove isteği blockingPID ile beklendi; COMMIT sonrası PDF bytes hâlâ aynı.
Sonfull16/16 exit0:
/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-kbOvzq/report.md.
Loglar /private/tmp/bps-pdf-final-full.log ve /private/tmp/bps-pdf-api-final.log.
Static202file,0FAIL/2mevcutWARN, tsc/build passed, diffcheck temiz.

Yerel Storage önceden exclude edildiği için ilk API denemesi DNS hatasıydı; hiçbir
dosya kabulü o hatayla tamamlandı sayılmadı. Mevcut DB durmadan/resetlenmeden yalnız
supabase_storage_bps-supabase-acceptance eklendi. Imagev1.35.3, iç Docker network,
host port yok; bps_document_storage_acceptance volume. start-local-document-storage
scripti marker/loopback/container kontrolü, private geçici env ve secret-suppressed
çıktı kullanır. APIgerçek bucket private/applicationPDF/10MB. Doküman/Storage fixture
bounded local şemadır; produn tüm tarihsel policy/owner kombinasyonu değildir.

18migration yalnız dedicated synthetic ortamda. Üretim migration/temizlik/yedek
aktarımı/push/deploy yok. Migration documents ACCESS EXCLUSIVE ve DDL/Storage FK
kilitleri alır;15s bekleme timeout'u tüm süre SLA'sı değildir. Restore/yedek veya
service_role/dosya sistemi operatörü müdahalesine karşı koruma ürünü değildir.

Sıradaki SOZLESME_PDF_YUKLEME_DEVAMLILIGI_DILIMI.md: ilk upload ve replace'i kalıcı
komut/intent/finalize/reconcile ile birleştir. Server PDF/hash kontrolü,10MB body
limit ve native chooser kabulü açık. Sonra ana PDF/çoklu ek protokol ayrımı;
documents_contract_active_unique ve maybeSingle mevcutta aynen korunmuştur.
Aşağıdaki ilk planın tüm maddeleri bu dilimle tamamlanmış sayılmaz.


2026-09-09. 01700 yenileme sahipliği dedicated yerelde tamamlandı. Bu dosya sonraki
uygulama planıdır; aşağıdaki belge davranışları henüz kodlanmadı.

## Ölçülen başlangıç

- documents.contract_id FK ve cerceve_sozlesme/ek_protokol kategorileri var.
- 20260425000200 documents_contract_active_unique indeksi tüm NULL olmayan
  contract_id değerlerini tekilleştiriyor: yalnız kategori eklemek bir sözleşmeye
  ikinci ek protokolü bağlamaya yetmez. getActiveContractDocument .maybeSingle()
  kullanıyor; indeks gevşetilirse okuyucu da aynı teslimde değişmeli.
- Detay sayfası ilk PDF'i server action ile, değiştirmeyi tarayıcı storage upload
  ardından updateContractDocumentFile ile yapıyor. Sonuncusu aynı documents
  satırının storage_path'ini değiştiriyor; eski blob silinmiyor ama sürüm listesi yok.
- Storage ve Postgres tek transaction değildir. Metadata başarısızsa yüklenmiş
  blob olabilir; başarılı yüklemeyi veritabanı rollback'i geri almış sayma.
- Dedicated fixture contracts/tasks içeriyor; documents/storage tam akışı henüz
  kabul ortamına eklenmedi. “PDF yüklenmemiş” görünümü documents read hatasını da
  gizleyebiliyor; yeni dilimde boş ve erişilemeyen durum ayrılacak.

## İlk teslim sırası

1. Güncel documents RLS, storage policy, server upload/download/delete yolları,
   contract link guard'ları ve tenant sütunlarını koddan uzlaştır. Tarihsel partner
   açıklamalarını güncel yetki gibi kullanma. Dar ilk kapsam yönetici yükleme,
   mevcut yetkili okuyuculara scoped indirme; yetki genişletme yok.
2. Önce ana PDF için sürüm geçmişi: mevcut documents kimliğini koruyup ek, değişmez
   version ilişkisi önerisini şemayla karşılaştır. Eski path'i geçmiş olarak sakla;
   byte'ları okunmamış belgeye SHA doğrulaması yapıldı deme. Yeni dosyanın gerçek
   sunucu hesabı ve içerik hash'i metadata'ya bağlansın. Mevcut blob'ları bu turda
   dışarı aktarma/yedekleme veya silme yok.
3. Upload intent/komut ile actor+verified tenant+contract+document+expected revision
   doğrulansın. Aynı komut tekrarında aynı sonuç; aynı sürümü baz alan iki replace
   yarışında tek kazanan. Storage path sunucuda oluşturulsun, başka firmanın
   dosyası ilişkilendirilemesin. Yükleme ve finalize arasındaki üyelik/firma
   pasifliği değişimi tekrar doğrulansın. Gerçek yüklenmiş obje kontrolü olmadan
   yalnız istemciden path kabul edilmesin. Kayıp cevapta güvenli sorgu/tekrar olsun.
4. UI mevcut PDF, sürüm tarihi/yükleyen ve eski sürümü indirme ayrımını göstersin.
   İndirme, görünür sürüm kaydından kısa ömürlü signed URL üretsin; path/URL kalıcı
   erişim yetkisi sayılmasın. Sürüm geçmişi olan belgeyi sessiz hard-delete yapma.
5. Minimal açık synthetic documents/storage fixture ve küçük sentetik PDF üret.
   Native DB yarış/rollback, gerçek yerel Storage+Auth API ve tarayıcı iki sürüm →
   eski/yeni içerik indirme kabulü. Snapshot liste hatası “belge yok” demesin.
6. Sonra ek protokol ayrı açık belge ilişkisi: tek ana belge + birden çok protokol
   ihtiyacını mevcut unique index ve tüm okuyucularla birlikte tasarla. Belge
   yüklemek sözleşme statüsünü/tarihlerini otomatik değiştirmesin. Yenileme
   görevinin operasyon tarihi hukuki ihbar tarihi haline gelmesin.

## Sınırlar

Sürüm arşivi ile saklama/silme politikası aynı konu değildir. Bu ilk dilim sözleşme
PDF sürümünü korur; elektronik imza, OCR, hukuk onayı, otomatik yenileme veya tüm
Evrak modülü dönüşümü değildir. Mevcut43 raw-claim policy ve üretim migrationları
bu planla değiştirilmez. Üretim/push/deploy için ayrıca somut teslim ve onay gerekir.
