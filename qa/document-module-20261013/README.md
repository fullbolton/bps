# Evrak, sözleşme ve Storage modül erişimi — 13 Ekim 2026

Durum: yerel aday; üretim SQL/push/deploy yok. Önceki takvim paketi korunuyor. Yeni dosya `20261013000300_document_contract_module_access.sql`; toplam uygulanmamış aday 34.

## Tamamlananlar

- contracts, documents ve contract_document_versions SELECT politikalarına restrictive modül kontrolleri eklendi. Eski rol/tenant kuralları genişletilmedi. Sözleşme kapalıyken genel firma evrakları erişilebilir kalır; sözleşmeye bağlı evraklar gizlenir.
- Storage documents bucket SELECT, dosyanın şirket/tenant bağını ve genel belge, geçmiş sürüm, bekleyen yükleme bağlantılarını denetler. Diğer bucket'ların davranışı değiştirilmez.
- Beş SQL definer okuyucu ve yükleme durumu okuyucusu kapalı modülde veri döndürmez. SQL okuyucular null, yükleme durumu RPC'si BM001 verir; yeni boş/başarılı kayıt uydurulmaz.
- prepare_contract_document_upload ve finish_contract_pdf_upload girişinde config kilidi alınır; mevcut profile/iş kayıtları kilitlerinden önce modül kontrol edilir. Main-only eski prepare RPC'si bu korunan fonksiyona delegasyon yapar.
- Sekiz fonksiyonun mevcut gövde hashleri doğrulanır; beklenmeyen gövdede bütün migration durur. CREATE OR REPLACE sahiplik ve ACL'yi korur. Hashler önceden alınmış yerel şema kopyasından ölçüldü; güncel üretim preflight yerine geçmez.
- documents.storage_path için eksik kısmi indeks eklendi. Sürüm/yükleme tablolarındaki path unique indeksleri zaten vardı. Bu indeks yük testi veya p95 kanıtı değildir.

## Kabul

`npm run qa:document-module:local` yerel `supabase_db_bps-supabase-acceptance` konteynerini ve `bps_module_chain_20261005` sentetik şema kopyasını gerektirir. CI'daki dar fixture süitine dahil değildir; ayrıca çalıştırılması gerekir.

12 kontrol: açık modüllerde gerçek PDF hazırlama/yayınlama/okuma, kapalı sözleşmede genel evrakı koruma, evrak kapatma, prepare/finish reddi, hatalı ve yabancı dosya yolu, diğer tenant'ı koruma, permissive politika ile aşamama, gövde drift'i, RLS kapalı şema reddi, bekleyen dosya, değiştirilmiş eski PDF, gerçek READ ONLY okuma.

Her normal vaka gerçek şema üzerinde transaction rollback yapar. READ ONLY testi ayrı sentetik şema klonu kurar, okur, ardından klonu siler. Üretim verisi veya gerçek PDF byte içeriği kullanılmaz. Storage testi PostgreSQL politikalarını doğrular; gerçek Storage HTTP/signed URL teslim testi değildir.

Statik denetim 0 FAIL / 2 WARN; uyarılar aday migration/manifest değişiklikleri ve önceki kullanılmayan bileşenler. Bu tur TypeScript uygulama kodu değişmedi; önceki turdaki 648 uygulama testi yeniden koşulmuş sayılmaz.

15 Ekim takip ölçümü: 12/12 kabul başarılı. İlk koşuda tenant B yalıtım testinin süre kaydı olağandışı 899855 ms olduğundan tek vaka yeniden çalıştırıldı; tekrar başarılı ve 183 ms. İlk sürenin nedeni ölçülmedi; bu sonuçlar yük testi/p95 olarak sunulmuyor. Tekrarın ilk izin incelemesi zaman aşımına uğradı, izin verilen ikinci deneme başarıyla çalıştı.

## Kapanmayan sınırlar

1. Genel documents/contracts doğrudan INSERT/UPDATE yolları ve Storage yükleme/silme akışlarının tamamı henüz module-aware gateway'e taşınmadı. Bu paket yalnız read yüzeylerini ve sözleşme dosyasının prepare/finish komutlarını kapatır.
2. Yeni modül kapatma ekranı ve gerçek aç/kapat mutasyonu açılmayacak. Dashboard/ortak projeksiyonlar ve açık iş engelleri tamamlanacak.
3. Daha önce üretilmiş signed URL'nin anında iptal edildiği iddia edilmiyor. Mevcut sözleşme indirme kodu 60 saniyelik URL üretir; eldeki URL geçerlilik süresince kullanılabilir. Yeni Storage HTTP testi henüz yok.
4. Hash preflight, tüm aday zincirin replay'i, kimlikli tarayıcı ve üretim kabulü bekliyor. Yeni DDL tabloları ACCESS EXCLUSIVE kilitler; lock_timeout 15s yalnız kilidi beklemeyi sınırlar, indeks oluşturma süresini değil. Üretim tablo hacmi ve yayın penceresi ayrıca ölçülmeli.
5. Bu tur yeni iki oturumlu dosya yayınlama/kapatma yarışı testi yapılmadı. Ortak config helper'ın takvim yarış testi önceki pakette var; tüm dosya yaşam döngüsünün yerine geçmez.
