# Dosya servisi kesintisi — tarayıcı kabulü

## 18 Ekim — Storage yanıt kesintisi / tarayıcı toparlanması

Sentetik authenticated-browser düzeneğinde yalnız geçici Storage container docker pause ile duraklatıldı. Tarayıcıdan 9101 için Yüklemeyi tamamla seçildi. Gerçek server action süre sınırı sonrası Dosya okunamadı mesajı gösterdi; başarı mesajı yok, kontroller yeniden açıldı. SQL ölçümü documents=0, pending=1, storage.objects=1. Storage unpause sonrası aynı düğme ile yeniden denemede başarı; documents=1, pending=0, object=1. Dosya tekrar yüklenmedi.

Kanıt: storage-outage-browser-result.json; ../synthetic-restore-20261018/storage-outage.png ve storage-reconnected.png. Test sekmesi kapatıldı, harness SIGTERM exit 0, geçici servisler temizlendi. Bu fiziksel mobil/zayıf internet veya upload body kesintisi kabulü değil; gerçek Storage yanıt vermemesi ve UI toparlanma kabulüdür. Tam gecikme ölçülmedi. Ürün kodu ve üretim değişmedi.
