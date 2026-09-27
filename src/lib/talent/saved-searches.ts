import {validatePeopleQuery,type PeopleQuery} from './people';
import {isUuid} from '@/lib/operations/pilot-validation';
export type SavedSearch={id:string;name:string;query:PeopleQuery};
export const MAX_SAVED_SEARCHES=20;
export function parseSavedSearches(raw:string|null):SavedSearch[]{
 if(raw===null)return [];
 if(raw.length>50000)throw Error('SAVED_SEARCH_INVALID');
 const data:unknown=JSON.parse(raw);
 if(!Array.isArray(data)||data.length>MAX_SAVED_SEARCHES)throw Error('SAVED_SEARCH_INVALID');
 const seen=new Set<string>(),names=new Set<string>();
 return data.map(value=>{
  if(!value||typeof value!=='object'||!isUuid(value.id)||typeof value.name!=='string'||!value.name.trim()||value.name.length>60||/[\u0000-\u001f\u007f]/.test(value.name)||seen.has(value.id)||names.has(value.name.trim().toLocaleLowerCase('tr-TR')))throw Error('SAVED_SEARCH_INVALID');
  seen.add(value.id);names.add(value.name.trim().toLocaleLowerCase('tr-TR'));
  return {id:value.id,name:value.name.trim(),query:{...validatePeopleQuery(value.query),offset:0}};
 });
}
export function appendSavedSearch(rows:SavedSearch[],name:string,query:PeopleQuery,id:string):SavedSearch[]{
 if(rows.length>=MAX_SAVED_SEARCHES)throw Error('En fazla 20 arama saklanabilir. Önce kullanmadığınız bir aramayı kaldırın.');
 if(rows.some(r=>r.name.toLocaleLowerCase('tr-TR')===name.trim().toLocaleLowerCase('tr-TR')))throw Error('Bu isimde bir arama var. Farklı bir isim seçin.');
 return parseSavedSearches(JSON.stringify([...rows,{id,name:name.trim(),query:{...query,offset:0}}]));
}
