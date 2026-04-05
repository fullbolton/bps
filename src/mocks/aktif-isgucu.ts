/**
 * Mock data for Aktif İş Gücü screen.
 * Display-only — no schema implied. Will be replaced by Supabase queries.
 * NOT a full HRIS. Focus: firma-level capacity and occupancy visibility.
 */

import type { IsGucuRiskSeviyesi } from "@/types/batch4";

export interface MockIsGucu {
  id: string;
  firmaId: string;
  firmaAdi: string;
  lokasyon: string;
  aktifKisi: number;
  hedefKisi: number;
  acikFark: number;
  son30GunGiris: number;
  son30GunCikis: number;
  riskEtiketi: IsGucuRiskSeviyesi;
}

export const MOCK_IS_GUCU: MockIsGucu[] = [
  {
    id: "ig1",
    firmaId: "f1",
    firmaAdi: "Anadolu Lojistik A.Ş.",
    lokasyon: "İstanbul",
    aktifKisi: 42,
    hedefKisi: 45,
    acikFark: 3,
    son30GunGiris: 4,
    son30GunCikis: 2,
    riskEtiketi: "stabil",
  },
  {
    id: "ig2",
    firmaId: "f2",
    firmaAdi: "Ege Temizlik Hizmetleri",
    lokasyon: "İzmir",
    aktifKisi: 15,
    hedefKisi: 18,
    acikFark: 3,
    son30GunGiris: 1,
    son30GunCikis: 3,
    riskEtiketi: "takip_gerekli",
  },
  {
    id: "ig3",
    firmaId: "f3",
    firmaAdi: "Başkent Güvenlik Ltd.",
    lokasyon: "Ankara",
    aktifKisi: 68,
    hedefKisi: 80,
    acikFark: 12,
    son30GunGiris: 2,
    son30GunCikis: 6,
    riskEtiketi: "kritik_acik",
  },
  {
    id: "ig4",
    firmaId: "f5",
    firmaAdi: "Marmara Gıda San. Tic.",
    lokasyon: "Bursa",
    aktifKisi: 28,
    hedefKisi: 30,
    acikFark: 2,
    son30GunGiris: 3,
    son30GunCikis: 1,
    riskEtiketi: "stabil",
  },
  {
    id: "ig5",
    firmaId: "f7",
    firmaAdi: "Trakya Tekstil A.Ş.",
    lokasyon: "Edirne",
    aktifKisi: 12,
    hedefKisi: 12,
    acikFark: 0,
    son30GunGiris: 1,
    son30GunCikis: 1,
    riskEtiketi: "stabil",
  },
  {
    id: "ig6",
    firmaId: "f8",
    firmaAdi: "İç Anadolu Enerji",
    lokasyon: "Konya",
    aktifKisi: 35,
    hedefKisi: 40,
    acikFark: 5,
    son30GunGiris: 2,
    son30GunCikis: 4,
    riskEtiketi: "takip_gerekli",
  },
];
