"use client";
import {useEffect,useRef,useState} from 'react';
import {DOCUMENT_FOLDERS} from '@/lib/document-folders';
import {DOCUMENT_CATEGORY_LABELS,type DocumentCategory} from '@/lib/document-categories';
import {changeDocumentCategory} from '@/lib/services/documents';
import {createClient} from '@/lib/supabase/client';
import type {DocumentRow} from '@/types/database.types';
export default function DocumentCategoryEditor({row,onSaved}:{row:DocumentRow;onSaved:()=>void}){
  const [category,setCategory]=useState<DocumentCategory>(row.category),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const flight=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  if(row.contract_id)return <p className="rounded-lg bg-blue-50 p-3 text-sm">Bu belge bir sözleşmeye bağlıdır ve Sözleşmeler klasöründe tutulur.</p>;
  return <form className="space-y-3 rounded-xl border p-4" onSubmit={async event=>{
    event.preventDefault();if(flight.current||category===row.category)return;
    flight.current=true;setBusy(true);setError('');
    try{await changeDocumentCategory(createClient(),row,category);if(mounted.current)onSaved();}
    catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Taşıma sonucu alınamadı. Listeyi yenileyin.');}
    finally{flight.current=false;if(mounted.current)setBusy(false);}
  }} aria-busy={busy}>
    <label className="block text-sm font-medium">Klasör / belge türü<select disabled={busy} value={category} onChange={e=>setCategory(e.target.value as DocumentCategory)} className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3">{DOCUMENT_FOLDERS.map(folder=><optgroup key={folder.id} label={folder.name}>{folder.categories.map(key=><option key={key} value={key}>{DOCUMENT_CATEGORY_LABELS[key]}</option>)}</optgroup>)}</select></label>
    <p className="text-xs text-slate-500">İmza sirküleri ve ticaret sicil evrakları için Firma / Yetki Belgesi seçin. Dosya adı belgenin ayrıntılı türünü belirtir.</p>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <button disabled={busy||category===row.category} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-40">{busy?'Kaydediliyor…':'Klasöre taşı'}</button>
  </form>;
}
