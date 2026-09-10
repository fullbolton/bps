"use client";

import { useState } from "react";
import FilterBar from "@/components/ui/FilterBar";
import type { FilterValues } from "@/types/ui";

export default function FilterBarAcceptance() {
  const [values, setValues] = useState<FilterValues>({ firma: "", tarih: "" });
  const [available, setAvailable] = useState(true);
  const [submits, setSubmits] = useState(0);
  return <div className="space-y-5">
    <form onSubmit={event => { event.preventDefault(); setSubmits(value => value + 1); }}>
      <FilterBar values={values} onChange={setValues} filters={[
        { key: "firma", label: "Kabul firması", type: "select", placeholder: "Tüm firmalar", options: available ? [{ value: "A", label: "Firma A" }] : [] },
        { key: "tarih", label: "Kabul tarihi", type: "date" },
      ]} />
    </form>
    <button type="button" onClick={() => setAvailable(value => !value)}>Seçenekleri değiştir</button>
    <p data-testid="filter-value">{values.firma || "boş"}</p>
    <p data-testid="submit-count">{submits}</p>
    <FilterBar values={{ durum: "" }} onChange={() => {}} filters={[{ key: "durum", label: "Diğer durum", type: "select", options: [] }]} />
  </div>;
}
