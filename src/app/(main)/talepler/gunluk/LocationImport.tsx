"use client";
import { useEffect, useRef, useState, type RefObject, type MouseEventHandler } from "react";
import Link from "next/link";
import { IMPORT_MAX_BYTES, parseLocationCsv, type LocationRow } from "@/lib/operations/location-import";
import { reserveCommand,acknowledgeCommand,commandDigest,type DraftRecovery,type DraftCheck,type CommandScope } from "@/lib/operations/pending-commands";
import type {LocationImportPreview} from "@/lib/operations/location-import-preview";
import { pilotImportPreviewAction,pilotImportAction } from "./actions";

export default function LocationImport({companyId,scope,disabled,onBusy,onComplete,onPendingChange,reconcileRef,dirtyRef,onNavigate}:{onNavigate:MouseEventHandler<HTMLAnchorElement>;dirtyRef:RefObject<DraftCheck|null>;reconcileRef:RefObject<DraftRecovery|null>;companyId:string;scope:CommandScope|null;disabled:boolean;onBusy:(busy:boolean)=>void;onComplete:()=>Promise<void>;onPendingChange:()=>void}) {
  const [rows,setRows]=useState<LocationRow[]>([]);
  const [comparison,setComparison]=useState<LocationImportPreview|null>(null);
  const [filter,setFilter]=useState<"all"|"blocked">("all");
  const [page,setPage]=useState(0);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [reading,setReading]=useState(false);
  const submitting=useRef(false);
  const sequence=useRef(0),fileInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    let current=true;
    reconcileRef.current=async digests=>{
      const ticket=sequence.current;
      if(!rows.length)return;
      const digest=await commandDigest("location_import",{companyId,rows});
      if(current&&ticket===sequence.current&&digests.includes(digest)){
        sequence.current++;setRows([]);setComparison(null);if(fileInput.current)fileInput.current.value="";
        setMessage("Bu şube aktarımının sonucu kesinleşti. Aynı dosya önizlemesi temizlendi.");
      }
    };
    return()=>{current=false;reconcileRef.current=null;};
  },[rows,companyId,reconcileRef]);
  useEffect(()=>{
    dirtyRef.current=()=>reading||rows.length>0||!!fileInput.current?.files?.length;
    return()=>{dirtyRef.current=null;};
  },[rows,reading,dirtyRef]);
  useEffect(()=>()=>{sequence.current++;},[]);
  async function preview(file?:File) {
    const ticket=++sequence.current;
    setRows([]);setComparison(null);setMessage("");
    if(!file){setReading(false);return;}
    setReading(true);
    try {
      if(file.size>IMPORT_MAX_BYTES)throw new Error("Dosya 256 KiB sınırını aşıyor.");
      const buffer=await file.arrayBuffer();
      const parsed=parseLocationCsv(new TextDecoder("utf-8",{fatal:true}).decode(buffer));
      if(ticket!==sequence.current)return;
      setRows(parsed);
      await compareRows(parsed,ticket);
    } catch(e){if(ticket===sequence.current)setMessage(e instanceof Error?e.message:"Dosya okunamadı.");}
    finally{if(ticket===sequence.current)setReading(false);}
  }
  async function compareRows(parsed:LocationRow[],ticket:number){
    if(!scope)throw new Error("Şirket bilgisi henüz hazır değil. Biraz bekleyip yeniden karşılaştırın.");
    const result=await pilotImportPreviewAction(companyId,parsed,scope);
    if(ticket!==sequence.current)return;
    if(!result.ok)throw new Error(result.message);
    setComparison(result.data);setFilter("all");setPage(0);
  }
  async function refreshComparison(){
    if(!scope||disabled||reading||busy||submitting.current||!rows.length)return;
    const ticket=++sequence.current;
    setComparison(null);setReading(true);setMessage("");
    try{await compareRows(rows,ticket);}
    catch(e){if(ticket===sequence.current)setMessage(e instanceof Error?e.message:"Karşılaştırma tamamlanamadı.");}
    finally{if(ticket===sequence.current)setReading(false);}
  }
  async function submit() {
    if(!scope||disabled||busy||reading||submitting.current||!rows.length||!comparison||comparison.blockedCount>0)return;
    submitting.current=true;
    setBusy(true);onBusy(true);setMessage("");
    try {
      const command=await reserveCommand(scope,"location_import",{companyId,rows},localStorage,navigator.locks);
      onPendingChange();
      const result=await pilotImportAction(command,companyId,rows,scope);
      if(!result.ok){setMessage(result.message);setComparison(null);return;}
      let saved=`${result.data.added} şube eklendi, ${result.data.skipped} aynı kayıt atlandı.`;
      try{await acknowledgeCommand(scope,command,localStorage,navigator.locks);onPendingChange();}
      catch{saved+=" Bekleyen işaret kaldırılamadı; aynı aktarım tekrarlandığında ikinci kayıt oluşmaz.";}
      setMessage(saved);
      sequence.current++;setRows([]);setComparison(null);if(fileInput.current)fileInput.current.value="";await onComplete();
    } catch(e){setMessage(e instanceof Error?e.message:"Sonuç alınamadı. Aynı CSV’yi tekrar yükleyerek işlemi kontrol edin.");}
    finally{submitting.current=false;setBusy(false);onBusy(false);}
  }
  return <details className="mb-5 rounded-xl border bg-white p-4">
    <summary className="cursor-pointer font-medium">Şubeleri toplu aktar</summary>
    <p className="mt-3 text-sm text-slate-600">UTF-8 CSV: şube kodu, şube adı ve il. En fazla 500 şube. Aynı kod ve içerik atlanır; değişmiş içerik aktarımı durdurur. Kodlar büyük/küçük harfe duyarlıdır.</p>
    <a className="my-3 inline-block text-sm underline" href="/templates/import_template_locations.csv" download>Örnek şablonu indir</a>
    <label className="block text-sm">Şube dosyası<input ref={fileInput} className="my-2 block" type="file" accept=".csv,text/csv" disabled={disabled||busy||reading||!scope} onClick={e=>{e.currentTarget.value="";}} onChange={e=>void preview(e.target.files?.[0])}/></label>
    {reading&&<p role="status">Dosya ve mevcut şube sicili karşılaştırılıyor…</p>}
    {message&&<p role="status" className="my-3 text-sm">{message}</p>}
    {!!rows.length&&<>
      <button type="button" className="my-3 min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-40" disabled={disabled||busy||reading||!scope} onClick={()=>void refreshComparison()}>{reading?"Karşılaştırılıyor…":"Sicille yeniden karşılaştır"}</button>
      {!comparison&&<p className="my-3 text-sm">Sicil karşılaştırması tamamlanmadan aktarım açılamaz. Dosyayı yeniden seçmeden karşılaştırmayı tekrar deneyebilirsiniz.</p>}
      {comparison&&<>
        <p className="my-3 text-sm" role="status">{comparison.newCount} yeni · {comparison.sameCount} aynı · {comparison.blockedCount} inceleme gerekli</p>
        <p className="my-2 text-sm text-slate-600">Bu ön karşılaştırmadır; kayıt sırasında yeniden kontrol edilir. Dosyada olmayan şubeler silinmez. Farklı bilgiler otomatik güncellenmez.</p>
        {comparison.blockedCount>0&&<p role="alert" className="my-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Aktarım kapalı: farklı bilgileri dosyada düzeltin; pasif şubeyi gerekiyorsa dizinden inceleyin. Aşağıda mevcut ve dosyadaki değerleri karşılaştırabilirsiniz.</p>}
        <label className="my-3 block text-sm">Göster<select className="ml-2 rounded-lg border p-2" value={filter} onChange={e=>{setFilter(e.target.value as typeof filter);setPage(0);}}><option value="all">Tüm satırlar</option><option value="blocked">İnceleme gerekenler</option></select></label>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Şube dosyası ve kayıtlı sicil karşılaştırması</caption><thead><tr><th scope="col">Kod</th><th scope="col">Dosyadaki bilgi</th><th scope="col">Kayıtlı bilgi</th><th scope="col">Sonuç</th></tr></thead><tbody>{comparison.rows.filter(r=>filter==='all'||r.status==='changed'||r.status==='inactive').slice(page*20,page*20+20).map(r=><tr key={r.code} className="border-t"><td className="py-3 pr-3">{r.code}</td><td className="pr-3">{r.name} · {r.city}</td><td className="pr-3">{r.previous?`${r.previous.name} · ${r.previous.city}${r.previous.active?'':' · Pasif'}`:'—'}</td><td>{{new:'Yeni eklenecek',same:'Aynı; atlanacak',changed:'Bilgisi farklı',inactive:'Pasif kayıt'}[r.status]}{(r.status==='changed'||r.status==='inactive')&&<Link onClick={onNavigate} aria-label={`${r.code} kodlu şubenin kaydını aç`} className="mt-1 flex min-h-11 items-center font-medium text-blue-700 underline underline-offset-2" href={`/talepler/dizin?${new URLSearchParams({firma:companyId,ara:r.code})}`}>Şube kaydını aç</Link>}</td></tr>)}</tbody></table></div>
        <div className="my-3 flex items-center gap-3 text-sm"><button className="min-h-11 rounded-lg border px-3 disabled:opacity-40" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Önceki</button><span>Sayfa {page+1}</span><button className="min-h-11 rounded-lg border px-3 disabled:opacity-40" disabled={(page+1)*20>=comparison.rows.filter(r=>filter==='all'||r.status==='changed'||r.status==='inactive').length} onClick={()=>setPage(p=>p+1)}>Sonraki</button></div>
      </>}
      <button className="mt-3 min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40" disabled={disabled||busy||reading||!comparison||comparison.blockedCount>0} onClick={()=>void submit()}>{busy?"Aktarılıyor…":comparison?`${comparison.newCount} yeni şubeyi aktar · ${comparison.sameCount} aynı kaydı atla`:"Karşılaştırma bekleniyor"}</button>
    </>}
  </details>;
}
