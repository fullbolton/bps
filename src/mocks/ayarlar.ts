/**
 * Mock data for Ayarlar screen — Phase 4.
 * Read-only reference arrays aligned with actual product vocabulary.
 * No CRUD state. All display-only.
 */

// ---------------------------------------------------------------------------
// Firma Etiketleri (sector labels actually used in MOCK_FIRMALAR)
// ---------------------------------------------------------------------------

export interface AyarDictEntry {
  id: string;
  ad: string;
  durum: "aktif" | "pasif";
}

export const FIRMA_ETIKETLERI: AyarDictEntry[] = [
  { id: "fe1", ad: "Lojistik", durum: "aktif" },
  { id: "fe2", ad: "Temizlik", durum: "aktif" },
  { id: "fe3", ad: "Güvenlik", durum: "aktif" },
  { id: "fe4", ad: "İnşaat", durum: "aktif" },
  { id: "fe5", ad: "Gıda", durum: "aktif" },
  { id: "fe6", ad: "Turizm", durum: "pasif" },
  { id: "fe7", ad: "Tekstil", durum: "aktif" },
  { id: "fe8", ad: "Enerji", durum: "aktif" },
];

// ---------------------------------------------------------------------------
// Sözleşme Tipleri (contract types used in MOCK_SOZLESMELER)
// ---------------------------------------------------------------------------

export const SOZLESME_TIPLERI: AyarDictEntry[] = [
  { id: "st1", ad: "Hizmet", durum: "aktif" },
  { id: "st2", ad: "Ek Protokol", durum: "aktif" },
];

// ---------------------------------------------------------------------------
// Evrak Kategorileri (from KATEGORI_LABELS in batch4.ts)
// ---------------------------------------------------------------------------

export const EVRAK_KATEGORILERI: AyarDictEntry[] = [
  { id: "ek1", ad: "Çerçeve Sözleşme", durum: "aktif" },
  { id: "ek2", ad: "Ek Protokol", durum: "aktif" },
  { id: "ek3", ad: "Yetki Belgesi", durum: "aktif" },
  { id: "ek4", ad: "Operasyon Evrakı", durum: "aktif" },
  { id: "ek5", ad: "Teklif Dosyası", durum: "aktif" },
  { id: "ek6", ad: "Ziyaret Tutanağı", durum: "aktif" },
  { id: "ek7", ad: "Diğer", durum: "aktif" },
];

// ---------------------------------------------------------------------------
// Görev Tipleri (from KAYNAK_LABELS in gorevler.ts)
// ---------------------------------------------------------------------------

export const GOREV_TIPLERI: AyarDictEntry[] = [
  { id: "gt1", ad: "Manuel", durum: "aktif" },
  { id: "gt2", ad: "Randevu", durum: "aktif" },
  { id: "gt3", ad: "Sözleşme", durum: "aktif" },
];

// ---------------------------------------------------------------------------
// Kullanıcılar (mock reference list)
// ---------------------------------------------------------------------------

export interface AyarUserEntry {
  id: string;
  ad: string;
  rol: string;
  eposta: string;
}

export const KULLANICILAR: AyarUserEntry[] = [
  { id: "u1", ad: "Yönetici Kullanıcı", rol: "Yönetici", eposta: "yonetici@bps.local" },
  { id: "u2", ad: "Ahmet B.", rol: "Operasyon", eposta: "ahmet@bps.local" },
  { id: "u3", ad: "Mehmet Y.", rol: "Satış", eposta: "mehmet@bps.local" },
  { id: "u4", ad: "Zeynep A.", rol: "Operasyon", eposta: "zeynep@bps.local" },
  { id: "u5", ad: "Burak Ş.", rol: "Satış", eposta: "burak@bps.local" },
  { id: "u6", ad: "Elif Y.", rol: "Operasyon", eposta: "elif@bps.local" },
  { id: "u7", ad: "Demo Görüntüleyici", rol: "Görüntüleyici", eposta: "demo@bps.local" },
  { id: "u8", ad: "Fatma K.", rol: "İK", eposta: "ik@bps.local" },
  { id: "u9", ad: "Selin T.", rol: "Muhasebe", eposta: "muhasebe@bps.local" },
];

// ---------------------------------------------------------------------------
// Roller (the 4 documented roles from ROLE_MATRIX)
// ---------------------------------------------------------------------------

export interface AyarRolEntry {
  id: string;
  rolAdi: string;
  aciklama: string;
}

export const ROLLER: AyarRolEntry[] = [
  { id: "r1", rolAdi: "Yönetici", aciklama: "Kurumsal görünürlük, kontrol, kritik aksiyon ve yapılandırma yönetimi" },
  { id: "r2", rolAdi: "Operasyon", aciklama: "Personel talebi, aktif iş gücü, evrak takibi ve operasyonel görev akışı" },
  { id: "r3", rolAdi: "Satış", aciklama: "Firma ilişkisi, görüşme takibi, yenileme fırsatı ve müşteri teması" },
  { id: "r4", rolAdi: "İK", aciklama: "Evrak uyumu ve personel belge tamamlama" },
  { id: "r5", rolAdi: "Muhasebe", aciklama: "Finansal veri girişi, alacak takibi ve faturalama görünürlüğü" },
  { id: "r6", rolAdi: "Görüntüleyici", aciklama: "Yalnızca okuma — takip ve rapor görünürlüğü" },
];

// ---------------------------------------------------------------------------
// Şehirler (operational geography — city-level grouping)
// ---------------------------------------------------------------------------

export const SEHIRLER: AyarDictEntry[] = [
  { id: "seh1", ad: "İstanbul", durum: "aktif" },
  { id: "seh2", ad: "İzmir", durum: "aktif" },
  { id: "seh3", ad: "Ankara", durum: "aktif" },
  { id: "seh4", ad: "Bursa", durum: "aktif" },
  { id: "seh5", ad: "Antalya", durum: "pasif" },
  { id: "seh6", ad: "Trabzon", durum: "aktif" },
  { id: "seh7", ad: "Edirne", durum: "aktif" },
  { id: "seh8", ad: "Konya", durum: "aktif" },
];

// ---------------------------------------------------------------------------
// Operasyon Partnerleri (accountability nodes under cities)
// ---------------------------------------------------------------------------

export interface AyarPartnerEntry {
  id: string;
  ad: string;
  sehir: string;
  durum: "aktif" | "pasif";
}

export const OPERASYON_PARTNERLERI: AyarPartnerEntry[] = [
  { id: "op1", ad: "Ahmet B.", sehir: "İstanbul", durum: "aktif" },
  { id: "op2", ad: "Mehmet Y.", sehir: "Ankara", durum: "aktif" },
  { id: "op3", ad: "Zeynep A.", sehir: "Bursa", durum: "aktif" },
  { id: "op4", ad: "Burak Ş.", sehir: "İzmir", durum: "aktif" },
  { id: "op5", ad: "Elif Y.", sehir: "Konya", durum: "aktif" },
  { id: "op6", ad: "Burak Ş.", sehir: "Edirne", durum: "aktif" },
  { id: "op7", ad: "Fatma Ç.", sehir: "Trabzon", durum: "aktif" },
];

/**
 * Firm-to-partner mapping.
 * Each firma is assigned to the partner operating in its city.
 */
export const FIRMA_PARTNER_MAP: Record<string, { partnerId: string; partnerAdi: string }> = {
  f1: { partnerId: "op1", partnerAdi: "Ahmet B." },    // İstanbul
  f2: { partnerId: "op4", partnerAdi: "Burak Ş." },    // İzmir
  f3: { partnerId: "op2", partnerAdi: "Mehmet Y." },    // Ankara
  f4: { partnerId: "op7", partnerAdi: "Fatma Ç." },     // Trabzon
  f5: { partnerId: "op3", partnerAdi: "Zeynep A." },    // Bursa
  f6: { partnerId: "op1", partnerAdi: "Ahmet B." },     // Antalya → İstanbul partner (pasif firma)
  f7: { partnerId: "op6", partnerAdi: "Burak Ş." },     // Edirne
  f8: { partnerId: "op5", partnerAdi: "Elif Y." },      // Konya
};
