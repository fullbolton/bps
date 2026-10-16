# Sözleşme oluşturma ve düzenleme — 15 Ekim 2026

Yerel aday. Üretim SQL, commit/push veya deploy yapılmadı. Önceki takvim/evrak değişiklikleri korundu. İki yeni migration ile kayıtlı aday modül zinciri 36 dosya; tüm zincir tek seferde yeniden uygulanmış değildir.

## Davranış

- `contract_write_v1` sözleşme oluşturma, içerik, durum ve yenileme görüşmesi alanlarını tek dar komutta doğrular. Config → profile → company → contract kilit sırası; doğrulanmış tenant ve yalnız yönetici yazma yetkisi. Mevcut tarih/durum kuralları ve revision trigger'ı korunur.
- Kişi/tenant/audit değerleri, sözleşmeyi başka firmaya taşıma ve gerçekte olmayan yenileme görevi bayrakları komut girdisi olarak kabul edilmez.
- Form açıldığı andaki kayıt snapshot'ını ve revision'ını korur. Sonraki servis okuması daha yeni revision döndürse de kullanıcıya ait revision yerine geçirilmez. Çatışmada kayıt ezilmez; kullanıcının değişiklikleri kaydedilmiş gibi gösterilmez.
- Şirket/hesap/rol değişiminde düzenleme snapshot'ı temizlenir. UI düzenleme butonu mevcut DB kuralına uygun yalnız yöneticiye gösterilir; eski partner açıklaması kaldırıldı.
- CSV sözleşme aktarımı da aynı RPC'yi kullanır. Boş/yanlış yanıt veya bağlantı hatası başarılı satır sayılmaz. Oluşturma için yeni idempotency defteri eklenmedi; belirsiz sonuç otomatik tekrarlanmaz. Kullanıcı listeyi kontrol etmelidir.
- Ayrı cutover yalnız INSERT/UPDATE yetkilerini kaldırır. DELETE hâlâ ayrı mevcut akıştır; bütün sözleşme yazma yolları bitmiş sayılmaz ve modül kapatma açılmaz.

## Kontroller

- Uygulama süiti: 654 test. Altı yeni komut/aktarim/servis testi; servis, ekrandan gelen eski revision'ı yeni okuduğu revision'la değiştirmediğini doğrular.
- `npm run qa:contract-write:local`: gerçek yerel şema kopyasında 11 PostgreSQL kontrolü. Oluşturma, revision artışı/çatışma, tarih/alan doğrulama, tenant sınırı, dört yazamayan rol, modül kapatma ve API yetkileri. Her vaka rollback. Üretim ve gerçek şirket verisi kullanılmaz.
- TypeScript temiz; statik 0 FAIL / 2 WARN; diff whitespace kontrolü temiz. Yeni migration/package değişiklikleri ve önceki iki kullanılmayan bileşen uyarı olarak kalır.
- Bu tur build, tarayıcı, iki eşzamanlı bağlantılı sözleşme yarışı veya üretim kabulü yapılmadı. Eski revision testi sıralı iki yazmadır; yarış testi yerine sunulmaz.

## Yayın sırası ve devam

Expand `20261015000100` → RPC kullanan UI ve CSV uygulaması → kimlikli kabul → `20261015000200` cutover. Eski istemciler cutover sonrasında doğrudan yazamaz; bu nedenle iki SQL dosyası uygulama geçişi yapılmadan peş peşe üretime gönderilmemeli.

Kalan: sözleşme silme komutu; genel evrak oluşturma/düzenleme/yenileme; Storage yükleme/silme/kurtarma; ortak projeksiyonlar ve tüm açık iş engelleri; gerçek modül aç/kapat; birleşik zincir ve kimlikli kabul. Son belgelenmiş üretim dcc8065 / 129 migration; bu tur yeniden ölçülmedi.

## Devam: silme komutu tamamlandı

`20261015000300_contract_delete_command.sql` ile silme config → profile → company → contract kilit sırasına ve onay penceresi açıldığı andaki revision'a bağlandı. Eksik/gizli/silinmiş kayıt artık başarı sayılmaz. Yazarın aktif üyeliği, yönetici rolü ve contracts modülü DB'de doğrulanır. Server action tenant'ı oturumdan çözer; service-role kullanılmaz.

Mevcut RESTRICT ilişkileri korunur. Eski expiry bildirim tablosundaki CASCADE nedeniyle geçmişin sessizce silinmesini önlemek için bu geçmiş varsa komut da reddeder. Beklenmeyen başka CASCADE/SET NULL ilişkisi migration ön kontrolünde durdurulur. Bağlı görev silinmez veya sözleşmeden koparılmaz.

`20261015000400_contract_delete_cutover.sql` yalnız yeni server action kimlikli kabulden geçtikten sonra uygulanmalı. DELETE ve TRUNCATE API yetkilerini kaldırır. Önceki INSERT/UPDATE cutover ile birlikte tüm doğrudan sözleşme DML yolları kapanır; definer iş akışları ayrıca kendi modül kapılarını korur.

Güncel ölçüm: **656/656 uygulama**, **18/18 yerel gerçek şema PostgreSQL** testi; TypeScript temiz; statik 0 FAIL / 2 WARN; diff kontrolü temiz. İki yeni uygulama testi ve yedi yeni SQL silme vakası eklendi. Üretime yazılmadı, kimlikli tarayıcı/build yapılmadı; toplam aday migration 38. Önceki 36/654/11 sayıları bu devamdan önceki ölçümlerdir.

### Sıradaki evrak paketinin somut kapsamı

- `src/app/(main)/firmalar/[id]/actions.ts`: `uploadCompanyDocumentAction` önce Storage'a yükler, sonra metadata yazar; `deleteCompanyDocumentAction` önce metadata, sonra Storage temizliği yapar. Bu iki kaynak tek DB transaction'ı değildir. Hazırlama/yayımlama/iptal/temizlik kaydı ve belirsiz sonuç kurtarması birlikte tasarlanmalı.
- `src/lib/services/documents.ts`: validity/status değişikliği; `changeDocumentCategory` doğrudan tablo yazımı ve updated_at karşılaştırması; sözleşmeye bağlı belge için daha dar yetki korunmalı.
- `src/lib/supabase/documents.ts`: ham insert/update/replace yolları. Çağrısı bulunmayan eski contract-PDF değiştirme export'ları kullanım grafiği doğrulanmadan kaldırılmamalı; yeni sözleşme PDF prepare/finish akışı zaten ayrı.
- Yeni Storage INSERT/DELETE kontrolleri sadece menü gizleme ile değil, tenant, actor, kayıtlı dosya yolu ve modül kilidiyle uyuşmalı. Yarım dosyalar açık iş engeline dahil olmalı; temizlik kapalı modül üzerinden yeni iş üretmek için arka kapı olmamalı.

Sözleşme silme artık kalanlar listesinden çıktı. Genel evrak yaşam döngüsü ve ortak projeksiyonlar bitmeden modül kapatma açılmayacak.
