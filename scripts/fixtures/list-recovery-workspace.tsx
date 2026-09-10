"use client";

import { useRef, useState } from "react";
import SearchInput, { type SearchInputHandle } from "@/components/ui/SearchInput";
import DataTable from "@/components/ui/DataTable";

export default function ListRecoveryAcceptance() {
  const control = useRef<SearchInputHandle>(null);
  const [search, setSearch] = useState("");
  const [calls, setCalls] = useState(0);
  const [submits, setSubmits] = useState(0);
  return <form onSubmit={event => { event.preventDefault(); setSubmits(value => value + 1); }}>
    <SearchInput ref={control} value={search} placeholder="Bekleyen arama" debounceMs={3000}
      onChange={value => { setSearch(value); setCalls(count => count + 1); }} />
    <DataTable<{id: string}> columns={[{key:"id",header:"Kayıt"}]} data={[]} rowKey="id"
      emptyAction={{label:"Arama ve filtreleri temizle",onClick:()=>control.current?.clear()}} />
    <p data-testid="callback-count">{calls}</p><p data-testid="submit-count">{submits}</p>
  </form>;
}
