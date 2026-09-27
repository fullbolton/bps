import {isUuid} from '@/lib/operations/pilot-validation';
export const attachmentCategories={photo:'Profil fotoğrafı',cv:'CV',certificate:'Sertifika',onboarding:'İşe giriş evrakı',other:'Diğer ekler'} as const;
export type AttachmentCategory=keyof typeof attachmentCategories;
export const ATTACHMENT_MAX_BYTES=10*1024*1024;
export type AttachmentInput={id:string;personId:string;category:AttachmentCategory;filename:string;mime:string;size:number;sha256:string};
export function canAccessAttachment(role:string,category:AttachmentCategory){return ['yonetici','ik'].includes(role)||(role==='operasyon'&&category!=='onboarding');}
export function validateAttachment(value:unknown):AttachmentInput{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('ATTACHMENT_INVALID');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['id','personId','category','filename','mime','size','sha256'].includes(k))||!isUuid(v.id)||!isUuid(v.personId)||!Object.hasOwn(attachmentCategories,String(v.category))||typeof v.filename!=='string'||!v.filename.trim()||v.filename.length>180||/[\u0000-\u001f\u007f/\\]/.test(v.filename)||!['image/jpeg','image/png','application/pdf'].includes(String(v.mime))||typeof v.size!=='number'||!Number.isSafeInteger(v.size)||v.size<1||v.size>ATTACHMENT_MAX_BYTES||typeof v.sha256!=='string'||! /^[a-f0-9]{64}$/.test(v.sha256)||(v.category==='photo'&&!String(v.mime).startsWith('image/')))throw Error('ATTACHMENT_INVALID');
 return {id:v.id,personId:v.personId,category:v.category as AttachmentCategory,filename:v.filename.trim(),mime:v.mime as string,size:v.size,sha256:v.sha256};
}
export function attachmentMime(bytes:Uint8Array):string{
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=5&&[37,80,68,70,45].every((n,i)=>bytes[i]===n))return 'application/pdf';
 throw Error('ATTACHMENT_TYPE');
}

export type AttachmentRow={id:string;person_id:string;category:AttachmentCategory;filename:string;mime:string;size:number;created_at:string;source_person_id?:string};

/** Reject incomplete or mixed-person lists rather than presenting corrupt metadata as valid files. */
export function parseAttachmentRows(value:unknown,personId:string):AttachmentRow[]{
 if(!isUuid(personId)||!Array.isArray(value)||value.length>51)throw Error('ATTACHMENT_RESPONSE');
 const seen=new Set<string>();
 return value.map(item=>{
  if(!item||typeof item!=='object'||Array.isArray(item))throw Error('ATTACHMENT_RESPONSE');
  const row=item as Record<string,unknown>;
  if(!isUuid(row.id)||seen.has(row.id)||row.person_id!==personId||!Object.hasOwn(attachmentCategories,String(row.category))||
   typeof row.filename!=='string'||!row.filename.trim()||row.filename.length>180||/[\u0000-\u001f\u007f/\\]/.test(row.filename)||
   !['image/jpeg','image/png','application/pdf'].includes(String(row.mime))||
   typeof row.size!=='number'||!Number.isSafeInteger(row.size)||row.size<1||row.size>ATTACHMENT_MAX_BYTES||
   (row.category==='photo'&&!['image/jpeg','image/png'].includes(String(row.mime)))||
   typeof row.created_at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(row.created_at)||!Number.isFinite(Date.parse(row.created_at)))throw Error('ATTACHMENT_RESPONSE');
  if(row.source_person_id!==undefined&&!isUuid(row.source_person_id))throw Error('ATTACHMENT_RESPONSE');
  seen.add(row.id);
  return {...(row.source_person_id!==undefined?{source_person_id:row.source_person_id as string}:{}),id:row.id,person_id:personId,category:row.category as AttachmentCategory,filename:row.filename,mime:row.mime as string,size:row.size,created_at:row.created_at};
 });
}
