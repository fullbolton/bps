import type {DocumentCategory} from './document-categories';
export const DOCUMENT_FOLDERS = [
  {id:'firma',name:'Firma evrakları',description:'İmza sirküleri, ticaret sicil ve yetki belgeleri',categories:['yetki_belgesi']},
  {id:'sozlesme',name:'Sözleşmeler',description:'Çerçeve sözleşmeler ve ek protokoller',categories:['cerceve_sozlesme','ek_protokol']},
  {id:'operasyon',name:'Operasyon ve teklifler',description:'Operasyon evrakları, teklifler ve ziyaret tutanakları',categories:['operasyon_evraki','teklif_dosyasi','ziyaret_tutanagi']},
  {id:'diger',name:'Diğer belgeler',description:'Bu gruplara girmeyen dosyalar',categories:['diger']},
] as const;
export function documentFolder(category:DocumentCategory,contractId?:string|null):string {
  if(contractId)return 'sozlesme';
  return DOCUMENT_FOLDERS.find(folder=>(folder.categories as readonly string[]).includes(category))?.id??'diger';
}
