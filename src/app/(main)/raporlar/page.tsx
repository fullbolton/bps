"use client";

import { useState, useMemo } from "react";
import { formatDateTR } from "@/lib/format-date";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  RiskBadge,
  PriorityBadge,
  WorkforceRiskBadge,
  ReportSwitcher,
} from "@/components/ui";
import type { ReportOption } from "@/components/ui/ReportSwitcher";
import { useRole } from "@/context/RoleContext";
import type { UserRole } from "@/context/RoleContext";
import {
  RAPOR_IS_GUCU,
  RAPOR_SOZLESME_BITIS,
  getRaporTalepler,
  getRaporRandevular,
  getRaporRiskliFirmalar,
  getRaporPartnerOzet,
} from "@/mocks/raporlar";
import type {
  RaporIsGucuRow,
  RaporSozlesmeBitisRow,
  RaporTalepRow,
  RaporRandevuRow,
  RaporRiskliFirmaRow,
  RaporPartnerOzetRow,
} from "@/mocks/raporlar";
import type { ColumnDef } from "@/types/ui";
import type { IsGucuRiskSeviyesi } from "@/types/batch4";
import type { OncelikSeviyesi, RiskSeviyesi } from "@/types/ui";
import { clsx } from "clsx";
import {
  TYPE_BODY,
  TYPE_CAPTION,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_LINK,
} from "@/styles/tokens";

// ---------------------------------------------------------------------------
// Report definitions
// ---------------------------------------------------------------------------

const ALL_REPORTS: ReportOption[] = [
  { key: "is-gucu", label: "Firma Bazlı Aktif İş Gücü" },
  { key: "sozlesme-bitis", label: "Yaklaşan Sözleşme Bitişleri" },
  { key: "talep-analizi", label: "Açık / Kapanan Talep Analizi" },
  { key: "randevu-sonuc", label: "Randevu Hacmi ve Sonuçlar" },
  { key: "riskli-firma", label: "Riskli Firma Listesi" },
  { key: "partner-ozet", label: "Şehir ve Partner Operasyon Özeti" },
];

const REPORT_ROLE_ACCESS: Record<UserRole, string[]> = {
  yonetici: ["is-gucu", "sozlesme-bitis", "talep-analizi", "randevu-sonuc", "riskli-firma", "partner-ozet"],
  operasyon: ["is-gucu", "talep-analizi", "randevu-sonuc"],
  satis: ["sozlesme-bitis", "randevu-sonuc", "riskli-firma"],
  ik: ["is-gucu"],
  muhasebe: ["riskli-firma", "partner-ozet"],
  goruntuleyici: ["is-gucu", "sozlesme-bitis", "talep-analizi", "randevu-sonuc", "riskli-firma"],
};

// ---------------------------------------------------------------------------
// Column definitions per report
// ---------------------------------------------------------------------------

const COLUMNS_IS_GUCU: ColumnDef<RaporIsGucuRow>[] = [
  { key: "firmaAdi", header: "Firma", sortable: true },
  { key: "lokasyon", header: "Lokasyon" },
  { key: "aktifKisi", header: "Aktif Kişi", sortable: true },
  { key: "hedefKisi", header: "Hedef Kişi", sortable: true },
  {
    key: "acikFark",
    header: "Açık Fark",
    sortable: true,
    render: (val) => {
      const n = val as number;
      return <span className={clsx(`${TYPE_BODY} font-medium`, n > 0 ? "text-red-600" : "text-green-600")}>{n > 0 ? `−${n}` : "0"}</span>;
    },
  },
  {
    key: "riskEtiketi",
    header: "Risk",
    sortable: true,
    render: (val) => <WorkforceRiskBadge risk={val as IsGucuRiskSeviyesi} />,
  },
];

const COLUMNS_SOZLESME_BITIS: ColumnDef<RaporSozlesmeBitisRow>[] = [
  { key: "sozlesmeAdi", header: "Sözleşme Adı", sortable: true },
  { key: "firmaAdi", header: "Firma", sortable: true },
  { key: "bitis", header: "Bitiş", sortable: true, render: (val) => formatDateTR(val as string) },
  {
    key: "kalanGun",
    header: "Kalan Gün",
    sortable: true,
    render: (val) => {
      const n = val as number;
      return (
        <span className={clsx(`${TYPE_BODY} font-medium`, n <= 15 ? "text-red-600" : n <= 30 ? "text-amber-600" : TEXT_BODY)}>
          {n} gün
        </span>
      );
    },
  },
  { key: "sorumlu", header: "Sorumlu" },
  {
    key: "hazirlikDurumu",
    header: "Hazırlık Durumu",
    render: (val) => (
      <span className={`${TYPE_BODY} ${(val as string) !== "—" ? "text-amber-600" : TEXT_SECONDARY}`}>
        {val as string}
      </span>
    ),
  },
  {
    key: "durum",
    header: "Durum",
    render: (val) => <StatusBadge status={val as RaporSozlesmeBitisRow["durum"]} />,
  },
];

const COLUMNS_TALEPLER: ColumnDef<RaporTalepRow>[] = [
  { key: "firmaAdi", header: "Firma", sortable: true },
  { key: "pozisyon", header: "Pozisyon", sortable: true },
  { key: "talepEdilen", header: "Talep Edilen", sortable: true },
  { key: "saglanan", header: "Sağlanan", sortable: true },
  {
    key: "acikKalan",
    header: "Açık Kalan",
    sortable: true,
    render: (val) => {
      const n = val as number;
      return <span className={clsx(`${TYPE_BODY} font-medium`, n > 0 ? "text-red-600" : "text-green-600")}>{n}</span>;
    },
  },
  {
    key: "oncelik",
    header: "Öncelik",
    sortable: true,
    render: (val) => <PriorityBadge priority={val as OncelikSeviyesi} />,
  },
  {
    key: "durum",
    header: "Durum",
    render: (val) => <StatusBadge status={val as RaporTalepRow["durum"]} />,
  },
];

const COLUMNS_RANDEVULAR: ColumnDef<RaporRandevuRow>[] = [
  { key: "tarih", header: "Tarih", sortable: true, render: (val) => formatDateTR(val as string) },
  { key: "firmaAdi", header: "Firma", sortable: true },
  { key: "gorusmeTipiLabel", header: "Görüşme Tipi" },
  { key: "katilimci", header: "Katılımcı" },
  {
    key: "durum",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as RaporRandevuRow["durum"]} />,
  },
  {
    key: "sonuc",
    header: "Sonuç",
    render: (val) => (
      <span className={`${TYPE_BODY} ${TEXT_SECONDARY} truncate max-w-[200px] block`}>
        {val as string}
      </span>
    ),
  },
];

const COLUMNS_RISKLI_FIRMA: ColumnDef<RaporRiskliFirmaRow>[] = [
  {
    key: "firmaAdi",
    header: "Firma",
    sortable: true,
    render: (val, row) => (
      <a href={`/firmalar/${row.firmaId}`} className={`${TYPE_BODY} ${TEXT_LINK} hover:underline`}>
        {val as string}
      </a>
    ),
  },
  {
    key: "risk",
    header: "Risk Seviyesi",
    sortable: true,
    render: (val) => <RiskBadge risk={val as RiskSeviyesi} />,
  },
  {
    key: "ticariBaskiOzet",
    header: "Ticari Baskı",
    render: (val) => (
      <span className={`${TYPE_BODY} ${(val as string) !== "—" ? "text-amber-600" : TEXT_SECONDARY}`}>
        {val as string}
      </span>
    ),
  },
  { key: "acikTalep", header: "Açık Talep", sortable: true },
  { key: "eksikEvrak", header: "Eksik Evrak", sortable: true },
];

const COLUMNS_PARTNER_OZET: ColumnDef<RaporPartnerOzetRow>[] = [
  {
    key: "partnerAdi",
    header: "Partner",
    render: (val, row) => (
      <span className={clsx(
        TYPE_BODY,
        row.rowType === "partner" ? `font-medium ${TEXT_BODY}` : TEXT_MUTED,
      )}>
        {(val as string) || ""}
      </span>
    ),
  },
  {
    key: "sehir",
    header: "Şehir",
    render: (val, row) => (
      <span className={clsx(
        TYPE_BODY,
        row.rowType !== "partner" ? `font-medium ${TEXT_PRIMARY}` : TEXT_BODY,
      )}>
        {val as string}
      </span>
    ),
  },
  { key: "firmaSayisi", header: "Firma" },
  { key: "isGucu", header: "İş Gücü" },
  { key: "acikTalep", header: "Açık Talep" },
  {
    key: "alacakYogunlugu",
    header: "Alacak Yoğunluğu",
    render: (val) => <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{val as string}</span>,
  },
  {
    key: "kesilmemisBaski",
    header: "Kesilmemiş Baskı",
    render: (val) => <span className={`${TYPE_BODY} text-amber-600`}>{val as string}</span>,
  },
  {
    key: "gecikmisYogunluk",
    header: "Gecikmiş Firma",
    render: (val, row) => {
      const n = val as number;
      return <span className={clsx(TYPE_BODY, n > 0 ? "text-red-600 font-medium" : TEXT_MUTED)}>{n > 0 ? `${n} firma` : "—"}</span>;
    },
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RaporlarPage() {
  const { role } = useRole();
  const allowedKeys = REPORT_ROLE_ACCESS[role] ?? [];
  const visibleReports = useMemo(
    () => ALL_REPORTS.filter((r) => allowedKeys.includes(r.key)),
    [allowedKeys]
  );
  const [activeKey, setActiveKey] = useState(() => visibleReports[0]?.key ?? "");
  const raporTalepler = getRaporTalepler();
  const raporRandevular = getRaporRandevular();
  const raporRiskliFirmalar = getRaporRiskliFirmalar();
  const raporPartnerOzet = getRaporPartnerOzet();

  return (
    <>
      <PageHeader title="Raporlar" subtitle="Operasyonel raporlar" />

      <div className="space-y-4">
        <ReportSwitcher
          reports={visibleReports}
          activeKey={activeKey}
          onSwitch={setActiveKey}
        />

        <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Dönem: Mart 2026</p>

        {activeKey === "is-gucu" && (
          <DataTable<RaporIsGucuRow>
            columns={COLUMNS_IS_GUCU}
            data={RAPOR_IS_GUCU}
            rowKey="firmaId"
            emptyTitle="İş gücü verisi yok"
          />
        )}

        {activeKey === "sozlesme-bitis" && (
          <DataTable<RaporSozlesmeBitisRow>
            columns={COLUMNS_SOZLESME_BITIS}
            data={RAPOR_SOZLESME_BITIS}
            rowKey="sozlesmeAdi"
            emptyTitle="Yaklaşan sözleşme yok"
          />
        )}

        {activeKey === "talep-analizi" && (
          <DataTable<RaporTalepRow>
            columns={COLUMNS_TALEPLER}
            data={raporTalepler}
            rowKey="pozisyon"
            emptyTitle="Talep verisi yok"
          />
        )}

        {activeKey === "randevu-sonuc" && (
          <DataTable<RaporRandevuRow>
            columns={COLUMNS_RANDEVULAR}
            data={raporRandevular}
            rowKey="tarih"
            emptyTitle="Randevu verisi yok"
          />
        )}

        {activeKey === "riskli-firma" && (
          <DataTable<RaporRiskliFirmaRow>
            columns={COLUMNS_RISKLI_FIRMA}
            data={raporRiskliFirmalar}
            rowKey="firmaId"
            emptyTitle="Riskli firma yok"
          />
        )}

        {activeKey === "partner-ozet" && (
          <DataTable<RaporPartnerOzetRow>
            columns={COLUMNS_PARTNER_OZET}
            data={raporPartnerOzet}
            rowKey="id"
            emptyTitle="Partner verisi yok"
            pageSize={30}
          />
        )}
      </div>
    </>
  );
}
