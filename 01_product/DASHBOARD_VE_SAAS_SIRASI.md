# Dashboard ve SaaS teslim sırası

2026-09-09 · Kullanıcının Dashboard geri bildirimiyle güncellenen öncelik.
Önceki benchmark: `03_strategy/BPS_SAAS_BENCHMARK_2026-09-08.md`.
Bu belge önceki “sıradaki evrak takip sahipliği” notunun önüne geçer.

## Bu teslim

- Riskli Firmalar kartı kaldırıldı. Veri kaynağı yalnız elle seçilen `companies.risk` idi; hesaplanan risk veya dayanak yoktu. Firma verisi/alanı silinmedi. Yeniden bir firma skoru üretmek yerine geciken görev, eksik evrak, yaklaşan sözleşme ve karşılanmamış talep kendi dayanağıyla takip edilmeli. Bunların tamamını hesaplayan yeni bir risk motoru bu teslimde yok.
- Günlük Otel E-postası kartı, taslak penceresi ve Dashboard'a özel üretme/kopyalama kodu kaldırıldı. Müşteri çıktı ihtiyacı haftalık plan/gerçekleşme akışında ele alınacak; otel konaklama bildirimiyle personel hizmet raporu karıştırılmayacak.
- Son Aktiviteler: 02100 salt okunur RPC. Doğrulanmış tenant + yönetici/operasyon rolü + beklenen kullanıcı. Son 20 kayıt, sayfa açılışı ve elle yenileme. Push/realtime bildirim veya tam denetim günlüğü değildir.
- Kaynaklar: `ops_events`, görev oluşturma/atama geçmişi, yüklenmiş PDF sürümleri. Baseline taşıma kayıtları gösterilmez. Başarısız okuma boş listeye çevrilmez. Storage yolu/komut payload'ı verilmez.
- Operasyon/görev açıklamaları erişilebilir güncel kayıttan gelir; tarihsel ad snapshot'ı değildir. Silinmiş görevlerin geçmişi kaynak tablonun mevcut CASCADE davranışı nedeniyle korunmaz. Kaydı tutulmayan görev durum değişikliği, finans, randevu veya duyuru işlemi bu akışta varmış gibi gösterilmez. İşlemi yapan kişi bu ilk görünümde gösterilmiyor.
- Yönetici ve operasyon tenant içi akışı görür. Partner/İK/muhasebe/görüntüleyici için kapsamları birleştiren daha geniş bir okuma yetkisi açılmadı.

## Benchmark'tan uygulamaya sıra

| Sıra | Somut çıktı | Çıkış ölçütü |
|---|---|---|
| 1 — bu teslim | Dashboard sadeleştirme + kayıtlı aktiviteler | Yerel okuma/yetki testleri ve tarayıcı kabulü |
| 2 — sıradaki | Yeni müşteri kurulum akışı ve davet yaşam döngüsü | Çalışma alanı → firma/lokasyon aktarımı → kullanıcı daveti; davet kabul/iptal/süre dolumu; yetki/sorumlu devir kontrolleri. Önce mevcut Auth/admin akışı envanteri ve migration planı, sonra kod. |
| 3 | Eski/yeni operasyon ekranlarının birleşmesi ve pilot | Dashboard talep/personel göstergeleri günlük operasyon kaynağına taşınır; banka şubesi ve dönemsel otel örneklerinde uçtan uca plan/gerçekleşme/çıktı kontrolü. Gerçek pilot onayı olmadan “canlı tamamlandı” denmez. |
| 4 | SaaS paket hakları, veri dışa aktarımı ve işletim hazırlığı | Paket ∩ rol ∩ kayıt kapsamı; dışa aktarımda tenant sınırı; iş hatası/yeniden deneme görünürlüğü. Ödeme altyapısı ticari karardan sonra. |
| 5 | Evrak takip sahipliği + saha kontrolü/hizmet teyidi | Evrak takip görevi mevcut ayrı tasarımdan; saha kontrolünde eksik bulgu → sorumlu → düzeltici görev → kapanış kanıtı. Genel form motoru/GPS/bordro kapsamı eklenmez. |
| 6 | Müşteri portalı | Müşteri yalnız kendi lokasyonları, talepleri ve onaylanan çıktıları görür; pilot paylaşım kararı ve güvenli firma kapsamı önkoşul. |

Lokasyon toplu aktarımı, günlük talep/yerleştirme, toplu değişiklik, haftalık plan,
katılım, görev devri ve sözleşme/PDF ilişkileri zaten yerelde kodlandı. Bu,
sektör modüllerine hiç başlanmadığı anlamına gelmez. Kaynak sitelerden otomatik
şube keşfi ile CSV içe aktarımı aynı özellik değildir: keşif/kaynak doğrulama
hâlâ açık. Gerçek müşteri pilotu ve prod geçişi de ayrı kapıdır.

Takvim günü taahhüdü verilmedi; sıra ve kabul ölçütleri sabitlendi. Yeni müşteri
kurulumunu başlatmak için evrak/PDF tarafına yeni ek özellikler biriktirilmeyecek.

## Yerel doğrulama

- 11 PostgreSQL kontrolü: gerçek görev trigger'ı/PDF finalize, boş veri, baseline dışlama, tenant/rol/üyelik/anon sınırı, raw tablo izni, 20 kayıt ve tekrar edilebilir sıralama.
- 2 TypeScript parser testi; null/yanlış tip/çift kayıt/harici link/boyut sınırı.
- `qa-local-dashboard-activity.mjs`: yalnız kimliği doğrulanan sentetik Supabase'a uygulama; gerçek Auth/RPC ve yetki iptali kontrolü. Geçici test hesabı sonunda kaldırılır.
- İlk tsc/build kabulü 6/6: `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-cO15AT/report.md`. Sonrasında satır açıklamaları ve kaydırma iyileştirmesi yapıldı; güncel kodda tsc, 2 parser testi, 11 PostgreSQL kontrolü ve gerçek Auth/RPC kontrolleri yeniden geçti. Tam 19 adımlık paket bu tur yeniden çalıştırılmadı.
- Tarayıcı: gerçek sentetik işlemler görüntülendi; kaldırılan kartlar yok. Yerel fixture'da eski talep/kritik tarih/duyuru kaynaklarının eksikliği ayrı ve açık; tüm Dashboard'un/prod'un sorunsuz olduğu iddia edilmez.
- 02100 yalnız yerelde; push/deploy/prod uygulaması yapılmadı.
