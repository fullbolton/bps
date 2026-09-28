# Kişisel veri alan koruması — uygulama planı

2026-09-28, kaynak incelemesi. Üretim kayıt içeriği okunmadı. Bu belge uygulanmış bir veri koruması veya hukuki uygunluk beyanı değildir.

## Mevcut yüzeyler

| Veri | Giriş / saklama | Gerekli kontrol |
|---|---|---|
| Proje kişi kodu | src/lib/project-reporting/source-rows.ts, actual-preview.ts; projeler/import-actions.ts | Önizleme ve server action aynı kuralı uygulamalı; hata değerini loga yazmamalı |
| Kod eşlemesi | reporting_person_codes.code, reporting_person_code_events.code | RPC ve tablo kuralı birlikte; mevcut satırlar silinmeden ihlal sayımı |
| Aktarım | reporting_imports.rows ve resolved JSONB | Eşleme tablosu kontrolü tek başına yeterli değil; prepare RPC'de her satır kontrolü |
| Kaynak dosya | src/app/(main)/projeler/source-actions.ts → private project-sources bucket | Ham XLSX/CSV, eşlenmeyen sütunlarda da kimlik/telefon taşıyabilir. Dosyanın bütün sayfalarının kontrolü veya güvenli normalize kopya politikası gerekir |
| İletişim notu | talent_conversations.note, ops_messages.body | UI önkontrol + ortak sunucu doğrulaması + DB kuralı |
| Çalışma / yedek notu | ops_work_records.note, ops_replacement_outreach.note | Aynı kural; ops_work_record_events.reason ve snapshot JSONB de kapsamda |

İlgili SQL: 20260928000200_project_reporting_actual_import.sql, 20260915000300_talent_conversations.sql, 20260910000200_request_conversation.sql, 20260915000900_work_approval.sql, 20260915000800_replacement_outreach.sql. Bu alanlar örnek kapsamdır; yeni kural öncesi tüm serbest metin / audit / kaynak dosya yolları envanteri tamamlanmalı.

## Sıra

1. Eski kapsam belgesindeki 11 haneli sayı/telefon yasağı ile sonraki havuz iletişim ihtiyacını ayır. Havuzdaki belirlenmiş telefon alanlarını kaldırma veya rolü değiştirme kararı henüz verilmedi. Serbest nota telefon yazımı ayrı kuraldır.
2. Veri sınıfına göre ortak kurallar yaz: personel kodu için gizli kişisel tanımlayıcı yerine müşteri tarafından sağlanan anonim iş kodu; notlarda operasyonel metin. 11 haneli iş kodlarını ve ayırıcıları nasıl ele aldığını açıkça belgeleyen örnekler gerekli. Sadece TCKN checksum'u kullanmak, hatalı/boşluklu kimlik girişlerini yakalama garantisi değildir.
3. Üretimde yalnız ihlal sayılarıyla etki analizi; değerleri, notları veya dosyaları rapora/loga alma. Bu tur etki sayımı yapılmadı.
4. Sentetik fixture üzerinde DB kuralı/RPC, JSONB ve uygulama testleri. Doğrudan RPC çağrısı UI kuralını atlayamamalı; tarih, tutar, UUID ve geçerli iş kodları yanlış reddedilmemeli.
5. Yeni yazımları kapsayan kontrollü migration ve kullanıcıya alan bazlı Türkçe hata; mevcut kayıtları otomatik silme veya dönüştürme yok. Eski satır doğrulaması ayrı, ölçülmüş aşama.
6. Ham kaynak dosya politikasını netleştirmeden “kimlik bilgisi sisteme girmez” deme. XLSX dosya adı, ek sayfa, gizli sütun ve hücreler de saklanabilir. Sonuç bir metin regex'iyle tam güvence değildir.

## Ürün kararları

- Havuzda telefon saklama ve toplu dışa aktarım kapsamı (operasyon/İK/yönetici).
- İK'nın kişi kayıtlarında yazma kapsamı.
- Proje kaynak dosyasını aynen saklama ile yalnız normalize edilmiş güvenli dosya saklama tercihi.

Bu kararlar netleşene kadar mevcut telefonları silme, yeni dışa aktarım yetkisi açma veya kaynak dosyalarını sessizce değiştirme yapılmaz.

## İlk uygulama bloğu

Personel kodunun tamamı normalize edilince 11 rakamsa reddeden önizleme/server/DB koruması qa/report-person-code-guard-20260928 içinde hazırlanmıştır. Yayın durumu bu paketin manifest/kanıtlarında izlenir. Bu, yukarıdaki tüm alanların veya kaynak dosyaların korunduğu anlamına gelmez; serbest metin ve dosya politikaları açık kalır.
