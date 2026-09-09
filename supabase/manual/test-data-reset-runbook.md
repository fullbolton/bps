# BPS test verisi temizliği — kod hazırlığı

2026-09-08. Kullanıcı son kararı: **tam içerik yedeğini şimdilik alma; temizlik kodunu hazırla.**
Bu nedenle canlı prova, COMMIT ve Storage silmesi yapılmaz. Mevcut çıktı hazırlık kodudur.

## Kapsam

Yedi tablo, 16 satır: companies 5, contracts 2, tasks 4, appointments 2, notes 1,
staffing_demands 1, critical_dates 1. Kod, şema, Auth ve gerçek hesaplar korunur.
Hedef proje `dffdzbmnmnokbftbujsy`; bağlantı get_project_url ile ayrıca doğrulanır.

`scripts/prepare-test-data-reset.mjs` offline çalışır. Gerçek yedek henüz yok.
Girdi biçimi: `{ "project_ref": "...", "tables": { "companies": [tam satırlar], ... } }`.
SQL ve yedek iş verisi içerir; repo dışında kullanıcıya özel dizinde tutulmalıdır.

```sh
node scripts/prepare-test-data-reset.mjs /ABS/backup.json /ABS/rehearsal.sql
node --test scripts/prepare-test-data-reset.test.mjs
```

Varsayılan SQL ROLLBACK ile biter. `--commit` yalnız ayrı bir COMMIT dosyası üretir;
araç hiçbir dosyayı çalıştırmaz. Mevcut kullanıcı kararıyla COMMIT dosyası üretilmedi.

## Kontroller

- Sabit proje, tablo listesi, sayılar ve UUID biçimi; beklenmeyen ek tablo reddi.
- Public normal tablolara isim sırasıyla SHARE ROW EXCLUSIVE lock; lock_timeout 5s,
  statement_timeout 30s. Okuma devam edebilir, yazmalar transaction sonuna kadar bekler.
- Yedekteki tam satırlarla canlı JSONB eşitliği: aynı ID/sayı ama içerik değişmişse durur.
- Hedef dışı FK çocuk tablosu doluysa durur; dış şema/partition bağımlılığını reddeder.
- DELETE trigger veya rewrite rule varsa yeniden inceleme ister.
- Çocuk→parent sırasıyla, yalnız yedekteki ID'lere DELETE; etkilenen ve kalan satır kontrolü.
- Diğer tüm public normal tabloların önce/sonra içerik eşitliği.
- SQL veri literal'leri ve dış DO ayırıcıları kaçırılır; dinamik tablo adları format `%I` kullanır.

## Sınırlar / henüz kanıtlanmayanlar

Node testleri SQL üretimini doğrular; PostgreSQL davranışını, rollback/restore veya
kimlikli UI smoke'u kanıtlamaz. Kodu canlıda güvenli çalıştırılmış sayma.
Tam yedek, geri yükleme doğrulaması ve kontrollü DB provası olmadan uygulanmaz.
Public normal tablolar dışındaki ilişkiler/veritabanı nesneleri ve çalışma sırasında
DDL değişiklikleri ayrıca gözden geçirilir; bu genel amaçlı reset aracı değildir.

Storage ayrı: 0 byte klasör işareti ve 491809 byte PDF var. İçerikleri indirilmedi.
SQL metadata silinmez; dosya yedeği ve Storage API yolu ayrı hazırlanmalıdır.
Korunan hesap/üyelikler nedeniyle Auth silme veya TRUNCATE CASCADE komutu yoktur.
