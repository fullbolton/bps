-- ==========================================================================
-- BPS Sector Templates V1 — Configuration catalog
-- ==========================================================================
-- Read-only reference catalog for 8 supported sectors.
-- V1 = sector reference + read-only template catalog
-- V1 ≠ sector automation engine
--
-- No automatic operational records are created from this table.
-- Company only stores sector code; template is looked up, never copied.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS sector_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_code         text NOT NULL UNIQUE,
  label               text NOT NULL,
  document_types      jsonb NOT NULL DEFAULT '[]'::jsonb,
  task_types          jsonb NOT NULL DEFAULT '[]'::jsonb,
  contract_types      jsonb NOT NULL DEFAULT '[]'::jsonb,
  critical_date_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_criteria       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger (repo convention)
CREATE OR REPLACE FUNCTION public.sector_templates_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  new.updated_at := now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS sector_templates_set_updated_at ON sector_templates;
CREATE TRIGGER sector_templates_set_updated_at
  BEFORE UPDATE ON sector_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.sector_templates_set_updated_at();

-- RLS: authenticated users can read, no UI write path
ALTER TABLE sector_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY sector_templates_select ON sector_templates
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON sector_templates TO authenticated;

-- ==========================================================================
-- Seed 8 sector rows
-- ==========================================================================

INSERT INTO sector_templates (sector_code, label, document_types, task_types, contract_types, critical_date_types, risk_criteria) VALUES

('guvenlik', 'Ozel Guvenlik',
  '[{"name":"Ozel Guvenlik Yetki Belgesi","required":true},{"name":"Silah Ruhsati","required":true},{"name":"Guvenlik Kimlik Karti","required":true},{"name":"SGK Ise Giris Bildirgeleri","required":true},{"name":"Vardiya Cizelgesi","required":false}]'::jsonb,
  '[{"name":"Ruhsat yenileme basvurusu","default_assignee":"operasyon"},{"name":"Vardiya plani hazirlama","default_assignee":"operasyon"},{"name":"Devriye kontrol","default_assignee":null},{"name":"Personel kimlik karti takip","default_assignee":"ik"}]'::jsonb,
  '[{"name":"Ana Guvenlik Sozlesmesi","default_duration_months":12},{"name":"Ek Guvenlik Protokolu","default_duration_months":6},{"name":"Ozel Etkinlik Guvenlik Sozlesmesi","default_duration_months":null}]'::jsonb,
  '[{"name":"Guvenlik Yetki Belgesi Suresi","warning_days":[90,30,15]},{"name":"Silah Ruhsat Suresi","warning_days":[60,30]},{"name":"Guvenlik Kimlik Karti Suresi","warning_days":[90,30]}]'::jsonb,
  '[{"name":"Yetki belgesi suresi dolmus","severity":"high"},{"name":"Personel eksikligi %20 ustu","severity":"high"},{"name":"Devriye tamamlanma orani dusuk","severity":"medium"},{"name":"Odeme gecikmesi","severity":"high"}]'::jsonb
),

('temizlik', 'Temizlik Hizmetleri',
  '[{"name":"Is Sagligi Sertifikasi","required":true},{"name":"Temizlik Hizmet Ek Protokolu","required":false},{"name":"Malzeme Guvenlik Bilgi Formu","required":false},{"name":"Kalite Denetim Raporu","required":false}]'::jsonb,
  '[{"name":"Saha denetim raporu","default_assignee":"operasyon"},{"name":"Malzeme siparis takip","default_assignee":"operasyon"},{"name":"Musteri memnuniyet anketi","default_assignee":null}]'::jsonb,
  '[{"name":"Temizlik Hizmet Sozlesmesi","default_duration_months":12},{"name":"Ek Protokol","default_duration_months":6}]'::jsonb,
  '[{"name":"Hizmet Sozlesmesi Suresi","warning_days":[90,30]},{"name":"Is Sagligi Sertifikasi Suresi","warning_days":[60,30]}]'::jsonb,
  '[{"name":"Denetim puani dusuk","severity":"medium"},{"name":"Musteri sikayeti artisi","severity":"medium"},{"name":"Personel devir hizi yuksek","severity":"medium"},{"name":"Odeme gecikmesi","severity":"high"}]'::jsonb
),

('personel_temin', 'Personel Temin',
  '[{"name":"SGK Ise Giris Bildirgeleri","required":true},{"name":"Personel Ozluk Dosyasi","required":true},{"name":"Hijyen Sertifikasi","required":false},{"name":"Saglik Raporu","required":false}]'::jsonb,
  '[{"name":"Talep-personel eslestirme","default_assignee":"operasyon"},{"name":"SGK bildirge kontrolu","default_assignee":"ik"},{"name":"Oryantasyon takibi","default_assignee":"ik"}]'::jsonb,
  '[{"name":"Personel Temin Sozlesmesi","default_duration_months":12},{"name":"Gecici Personel Protokolu","default_duration_months":3}]'::jsonb,
  '[{"name":"SGK Bildirge Suresi","warning_days":[30,15]},{"name":"Saglik Raporu Suresi","warning_days":[60,30]}]'::jsonb,
  '[{"name":"Doluluk orani dusuk","severity":"high"},{"name":"Personel devir hizi yuksek","severity":"medium"},{"name":"SGK uyumsuzluk","severity":"high"},{"name":"Odeme gecikmesi","severity":"high"}]'::jsonb
),

('osgb', 'OSGB / ISG',
  '[{"name":"ISG Yetki Belgesi","required":true},{"name":"Risk Degerlendirme Raporu","required":true},{"name":"Acil Durum Plani","required":true},{"name":"Egitim Katilim Formu","required":false},{"name":"Saglik Muayene Raporu","required":false}]'::jsonb,
  '[{"name":"Risk degerlendirme guncelleme","default_assignee":"operasyon"},{"name":"Egitim planlama","default_assignee":"operasyon"},{"name":"Muayene takvimi takip","default_assignee":"ik"},{"name":"ISGKATiP veri hazirlama","default_assignee":"operasyon"}]'::jsonb,
  '[{"name":"OSGB Hizmet Sozlesmesi","default_duration_months":12},{"name":"Egitim Paketi Sozlesmesi","default_duration_months":6}]'::jsonb,
  '[{"name":"ISG Yetki Belgesi Suresi","warning_days":[90,30,15]},{"name":"Risk Degerlendirme Guncelleme","warning_days":[30]},{"name":"Periyodik Muayene Takvimi","warning_days":[60,30]}]'::jsonb,
  '[{"name":"ISG belgesi suresi dolmus","severity":"high"},{"name":"Egitim tamamlanma orani dusuk","severity":"medium"},{"name":"Kaza sikligi yuksek","severity":"high"},{"name":"Muayene gecikme","severity":"medium"}]'::jsonb
),

('lojistik', 'Lojistik',
  '[{"name":"Tasima Yetki Belgesi","required":true},{"name":"Arac Ruhsati","required":true},{"name":"Surucu Ehliyeti","required":true},{"name":"SRC Belgesi","required":false},{"name":"Saglik Raporu","required":false}]'::jsonb,
  '[{"name":"Arac bakim takip","default_assignee":"operasyon"},{"name":"Surucu belge yenileme","default_assignee":"ik"},{"name":"Teslimat performans raporu","default_assignee":null}]'::jsonb,
  '[{"name":"Lojistik Hizmet Sozlesmesi","default_duration_months":12},{"name":"Depo Operasyon Sozlesmesi","default_duration_months":12},{"name":"Ek Protokol","default_duration_months":6}]'::jsonb,
  '[{"name":"Tasima Yetki Belgesi Suresi","warning_days":[90,30]},{"name":"Arac Muayene Suresi","warning_days":[60,30]},{"name":"SRC Belgesi Suresi","warning_days":[60,30]}]'::jsonb,
  '[{"name":"Belge suresi dolmus","severity":"high"},{"name":"Teslimat gecikme orani yuksek","severity":"medium"},{"name":"Arac bakim gecikme","severity":"medium"},{"name":"Odeme gecikmesi","severity":"high"}]'::jsonb
),

('danismanlik', 'Danismanlik',
  '[{"name":"Sozlesme Suresi Belgesi","required":false},{"name":"Proje Deliverable Raporu","required":false},{"name":"Gizlilik Sozlesmesi","required":false}]'::jsonb,
  '[{"name":"Proje deliverable takip","default_assignee":null},{"name":"Musteri toplanti planla","default_assignee":null},{"name":"Saat bazli faturalandirma hazirla","default_assignee":"operasyon"}]'::jsonb,
  '[{"name":"Danismanlik Hizmet Sozlesmesi","default_duration_months":12},{"name":"Proje Bazli Sozlesme","default_duration_months":null}]'::jsonb,
  '[{"name":"Sozlesme Suresi","warning_days":[90,30]},{"name":"Proje Deadline","warning_days":[30,15,7]}]'::jsonb,
  '[{"name":"Proje gecikme","severity":"medium"},{"name":"Musteri iletisim kopuklugu","severity":"medium"},{"name":"Odeme gecikmesi","severity":"high"}]'::jsonb
),

('tesis_yonetimi', 'Tesis Yonetimi',
  '[{"name":"Yangin Guvenligi Sertifikasi","required":true},{"name":"Asansor Bakim Raporu","required":true},{"name":"Enerji Performans Belgesi","required":false},{"name":"Cevre Izin Belgesi","required":false}]'::jsonb,
  '[{"name":"Periyodik bakim planlama","default_assignee":"operasyon"},{"name":"Ariza bildirim takip","default_assignee":"operasyon"},{"name":"Alt yuklenici performans degerlendirme","default_assignee":null}]'::jsonb,
  '[{"name":"Tesis Yonetim Sozlesmesi","default_duration_months":12},{"name":"Bakim Sozlesmesi","default_duration_months":12},{"name":"Alt Yuklenici Sozlesmesi","default_duration_months":6}]'::jsonb,
  '[{"name":"Yangin Sertifikasi Suresi","warning_days":[90,30]},{"name":"Asansor Bakim Suresi","warning_days":[30,15]},{"name":"Enerji Belgesi Suresi","warning_days":[60,30]}]'::jsonb,
  '[{"name":"Yangin belgesi suresi dolmus","severity":"high"},{"name":"Bakim gecikme","severity":"medium"},{"name":"Enerji tuketim anomali","severity":"medium"},{"name":"Ariza tekrar orani yuksek","severity":"medium"}]'::jsonb
),

('insaat', 'Insaat Taseronu',
  '[{"name":"ISG Denetim Raporu","required":true},{"name":"Santiye Gunlugu","required":false},{"name":"Puantaj Listesi","required":true},{"name":"Taseron Evrak Dosyasi","required":true}]'::jsonb,
  '[{"name":"Hakedis hazirlama","default_assignee":"operasyon"},{"name":"Santiye ISG denetimi","default_assignee":"operasyon"},{"name":"Personel puantaj toplama","default_assignee":"ik"},{"name":"Malzeme stok kontrolu","default_assignee":null}]'::jsonb,
  '[{"name":"Taseron Sozlesmesi","default_duration_months":null},{"name":"Hakedis Sozlesmesi","default_duration_months":null},{"name":"ISG Hizmet Sozlesmesi","default_duration_months":12}]'::jsonb,
  '[{"name":"ISG Denetim Suresi","warning_days":[30,15]},{"name":"Hakedis Vadesi","warning_days":[15,7]},{"name":"Taseron Belge Suresi","warning_days":[60,30]}]'::jsonb,
  '[{"name":"ISG uyumsuzluk","severity":"high"},{"name":"Hakedis gecikme","severity":"high"},{"name":"Personel devir yuksek","severity":"medium"},{"name":"Santiye kazasi","severity":"high"}]'::jsonb
);
