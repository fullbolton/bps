"use client";
import { useRef, useState } from "react";
import { IMPORT_MAX_BYTES, parseLocationCsv, type LocationRow } from "@/lib/operations/location-import";
import { reserveCommand,acknowledgeCommand,type CommandScope } from "@/lib/operations/pending-commands";
import { pilotImportAction } from "./actions";

export default function LocationImport({companyId,scope,disabled,onBusy,onComplete,onPendingChange}:{companyId:string;scope:CommandScope|null;disabled:boolean;onBusy:(busy:boolean)=>void;onComplete:()=>Promise<void>;onPendingChange:()=>void}) {
  const [rows,setRows]=useState<LocationRow[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [reading,setReading]=useState(false);
  const submitting=useRef(false);
  const sequence=useRef(0);
  async function preview(file?:File) {
    const ticket=++sequence.current;
    setRows([]);setMessage("");
    if(!file){setReading(false);return;}
    setReading(true);
    try {
      if(file.size>IMPORT_MAX_BYTES)throw new Error("Dosya 256 KiB sınırını aşıyor.");
      const buffer=await file.arrayBuffer();
      const parsed=parseLocationCsv(new TextDecoder("utf-8",{fatal:true}).decode(buffer));
      if(ticket!==sequence.current)return;
      setRows(parsed);
    } catch(e){if(ticket===sequence.current)setMessage(e instanceof Error?e.message:"Dosya okunamadı.");}
    finally{if(ticket===sequence.current)setReading(false);}
  }
  async function submit() {
    if(!scope||disabled||busy||submitting.current||!rows.length)return;
    submitting.current=true;
    setBusy(true);onBusy(true);setMessage("");
    try {
      const command=await reserveCommand(scope,"location_import",{companyId,rows},localStorage,navigator.locks);
      onPendingChange();
      const result=await pilotImportAction(command,companyId,rows,scope);
      if(!result.ok){setMessage(result.message);return;}
      let saved=`${result.data.added} şube eklendi, ${result.data.skipped} aynı kayıt atlandı.`;
      try{await acknowledgeCommand(scope,command,localStorage,navigator.locks);onPendingChange();}
      catch{saved+=" Bekleyen işaret kaldırılamadı; aynı aktarım tekrarlandığında ikinci kayıt oluşmaz.";}
      setMessage(saved);
      setRows([]);await onComplete();
    } catch(e){setMessage(e instanceof Error?e.message:"Sonuç alınamadı. Aynı CSV’yi tekrar yükleyerek işlemi kontrol edin.");}
    finally{submitting.current=false;setBusy(false);onBusy(false);}
  }
  return <details className="mb-5 rounded-xl border bg-white p-4">
    <summary className="cursor-pointer font-medium">Şubeleri toplu aktar</summary>
    <p className="mt-3 text-sm text-slate-600">UTF-8 CSV: şube kodu, şube adı ve il. En fazla 500 şube. Aynı kod ve içerik atlanır; değişmiş içerik aktarımı durdurur. Kodlar büyük/küçük harfe duyarlıdır.</p>
    <a className="my-3 inline-block text-sm underline" href="/templates/import_template_locations.csv" download>Örnek şablonu indir</a>
    <label className="block text-sm">Şube dosyası<input className="my-2 block" type="file" accept=".csv,text/csv" disabled={disabled||busy||reading} onChange={e=>void preview(e.target.files?.[0])}/></label>
    {reading&&<p role="status">Dosya okunuyor…</p>}
    {message&&<p role="status" className="my-3 text-sm">{message}</p>}
    {!!rows.length&&<><p className="my-2 text-sm">{rows.length} satır doğrulandı. Aşağıda ilk 20 satır gösteriliyor. Mevcut kayıtlarla son kontrol aktarım sırasında yapılır.</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Şube kodu</th><th>Şube adı</th><th>İl</th></tr></thead><tbody>{rows.slice(0,20).map(r=><tr key={r.code}><td className="py-1">{r.code}</td><td>{r.name}</td><td>{r.city}</td></tr>)}</tbody></table></div>
      <button className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40" disabled={disabled||busy||reading} onClick={()=>void submit()}>{busy?"Aktarılıyor…":`${rows.length} şubeyi aktar`}</button>
    </>}
  </details>;
}
