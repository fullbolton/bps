# Fable 02 — Güvenlik düzeltmesi 1

Başlangıç: 3da7eb0. Bu paket yalnız giriş sınırı ve güvenlik başlıklarını değiştirir.

- returnTo ters eğik çizgi, kontrol karakteri, dış origin ve normalizasyon sonrası çift slash için reddedilir.
- Normal iç yol, sorgu ve fragment korunur.
- Tüm rotalarda CSP frame-ancestors none, X-Frame-Options DENY, nosniff ve strict-origin-when-cross-origin.
- /api/access-request tam yolu oturumsuz erişilebilir; bitişik yollar korunur. Mevcut sunucu doğrulaması ve yazma sınırı korunur.
- CSP burada yalnız çerçevelemeyi engeller; kapsamlı script CSP değildir.
- Yeni SQL yok. Üretim iş verisi değiştirilmez.

## Tekrar üretme

npm ci
node --test scripts/login-boundary.test.mjs scripts/security-headers.test.mjs
npx tsc --noEmit
npm run build

Beş test geçti; TypeScript geçti. Genel eski qa:unit/qa:operations test envanteri sorunu bu dar acil pakette çözülmedi.

## Sonraki paketler

Firma–tenant bileşik FK sınırları; evrak geçerliliği, liste bütünlüğü ve teklif doğrulaması; yayın test envanteri ve main uzlaştırması; rol/veri kuralı kararları.
