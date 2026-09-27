import {importContacts} from './import-contacts';
import {compareSourcePeople,contactKey,type CompareSnapshot,type SourcePerson,type ComparedRow} from './import-compare';
import {extendedPersonFields,importList} from './import-fields';
import {normal} from './import-preview';
import {emptyPerson,validatePersonInput,type Contact} from './people';

export type ImportDecision={kind:'hold'}|{kind:'new'}|{kind:'existing';personId:string;changes:number[]};
export type DecisionMap=Record<number,ImportDecision>;
export type DecisionRow={number:number;kind:'unresolved'|'hold'|'new'|'update'|'unchanged';problems:string[];targetId?:string;expectedRevision?:number;patch?:{name?:string;city?:string;district?:string;skills?:string;regions?:string;addContacts?:Contact[]}};

/** Browser-only review plan, never an authorization or a server write payload. */
export function reviewImportDecisions(rows:SourcePerson[],snapshot:CompareSnapshot,decisions:DecisionMap,compared:ComparedRow[]=compareSourcePeople(rows,snapshot)){
 const sourceNumbers=new Set(rows.map(r=>String(r.number)));
 if(sourceNumbers.size!==rows.length||Object.keys(decisions).some(k=>!sourceNumbers.has(k))||compared.length!==rows.length||compared.some((r,i)=>r.number!==rows[i].number))throw Error('TALENT_DECISION_SOURCE');
 const result:DecisionRow[]=rows.map((r,i)=>{
  const d=decisions[r.number],c=compared[i];
  const fail=(message:string):DecisionRow=>({number:r.number,kind:'unresolved',problems:[message]});
  if(!d)return {number:r.number,kind:'unresolved',problems:[]};
  if(d.kind==='hold')return {number:r.number,kind:'hold',problems:[]};
  if(r.issues.length||c.issues.length||c.moreCandidates)return fail('Kaynak sorunlarını düzeltin veya satırı bekletin.');
  try{validatePersonInput({...emptyPerson,name:r.name,city:r.city||null,...extendedPersonFields(r),contacts:importContacts(r)});}catch{return fail('Kişi alanları kayıt kurallarına uygun değil.');}
  if(d.kind==='new')return c.candidates.length?fail('Olası eşleşme varken yeni kişi kararı verilemez; eşleştirin veya bekletin.'):{number:r.number,kind:'new',problems:[]};
  if(d.kind!=='existing')return fail('Geçersiz satır kararı.');
  const candidate=c.candidates.find(p=>p.person.id===d.personId);
  if(!candidate||!Array.isArray(d.changes)||new Set(d.changes).size!==d.changes.length||d.changes.some(n=>!Number.isInteger(n)||n<0||n>=candidate.differences.length))return fail('Seçilen kişi veya alan kararı bu karşılaştırmada yok.');
  if(d.changes.length&&candidate.person.revision>=2147483647)return fail('Kayıt sürüm sınırında; bu satırı bekletin.');
  const patch:NonNullable<DecisionRow['patch']>={};
  for(const n of d.changes){const diff=candidate.differences[n];if(diff.field==='contacts'){
   if(!diff.contactKind)return fail('İletişim türü doğrulanamadı. Karşılaştırmayı yenileyin.');
   patch.addContacts=[...(patch.addContacts??[]),...importContacts({phone:'',email:'',[diff.contactKind]:diff.after})];
  }else patch[diff.field]=diff.after;}
  for(const field of ['skills','regions'] as const)if(patch[field]&&new Set([...(candidate.person[field]??[]),...importList(patch[field])]).size>20)return fail('Meslek veya bölge sayısı 20 sınırını aşıyor; seçimi azaltın.');
  if(candidate.person.contacts.length+(patch.addContacts?.length??0)>10)return fail('Bu seçim 10 iletişim bilgisi sınırını aşıyor; ekleme seçimini kaldırın veya satırı bekletin.');
  return {number:r.number,kind:d.changes.length?'update':'unchanged',targetId:d.personId,expectedRevision:candidate.person.revision,patch,problems:[]};
 });
 const people=new Map(snapshot.rows.map(p=>[p.id,p]));
 const groups=new Map<string,Set<number>>();
 const add=(key:string,i:number)=>{const group=groups.get(key)??new Set<number>();group.add(i);groups.set(key,group);};
 result.forEach((r,i)=>{
  if(r.targetId){
   add('target:'+r.targetId,i);
   const p=people.get(r.targetId)!;
   add('name:'+normal(r.patch?.name??p.name),i);
   for(const contact of [...p.contacts,...(r.patch?.addContacts??[])])add(contactKey(contact),i);
  }
  if(r.kind==='new'){
   add('name:'+normal(rows[i].name),i);
   for(const c of importContacts(rows[i]))add(contactKey(c),i);
  }
 });
 for(const [key,indices]of groups)if(indices.size>1&&(key.startsWith('target:')||[...indices].some(i=>result[i].kind==='new')))for(const i of indices)result[i].problems.push(key.startsWith('target:')?'Birden fazla kaynak satırı aynı kişiye seçildi. Tek satır bırakın; diğerlerini bekletin.':'Yeni kişi kararı başka bir satırın sonucuyla isim veya iletişim paylaşıyor. Mükerrer oluşturmayı önlemek için satırları inceleyin.');
 const counts={unresolved:0,hold:0,new:0,update:0,unchanged:0};
 for(const r of result){counts[r.kind]++;r.problems=[...new Set(r.problems)];}
 return {rows:result,counts,conflicts:result.filter(r=>r.problems.length).length,ready:result.length>0&&counts.unresolved===0&&result.every(r=>!r.problems.length)};
}
