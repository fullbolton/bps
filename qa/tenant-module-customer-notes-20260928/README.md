# M2i — Firma notları ve yetkili kişi komut sınırı

**Yerel çalışma; üretim SQL, push ve deploy yapılmadı.** Başlangıç commit'i: `97dc876`.

## Değişiklikler

- `note_execute_v1` oluşturma/düzenleme/sabitleme/silme işlemlerini tek veritabanı komutunda toplar. Aktör, tenant ve firma doğrulanır; not hedefi hem firma hem tenant ile bağlanır. Aynı tenant içindeki başka firmanın notunu değiştirmek reddedilir.
- Kilit sırası config → profil → firma/not. Profil beklemesinden sonra modül, üyelik ve rol yeniden kontrol edilir. Operasyon/İK kendi notunu düzenleyebilir; yönetici sabitleyebilir/silebilir. Yazar kimliği ve adı profilden gelir, payload'dan alınmaz. Boş profil adı düzeltme mesajıyla reddedilir.
- İçerik 1–10.000 karakter, etiket mevcut altı değerden biri veya null, JSON en fazla 64KB. Eski uzun notların okunması engellenmez; düzenleme yeni sınıra tabidir. Pasif firmalara not ekleme mevcut davranışı korunur.
- Servis katmanındaki tekrarlı yetki sorguları ve kullanılmayan hata sınıfları kaldırıldı. Tek RPC çağrısının cevabı hedef kimlikleri ve sonuç şekliyle doğrulanır. Ağ belirsizliğinde otomatik tekrar yoktur; kullanıcıdan listeyi yenilemesi istenir. Oluşturma için kalıcı idempotency makbuzu henüz yoktur.
- Mevcut `write_company_contact` tam gövdesi doğrulanarak SECURITY DEFINER'a çevrilir; config/profil kilidi ve bekleme sonrası rol kontrolü eklenir. Beş kişi sınırı, ana yetkili değişiminin atomikliği, firma/tenant eşleşmesi ve pasif firma reddi korunur. Gövde farklıysa migration tamamen durur; aynı imzalı farklı gövdeye yetki yükseltmesi yapılmaz.
- Ayrı 002100 contract migration'ı şirket/not tablolarının doğrudan yazma yetkilerini kaldırır; tablo ve kolon seviyesindeki etkin izinleri denetler. SELECT korunur. Kişi tablosunun doğrudan yazma izinlerine henüz dokunmaz.

## Kanıt ve sınırlar

**583/583 uygulama testi, 92/92 PostgreSQL testi, TypeScript ve üretim derlemesi geçti.** Statik denetim: 0 FAIL / 2 WARN (commit öncesi yeni migration dosyaları ve mevcut kullanılmayan CapacityRiskCard/TimelineList bileşenleri).

Nihai sayılar ve dosya SHA256 değerleri `manifest.json`, çalıştırma çıktıları `database.log` ve `release.log` içindedir.

18 yeni PostgreSQL testi gerçek komut/migration ve mevcut contact/note alan koruma trigger'larını kullanır. Rol/tenant/firma/yazar retleri, payload sınırları, kapalı modül, eşzamanlı config ve profil kilitleri, beklerken rol değişimi, kaynak gövde sapması ve inherited yetki reddi denenir. Firma/not DML kaldırıldıktan sonra üç RPC ve eski CSV contact INSERT yolu ayrıca doğrulanır. Fixture sentetiktir; bu dosyanın basitleştirilmiş SELECT policy'leri üretim rol okuma kabulü sayılmaz (önceki müşteri okuma suite'i ayrıdır).

Yedi yeni uygulama testi gerçek servis/transport kodunda kapsam, dört eylem, bozuk cevap, modül hatası, ağ belirsizliği ve düzeltilebilir hata mesajlarını denetler. Kimlikli tarayıcı/PostgREST veya üretim katalog testi yapılmadı. Beş eski DB suite'i ve yedi pending dosya çalıştırılmadı. Lint yapılandırılmamış.

## Yayın sırası

Ortak foundation ve 001800 sonrasında 001900 + 002000 expand uygulanır. Önce canlı gövde, owner, etkin izin ve trigger ön kontrolü; ardından yeni frontend ve kimlikli firma/not/yetkili kişi smoke. **002100 yalnız bu kabulden sonra uygulanır.** Eski frontend'in ham not yazımı contract sonrası çalışmaz. Önceki görev 001100 cutover sırası da bağımsız korunur; bekleyen SQL'ler kör toplu db push ile uygulanmaz.

## Açık işler

Telefon/e-posta güncelleme, kişi silme ve CSV yetkili aktarımı henüz yeni modül komutuna taşınmadı. Mevcut alan/rol trigger korumaları vardır; bunlar modül kilidi garantisi değildir. Bunların tamamlanması ve contact DML cutover sıradadır. Service/definer projeksiyonları, parent-FK etkileri, açık iş/bağımlılık kontrolleri, ayar mutasyonu ve gezinme/cache yenileme tamamlanmadı. **Genel modül kapatma UI'si açılmadı.**
