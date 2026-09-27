'use client';
import {differenceLabels} from '@/lib/talent/import-fields';
import type {ComparedRow} from '@/lib/talent/import-compare';
import type {ImportDecision,DecisionRow} from '@/lib/talent/import-decisions';

export default function RowDecision({row,value,review,onChange}:{row:ComparedRow;value:ImportDecision|undefined;review:DecisionRow;onChange:(d:ImportDecision|undefined)=>void}){
 const blocked=!!row.issues.length||row.moreCandidates;
 const candidate=value?.kind==='existing'?row.candidates.find(c=>c.person.id===value.personId):null;
 return <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-3">
  {!!row.warnings?.length&&<ul className="mb-3 space-y-1 text-sm text-slate-600">{row.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul>}
  <label className="block font-medium">Satır {row.number} için ne yapılsın?
   <select className="mt-2 min-h-11 w-full min-w-0 rounded-xl border bg-white px-3 text-sm" value={value?.kind==='existing'?value.personId:value?.kind??''} onChange={e=>{const v=e.target.value;onChange(!v?undefined:v==='hold'?{kind:'hold'}:v==='new'?{kind:'new'}:{kind:'existing',personId:v,changes:[]});}}>
    <option value="">İşlem seçin</option><option value="hold">Şimdilik aktarma</option>
    {!blocked&&!row.candidates.length&&<option value="new">Yeni kişi olarak eklensin</option>}
    {!blocked&&row.candidates.map((c,i)=><option key={c.person.id} value={c.person.id}>Aynı kişi olduğunu doğruladım: {c.person.name} · {c.person.city||'İl yok'} · eşleşme {i+1}</option>)}
   </select>
  </label>
  {blocked&&<p className="mt-2 text-xs text-amber-900">Bu satır şu haliyle aktarılamaz. “Şimdilik aktarma” seçeneğini kullanın veya dosyayı düzeltip yeniden yükleyin. Yeniden yüklediğinizde bu ekrandaki seçimleri tekrar yapmanız gerekir.</p>}
  {candidate&&value?.kind==='existing'&&<fieldset className="mt-3 space-y-2"><legend className="text-sm font-medium">Kayıtlı kişinin hangi bilgileri güncellensin?</legend><p className="text-xs text-slate-600">Yalnız işaretlediğiniz bilgiler aktarımı başlattığınızda güncellenir. Diğer bilgiler korunur.</p>
   {candidate.differences.map((d,i)=><label key={i} className="flex min-h-11 items-start gap-3 rounded-lg bg-white p-3 text-sm"><input type="checkbox" className="mt-1 shrink-0" checked={value.changes.includes(i)} onChange={e=>onChange({...value,changes:e.target.checked?[...value.changes,i]:value.changes.filter(n=>n!==i)})}/><span className="min-w-0 break-words"><strong>{d.contactKind==='phone'?'Telefon ekle':d.contactKind==='email'?'E-posta ekle':differenceLabels[d.field]}</strong><span className="mt-1 block">BPS: {d.before}</span><span className="mt-1 block">Dosya: {d.after}</span></span></label>)}
   {!value.changes.length&&<p className="text-xs text-slate-600">Aktarımı başlattığınızda bu kişiyle eşleştirilecek; kayıtlı bilgileri değişmeyecek.</p>}
  </fieldset>}
  {!!review.problems.length&&<ul role="alert" className="mt-3 space-y-1 text-sm text-red-800">{review.problems.map(p=><li key={p}>{p}</li>)}</ul>}
 </div>;
}
