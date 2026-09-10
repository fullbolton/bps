# Fable review 01 — İşe Başlama Takibi bağımsız kabul testleri

Yalnız izole gömülü PostgreSQL (kendi geçici dizini, port `55471`, `BPS_FABLE_PG_PORT` ile değiştirilebilir).
Yerel Supabase'e, `.env.local`'a, üretime veya ortak QA kilidine dokunmaz. Gerçek migration gövdeleri
(000100–001200 ve 002700; s5 ayrıca 001600'ü fixture stub'ıyla) uygulanır; mock yalnız zaman/bağlantı koşulu için.

```sh
export BPS_EMBEDDED_PG_MODULE=/private/tmp/bps-native-pgtest/node_modules/embedded-postgres/dist/index.js
node --test scripts/fable-review-01/s1-response-loss.mjs
node --test scripts/fable-review-01/s2-two-operators.mjs
node --test scripts/fable-review-01/s3-time-boundaries.mjs
node --test scripts/fable-review-01/s4-confirm-attendance-replacement.mjs
node --test scripts/fable-review-01/s5-scope-change.mjs
node --test scripts/fable-review-01/s6-responsible-and-errors.mjs
node scripts/fable-review-01/run-all.mjs   # hepsi sırayla, özet çıkış kodları
```

Dosyalar aynı portu kullandığı için paralel değil, sırayla çalıştırın. Sonuç raporu: `01_product/FABLE_REVIEW_01_SONUC.md`.
