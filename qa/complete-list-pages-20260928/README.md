# Büyük liste okuma — 2026-09-28

Baz: e771225. Görev, randevu, sözleşme ve firma notlarının 12 okuma yolu ortak completePages okuyucusuna geçti. Aynı şirket/sözleşme/randevu filtreleri ve RLS korunur. Mevcut ekran araması, mobil görünüm sayaçları ve takvim tam liste üzerinde çalışmaya devam eder.

## Davranış

- İstek başına 500 kayıt, en fazla 10.000 kayıt ve toplam 30 saniye okuma bütçesi.
- Mevcut sıralamanın sonunda benzersiz id sırası; aynı tarihli kayıtlar sayfalar arasında belirsiz sıraya girmez.
- Exact count, beklenen sayfa uzunluğu, benzersiz kimlik ve sayfalar arası toplam doğrulanır. İkinci sayfa hata verirse ilk sayfa başarılı sonuç olarak dönmez.
- Boş liste tek istek. Tam 500/1000 kayıtta fazladan boş istek yok.
- Aktif sözleşme sayaçları aynı firma için birden fazla sözleşmeyi ayrı sayar; projeksiyona yalnız id eklendi.

## Sınırlar

Bu, tüm filtreleri sunucuda uygulayan yeni bir liste ekranı değildir. İstemciye toplam aktarılan kayıt miktarını azaltmaz; PostgREST'in tek yanıt sınırını kontrollü sayfalarla aşar. 10.000 üzerinde eksik liste yerine açık hata verir. Daha yüksek hacim için ekran bazlı sunucu filtreleri/sayaçları ve sayfalama ayrı iştir.

HTTP sayfaları tek DB snapshot değildir. Toplam değişimi ve yinelenen kimlik yakalanır; toplamı değiştirmeyen eşzamanlı güncellemeler için snapshot tutarlılığı iddia edilmez. Kritik tarihler, iş gücü ve dashboard özet sorguları bu pakette değiştirilmedi; mevcut kesilme kontrolleri durur.

## Doğrulama

18 yeni test: 1.001 kayıt/üç istek, sayfa sınırları, kesilme, ağ hatası, count değişimi, yinelenen/eksik kimlik, limit, zaman aşımı; 12 okuyucunun filtre ve sıralaması. Gerçek Supabase JS istemcisiyle HTTP offset/limit/order sözleşmesi de doğrulandı. Üretime sentetik iş kaydı yazılmadı. SQL/migration değişikliği yok.
