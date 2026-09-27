import {parseCompareSnapshot} from '@/lib/talent/import-compare';
import {selectTalentCompareSnapshot} from '@/lib/supabase/talent';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {isUuid} from '@/lib/operations/pilot-validation';
import {checkTalentScope,validatePeopleQuery,validateSavePerson,parsePeoplePage,parsePersonDetail,parseSaveReceipt,parsePendingPerson,parsePersonResolution} from '@/lib/talent/people';
import {selectTalentPage,selectTalentDetail,saveTalentPerson,resolveTalentCommand} from '@/lib/supabase/talent';
type Client=SupabaseClient<Database>;
export async function resolvePersonSave(c:Client,scope:unknown,pending:unknown){
 const s=checkTalentScope(scope),p=parsePendingPerson(pending);return parsePersonResolution(await resolveTalentCommand(c,s,p.commandId),p);
}
export async function loadTalentPeople(c:Client,scope:unknown,query:unknown){
 const s=checkTalentScope(scope),q=validatePeopleQuery(query);return parsePeoplePage(await selectTalentPage(c,s,q),s,q);
}
export async function loadTalentPerson(c:Client,scope:unknown,id:string){
 const s=checkTalentScope(scope);if(!isUuid(id))throw Error('TALENT_VALIDATION');return parsePersonDetail(await selectTalentDetail(c,s,id),s,id);
}
export async function writeTalentPerson(c:Client,scope:unknown,command:unknown){
 const s=checkTalentScope(scope),x=validateSavePerson(command);return parseSaveReceipt(await saveTalentPerson(c,s,x),x);
}
export function talentError(error:unknown):string{
 const message=error&&typeof error==='object'&&'message' in error?String(error.message):'';
 if(message.includes('TALENT_IMPORT_CLOSED'))return 'Bu aktarım güvenli şekilde kapatıldı. Sonucu kontrol edin.';
 if(message.includes('TALENT_IMPORT_LIMIT'))return 'Bir aktarım en fazla 500 satır ve 1 MB olabilir.';
 if(message.includes('TALENT_IMPORT_COMMAND'))return 'Aktarım kimliği farklı bir plana ait. Önce mevcut aktarımın sonucunu kontrol edin.';
 if(message.includes('TALENT_MATCH_LIMIT'))return 'Bu parça çok fazla eşleşme içeriyor. Dosyayı daha küçük parçalara ayırın.';
 if(message.includes('TALENT_EXPORT_CHANGED'))return 'İndirme sırasında havuz değişti. Eksik veya karışık dosya oluşturulmadı; yeniden indirin.';
 if(message.includes('TALENT_EXPORT_LIMIT'))return 'Çalışma kopyası boyut sınırını aşıyor. Dosya oluşturulmadı.';
 if(message.includes('TALENT_COMPARE_TOO_LARGE'))return 'Karşılaştırma havuzu bu ekranın 10.000 kişi / 5 MB sınırını aşıyor. Excel karşılaştırması sunucuda eşleştirme yapabilir; bu sınır çalışma kopyası dışa aktarımına aittir.';
 if(message.includes('TALENT_CONFLICT'))return 'Bu kişi başka bir işlemde güncellendi. Kartı yenileyip değişiklikleri karşılaştırın.';
 if(message.includes('TALENT_SCOPE'))return 'Oturum veya çalışma alanı değişti. Sayfayı yenileyin.';
 if(message.includes('TALENT_FORBIDDEN'))return 'Personel havuzu için yetkiniz bulunmuyor.';
 if(message.includes('TALENT_NOT_FOUND'))return 'Kişi bulunamadı veya bu çalışma alanında değil.';
 if(message.includes('TALENT_VALIDATION'))return 'Bilgileri kontrol edin. Ad soyad, iletişim, doğum tarihi ve filtre aralıkları geçerli olmalı.';
 if(message.includes('TALENT_COMMAND'))return 'Bu işlemin içeriği değişmiş. Kartı yenileyip tekrar deneyin.';
 return 'İşlem sonucu doğrulanamadı. Bağlantıyı kontrol edip yeniden deneyin.';
}

export async function loadTalentCompareSnapshot(c:Client,scope:unknown){
 const s=checkTalentScope(scope);return parseCompareSnapshot(await selectTalentCompareSnapshot(c,s),s);
}
