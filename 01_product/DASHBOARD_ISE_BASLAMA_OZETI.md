# Dashboard İşe Başlama özeti — 037

2026-09-09. Yerel ürün dilimi; canlı035ve27migration değişmez. 036'nın02800salt-okunur RPC'sine dayanır, yeni SQL migration yok.

Dashboard günlük plan sayıları yerleştirmeyi gösteriyor; personelin varış teyidi ayrı. Günlük operasyon bölümüne aynı iş günü için takip bekleyen atama sayısı, günün toplam ataması ve ilk3eşleşen kaydın adı/şubesi/durumu ekle. “Takip bekleyenleri aç” bağlantısı o günün aksiyon filtresiyle açılmalı. Bu kart bordro, bildirim veya personel gelmedi kararı üretmez.

Tek `ops_start_board_filtered(...p_only_urgent:true,p_offset:0)` çağrısı kullanılır; toplam ve gösterilen kayıtlar aynı snapshot'tan gelir. Mevcut RPC ilk50satır ve geçmişini de döndürür; ilk3kart bunun içinden alınır. Yeni ayrı sayaç sorgusunda aksiyon kuralı çoğaltılmaz. Bu aşamada dar payload/portföy performans optimizasyonu iddiası yok.

Snapshot zamanı görünür; elle yenilenir. Yükleme/hata/0atama/takipgerekmiyor ayrı durumlar; hata sıfıra çevrilmez. Actor/tenant/gün değişiminde eski sonuç gizlenir ve gecikmiş cevap kullanılmaz. Yeni özet mevcut yerleştirme sayaçlarıyla ayrı sorgudur; iki bölüm tek transaction snapshot değildir.

Kabul: parser/summary sayılarının tutarlılığı, bekleyen teyit/beyan ve kapanmış/teyitli kaydı aksiyon diye gösterme reddi; 50üstü gerçek toplamın korunması; Türkçe iş günü bağlantısı; TypeScript/genel/build ve yerel tarayıcı boş/dolu/filtreli bağlantı. Fable görev01 dosyalarına dokunma. Sonuç raporu gelince bağımsız incelemeyi önceliklendir.

Git durumu ölçümü: yayın035kaynakları `fb1b218`, devir notları `2b53d98` commit'inde. Bunlar başka çalışma tarafından oluşturuldu; Codex bu tur commit/push yapmadı. Remote push durumu bu ölçümle kanıtlanmış değildir. Önceki “commit yok” notları yayın anının kaydıdır.

## Uygulama ve kabul

`dashboard/StartOverview.tsx` günlük özetin başarılı gün/kimlik bağlamına eklendi. `src/lib/operations/start-overview.ts` filtre kapsamı, tam ilk sayfa, gün ve aksiyon tutarlılığını doğrular; toplamı50satırdan hesaplamaz. Sorumlu yetkisini kaybetmişse durum ayrıca belirtilir. `aksiyon=1` takip ekranının ilk açılış filtresini seçer.

- Yeni6unit; toplam151operasyonunit,genel5/5. Rapor `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-e7u9ZY/report.md`.
- İzole build exit0: `/private/tmp/bps-start-overview-build.log`. YeniSQLyok;0368native+gerçekAuthRPCkanıtı mevcutokuyucu için korunur, tümDBsuite tekrar çalıştırılmadı.
- Yerel tarayıcı0takip/4atama; geçici plansız atamayla1takip/5atama ve ad/şube/durum doğru. Bağlantı aynıgün `aksiyon=1` ile1/5listeyi açtı; checkbox seçili, teyitli/kapanmış kayıtlar listede yok. Dört geçici fixture kaydı sonra temizlendi. İlk fixture sabitactorid gerçek yerelprofiles'ta yoktu; transactionrollbackoldu. Geçerli sentetik üyelik seçilerek düzeltildi, ürünFKgevşetilmedi.
- Mevcut yerel Dashboard'da kritik tarihler/duyurular eski minimumfixture nedeniyle okuma hatası gösteriyor; bu dilimde o modüllerin kabulü yapılmadı. Canlıda aynıhata olduğu iddia edilmiyor.

Fable sonuç raporu geldi: kritik bulgu bulmadığını, ikiP2vebirP3bildirdiğini söylüyor. Codex triage ayrı notta; öncelik artık bulguları doğrulayıp düzeltmek.
