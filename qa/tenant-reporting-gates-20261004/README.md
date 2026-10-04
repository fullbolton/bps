# M2w — Raporlama modülü giriş ve dosya kontrolleri

2026-10-04. Yerel aday migration: `20261004000300`. Üretime SQL/push/deploy yok.

## Kapsam

12 açık reporting RPC'si manifestte tek tek listelendi: proje yazma/liste/detay, kişi kod eşleme, aktarım hazırlama/tamamlama/liste/kişi arama/okuma, aylık rapor, çalışma detayı ve kaynak dosya metadata işlemi. Beş yazma girişi config SHARE bariyerini profil/iş kilitlerinden önce alır; yedi okuma reporting durumunu denetler. Mevcut rol ve tenant kontrolleri aynen kalır. Source-file metadata okuma da mevcut fonksiyonun yazma yetkisi ve kilitli yapısını korur.

`reporting_source_access` kapalı reporting için false döndürür. Yükleme yolu yazma bariyerini alır; SQL STABLE yardımcı bu nedenle PL/pgSQL VOLATILE olur. Mevcut bucket politikaları yardımcıyı kullandığından değiştirilmedi. Önceden verilmiş imzalı URL'ler sona erene kadar geçerli olabilir; bu değişiklik onları iptal etmez.

Kaynak hashleri doğrulanır; farklı gövde/yeni açık p_actor veya p_actor_id uç noktası/istemciye açılmış dahili scope veya import_validate migration'ı durdurur. RPC'lerde anonim ve service execute kaldırılır; authenticated mevcut erişimini korur. Tüm servis tüketicilerinin canlı envanteri ayrıca yayın kapısıdır.

Kapalı modül mesajı rapor ve aktarım hata çeviricilerine eklendi. BM001, komutun reddedildiği bilinen sonuçtur; ağ belirsizliğiyle aynı sayılmaz.

## Kanıt ve sınırlar

- 631 uygulama testi geçti; 20 yeni reporting DB testi geçti; TypeScript temiz; statik 0 FAIL / 2 WARN.
- 12 gerçek RPC gövdesinin kapalı girişi, açık proje listesi, rol/actor/tenant sınırı, kaynak dosya helper'ının durum/operatör/tenant kontrolleri test edildi.
- Gerçek PostgreSQL config kilit beklemesi ölçüldü; bekleyen writer commit edilmiş kapalı ayarı görüp BM001 aldı.
- Geç gövde driftinde önceki patch'lerin rollback'i, yeni uç nokta ve iç helper ACL duruşu doğrulandı.
- Sentetik PostgreSQL 17 tabloları kullanıldı. Aktarımın açık durumdaki tam iş algoritmaları, Storage HTTP yükleme/indirme, canlı politika birleşimi, tarayıcı ve production build bu turda test edilmedi. Testi çalıştırılmayan diğer DB süitleri bu sayılara dahil değil.
- Raporlama talent ve staffing kapalıyken bağımsız proje listesi döndürdü. Kişi/şube gibi ortak kimlik projeksiyonları ayrı inceleme konusudur; bütün çapraz modül verileri kapatıldı iddiası yoktur.

## Kalan yayın işleri

Kalan modül/ortak projeksiyon kontrolleri, tam iş engelleri, ayar mutation/UI, gerçek şema/ACL ön kontrolü, servis tüketicileri ve authenticated browser/Storage kabulü. Kullanıcıya modül kapatma açılmadı.
