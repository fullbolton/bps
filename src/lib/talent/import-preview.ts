import {contactKey,importContacts} from './import-contacts';
import {extendedPersonFields} from './import-fields';
import {emptyPerson,validatePersonInput} from './people';
import {isUuid} from '@/lib/operations/pilot-validation';
/** Read-only source preview. No person merging, current availability or attendance inference. */
export type SourceCell={value:string;issue?:'formula'|'error'};
export type SourceSheet={name:string;hidden:boolean;rows:{number:number;cells:SourceCell[]}[]};
export type SourceBook={sheets:SourceSheet[]};
export type ImportKind='people'|'coverage';
export const importFields={personId:'BPS kişi kimliği',tenantId:'BPS şirket kimliği',name:'Personel / yerine gelen kişi',phone:'Telefonlar',email:'E-postalar',city:'Kişinin ikamet ili',district:'İkamet ilçesi',skills:'Meslekler / beceriler',regions:'Çalışabileceği bölgeler',branch:'Talep eden şube / birim',original:'İzinli / asıl personel bilgisi',start:'Dönem başlangıcı',end:'Dönem bitişi',status:'Kaynak görev durumu',reply:'Kaynak talep cevabı'} as const;
export type ImportField=keyof typeof importFields;
export type Mapping=Partial<Record<ImportField,number>>;
export const normal=(v:string)=>v.normalize('NFKC').toLocaleLowerCase('tr-TR').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const aliases:Record<ImportField,string[]>={personId:['bps kisi kimligi'],tenantId:['bps sirket kimligi'],name:['ad soyad','adi soyadi','personel adi','yerine gidecek ogg'],phone:['telefonlar','telefon','gsm','telefon numarasi'],email:['e postalar','e posta','eposta','email'],city:['ikamet ili','ikamet sehir'],district:['ikamet ilcesi','ilce'],skills:['meslekler beceriler','meslek','meslekler','beceriler'],regions:['calisabilecegi bolgeler','calisma bolgeleri'],branch:['talepte bulunan personel birim sube','sube','talep eden sube'],original:['izin talebinde bulunan ogg','asil personel'],start:['izin baslangic','izin baslangic tarihi','baslangic tarihi'],end:['izin bitis','izin bitis tarihi','bitis tarihi'],status:['durum'],reply:['talep cevap']};
export function suggestMapping(headers:string[],kind:ImportKind):Mapping{
 const result:Mapping={};for(const key of Object.keys(importFields)as ImportField[]){if(kind==='people'&&['branch','original','start','end','status','reply'].includes(key)||kind==='coverage'&&['city','district','skills','regions'].includes(key))continue;const matches=headers.flatMap((h,i)=>aliases[key].includes(normal(h))?[i]:[]);if(matches.length===1)result[key]=matches[0];}return result;
}
export function sourceDate(value:string):string|null{
 const v=value.trim();let m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v),y:number,month:number,d:number;
 if(m){[,y,month,d]=m.map(Number);}else{m=/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(v);if(!m)return null;d=+m[1];month=+m[2];y=+m[3];}
 if(y<1950||y>2100)return null;const date=new Date(Date.UTC(y,month-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===month-1&&date.getUTCDate()===d?`${y}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`:null;
}
export function previewSource(sheet:SourceSheet,headerRow:number,kind:ImportKind,mapping:Mapping){
 const header=sheet.rows.find(r=>r.number===headerRow);if(!header)throw Error('Başlık satırını seçin.');
 for(const key of ['personId','tenantId'] as const){
  const columns=header.cells.flatMap((cell,index)=>aliases[key].includes(normal(cell.value))?[index]:[]);
  if(columns.length>1||columns.length===1&&mapping[key]!==columns[0])throw Error('BPS kimlik sütunları atlanamaz veya başka bir sütuna eşlenemez.');
 }
 for(const key of (kind==='coverage'?['name','branch','start','end']:['name'])as ImportField[])if(mapping[key]===undefined)throw Error(`${importFields[key]} sütununu eşleyin.`);
 const entries=Object.entries(mapping)as [ImportField,number][];
 if(new Set(entries.map(([,v])=>v)).size!==entries.length||entries.some(([k,v])=>!(k in importFields)||!Number.isInteger(v)||v<0||v>=header.cells.length))throw Error('Her alan için farklı ve geçerli bir sütun seçin.');
 if(kind==='coverage'&&['city','district','skills','regions'].some(k=>mapping[k as ImportField]!==undefined))throw Error('Şubenin ili kişinin ikameti olarak eşlenemez.');
 const seen=new Map<string,number>(),names=new Map<string,number>(),phones=new Map<string,Set<string>>(),emails=new Map<string,Set<string>>();
 const rows=sheet.rows.filter(r=>r.number>headerRow).map(r=>{
  const get=(k:ImportField)=>mapping[k]===undefined?'':r.cells[mapping[k]!]?.value.trim()??'';
  const name=get('name'),phone=get('phone'),issues:string[]=[],warnings:string[]=[];
  const personId=get('personId'),tenantId=get('tenantId');
  if((personId||tenantId)&&(!isUuid(personId)||!isUuid(tenantId)))issues.push('BPS kişi ve şirket kimlikleri birlikte, geçerli biçimde bulunmalı. Yeni kişi için ikisini de boş bırakın.');
  if(!name||['yok','bos','personel','bekleniyor','?'].includes(normal(name))||!/[a-zçğıöşü]/i.test(name))issues.push('Kişi adı eksik veya yer tutucu olabilir.');
  if(entries.some(([,index])=>r.cells[index]?.issue))issues.push('Eşlenen alanda formül veya hatalı hücre var; kaynak değeri kontrol edin.');
  if(r.cells.some((c,index)=>c.issue&&!entries.some(([,mapped])=>mapped===index)))warnings.push('Eşlenmeyen sütundaki formül veya hatalı hücre aktarılmayacak.');
  let contacts:ReturnType<typeof importContacts>=[];
  try{contacts=importContacts({phone,email:get('email')});}catch{issues.push('Telefon/e-posta bilgilerini kontrol edin: değerleri noktalı virgülle ayırın, arada boş öğe bırakmayın; toplam en fazla 10 iletişim olabilir.');}
  if(!phone&&!get('email'))warnings.push('İletişim bilgisi yok; kişi yalnız mevcut bilgileriyle oluşturulabilir.');
  if(name.length>160||/[\u0000-\u001f\u007f]/.test(name))issues.push('Ad soyad en fazla 160 karakter olmalı ve kontrol karakteri içermemeli.');
  if(get('city').length>80||/[\u0000-\u001f\u007f]/.test(get('city')))issues.push('İkamet ili en fazla 80 karakter olmalı ve kontrol karakteri içermemeli.');
  if(kind==='people')try{validatePersonInput({...emptyPerson,name:name||'Kontrol',...extendedPersonFields({district:get('district'),skills:get('skills'),regions:get('regions')})});}catch{issues.push('İlçe en fazla 80 karakter; meslek ve bölge listeleri noktalı virgülle ayrılmış, boş öğe içermeyen en fazla 20 değer olmalı (her biri en fazla 80 karakter).');}
  const start=sourceDate(get('start')),end=sourceDate(get('end'));
  if(kind==='coverage'){
   if(!get('branch'))issues.push('Şube / birim eksik.');
   if(!start||!end)issues.push('Dönem tarihi eksik veya geçersiz.');else if(end<start)issues.push('Bitiş başlangıçtan önce.');else if((Date.parse(end)-Date.parse(start))/86400000>90)issues.push('Dönem 90 günden uzun; çalışma günleri ayrıca incelenmeli.');
   if(get('status')&&!['havuz','devam'].includes(normal(get('status'))))issues.push('Görev durumu tanınmıyor.');
   if(get('reply')&&normal(get('reply'))!=='ok')issues.push('Talep cevabı incelenmeli.');
  }
  const fingerprint=JSON.stringify(r.cells);if(seen.has(fingerprint))issues.push(`Okunan hücre değerleri kaynak satırı ${seen.get(fingerprint)} ile aynı; silinmedi.`);else seen.set(fingerprint,r.number);
  const n=normal(name);if(n){names.set(n,(names.get(n)??0)+1);for(const c of contacts){const map=c.kind==='phone'?phones:emails,key=contactKey(c),group=map.get(key)??new Set<string>();group.add(n);map.set(key,group);}}

  return {...(personId?{personId}:{}),...(tenantId?{tenantId}:{}),number:r.number,name,phone,email:get('email'),city:get('city'),...(mapping.district!==undefined?{district:get('district')}:{}),...(mapping.skills!==undefined?{skills:get('skills')}:{}),...(mapping.regions!==undefined?{regions:get('regions')}:{}),branch:get('branch'),original:get('original'),start:get('start'),end:get('end'),status:normal(get('status'))==='devam'?'Görevde (kaynak)':normal(get('status'))==='havuz'?'Havuza döndü (kaynak)':get('status'),reply:normal(get('reply'))==='ok'?'Karşılandı / müşteri bilgilendirildi (kaynak)':get('reply'),issues,warnings};
 });
 for(const r of rows){let contacts:ReturnType<typeof importContacts>;try{contacts=importContacts(r);}catch{continue;}for(const kind of ['phone','email'] as const)if(contacts.some(c=>c.kind===kind&&((kind==='phone'?phones:emails).get(contactKey(c))?.size??0)>1))r.issues.push(`Bu ${kind==='phone'?'telefon':'e-posta'} dosyada farklı isimlerde de var; kişileri birleştirmeyin.`);}

 return {rows,issueCount:rows.filter(r=>r.issues.length).length,warningCount:rows.filter(r=>r.warnings.length).length,repeatedNames:[...names.values()].filter(v=>v>1).length,sharedPhones:[...phones.values()].filter(v=>v.size>1).length,unmapped:header.cells.map((c,i)=>({index:i,label:c.value||`Başlıksız sütun ${i+1}`})).filter(c=>!entries.some(([,i])=>i===c.index))};
}
