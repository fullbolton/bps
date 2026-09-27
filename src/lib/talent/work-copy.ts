import type {CompareSnapshot} from './import-compare';
export class WorkCopyError extends Error {}
export const workCopyHeaders=['BPS kişi kimliği','BPS şirket kimliği','Ad soyad','İkamet ili','Telefon','E-posta','İkamet ilçesi','Meslekler / beceriler','Çalışabileceği bölgeler'];
/** Deliberately limited to fields the reviewed import can round-trip. Other fields stay in BPS. */
export function workCopyRows(snapshot:CompareSnapshot):string[][]{
 if(snapshot.rows.some(p=>p.contacts.some(c=>c.value.includes(';'))))throw new WorkCopyError('İletişim bilgisinin içinde noktalı virgül var. Çalışma kopyası için kişi detayından ayrı iletişimler olarak düzenleyin.');
 if(snapshot.rows.some(p=>[...(p.skills??[]),...(p.regions??[])].some(v=>v.includes(';'))))throw new WorkCopyError('Meslek veya bölge adında noktalı virgül var. Çalışma kopyası oluşturmadan önce bu alanı kişi detayından düzenleyin.');
 return [[...workCopyHeaders],...snapshot.rows.map(p=>[p.id,snapshot.tenantId,p.name,p.city??'',p.contacts.filter(c=>c.kind==='phone').map(c=>c.value).join('; '),p.contacts.filter(c=>c.kind==='email').map(c=>c.value).join('; '),p.district??'',(p.skills??[]).join('; '),(p.regions??[]).join('; ')])];
}
