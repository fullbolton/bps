import {emptyPerson,validatePersonInput} from './people';
/** Semicolons delimit list cells. A comma remains part of one value. Blank cells never clear data. */
export const extendedImportFields=['district','skills','regions'] as const;
export function importList(value:string):string[]{
 if(!value.trim())return [];
 const parts=value.split(';').map(v=>v.trim());
 if(parts.some(v=>!v)||parts.length>20)throw Error('TALENT_IMPORT_VALIDATION');
 return validatePersonInput({...emptyPerson,name:'Kontrol',skills:parts}).skills;
}
export function extendedPersonFields(source:{district?:string;skills?:string;regions?:string}){
 return {district:source.district?.trim()||null,skills:importList(source.skills??''),regions:importList(source.regions??'')};
}
export const differenceLabels={name:'Ad soyad',city:'İkamet ili',district:'İkamet ilçesi',skills:'Meslek / beceri ekle',regions:'Çalışma bölgesi ekle',contacts:'İletişim ekle'};
