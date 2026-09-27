"use server";
import {validateMatchQueries} from "@/lib/talent/targeted-compare";
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {loadTalentCompareSnapshot,loadTalentPeople,loadTalentPerson,writeTalentPerson,talentError,resolvePersonSave} from '@/lib/services/talent';
import {checkTalentScope,type TalentScope,type PeoplePage,type PersonDetail,type SaveReceipt,type PersonResolution} from '@/lib/talent/people';
import {loadTalentImportHistory,prepareTalentImport,recoverTalentImport,applyTalentImportRow} from '@/lib/services/talent-import';
export type TalentResult<T>={ok:true;data:T}|{ok:false;message:string};
async function context(expected?:TalentScope){
 const c=await createServerSupabaseClient(12_000);
 const [auth,tenant,role]=await Promise.all([c.auth.getUser(),c.rpc('current_user_verified_tenant'),c.rpc('current_user_role')]);
 if(auth.error||tenant.error||!auth.data.user||!tenant.data)throw Error('TALENT_SCOPE');
 if(role.error||!['yonetici','operasyon','ik'].includes(role.data??''))throw Error('TALENT_FORBIDDEN');
 const scope=checkTalentScope({actorId:auth.data.user.id,tenantId:tenant.data});
 if(expected){const s=checkTalentScope(expected);if(s.actorId!==scope.actorId||s.tenantId!==scope.tenantId)throw Error('TALENT_SCOPE');}
 return {c,scope};
}
export async function talentScopeAction():Promise<TalentResult<TalentScope>>{
 try{return {ok:true,data:(await context()).scope};}catch(e){return {ok:false,message:talentError(e)};}
}
export async function talentResolveAction(scope:TalentScope,pending:unknown):Promise<TalentResult<PersonResolution>>{
 try{const {c}=await context(scope);return {ok:true,data:await resolvePersonSave(c,scope,pending)};}catch(e){return {ok:false,message:talentError(e)};}
}
export async function talentPeopleAction(scope:TalentScope,query:unknown):Promise<TalentResult<PeoplePage>>{
 try{const {c}=await context(scope);return {ok:true,data:await loadTalentPeople(c,scope,query)};}catch(e){return {ok:false,message:talentError(e)};}
}
export async function talentPersonAction(scope:TalentScope,id:string):Promise<TalentResult<PersonDetail>>{
 try{const {c}=await context(scope);return {ok:true,data:await loadTalentPerson(c,scope,id)};}catch(e){return {ok:false,message:talentError(e)};}
}
export async function talentSaveAction(scope:TalentScope,command:unknown):Promise<TalentResult<SaveReceipt>>{
 try{const {c}=await context(scope);return {ok:true,data:await writeTalentPerson(c,scope,command)};}catch(e){return {ok:false,message:talentError(e)};}
}

export async function talentCompareSnapshotAction(scope:TalentScope){
 try{const {c}=await context(scope);return {ok:true as const,data:await loadTalentCompareSnapshot(c,scope)};}catch(e){return {ok:false as const,message:talentError(e)};}
}

export async function talentImportPrepareAction(scope:TalentScope,input:unknown){try{const {c}=await context(scope);return {ok:true as const,data:await prepareTalentImport(c,scope,input)};}catch(e){return {ok:false as const,message:talentError(e)};}}
export async function talentImportRecoverAction(scope:TalentScope,reference:unknown,close=false){try{const {c}=await context(scope);return {ok:true as const,data:await recoverTalentImport(c,scope,reference,close)};}catch(e){return {ok:false as const,message:talentError(e)};}}
export async function talentImportApplyAction(scope:TalentScope,reference:unknown,number:number){try{const {c}=await context(scope);return {ok:true as const,data:await applyTalentImportRow(c,scope,reference,number)};}catch(e){return {ok:false as const,message:talentError(e)};}}

export async function talentImportHistoryAction(scope:TalentScope,offset:number){try{const {c}=await context(scope);return {ok:true as const,data:await loadTalentImportHistory(c,scope,offset)};}catch(e){return {ok:false as const,message:talentError(e)};}}

export async function talentAttachmentListAction(scope:TalentScope,personId:string){
 try{const {c}=await context(scope);const r=await c.rpc('talent_attachment_list',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_person_id:personId});if(r.error)throw r.error;return {ok:true as const,data:r.data};}catch{return {ok:false as const,message:'Kişi ekleri okunamadı. Yeniden deneyin.'};}
}
export async function talentAttachmentUploadAction(scope:TalentScope,form:FormData){
 try{
  const {c}=await context(scope);
  const {attachmentMime,validateAttachment,ATTACHMENT_MAX_BYTES}=await import('@/lib/talent/attachments');
  const file=form.get('file');if(!(file instanceof File)||!file.size||file.size>ATTACHMENT_MAX_BYTES)throw Error('ATTACHMENT_INVALID');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const {createHash}=await import('node:crypto');
  const input=validateAttachment({id:form.get('id'),personId:form.get('personId'),category:form.get('category'),filename:file.name,mime:attachmentMime(bytes),size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  const {uploadAttachment}=await import('@/lib/talent/attachment-upload');
  await uploadAttachment({
   reserve:async value=>await c.rpc('talent_attachment_reserve',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_input:{...value}}).then(r=>r),
   upload:(value,body)=>c.storage.from('person-files').upload(value.id,body,{contentType:value.mime,upsert:false}),
   finish:async id=>await c.rpc('talent_attachment_finish',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_id:id}).then(r=>r),
  },input,bytes);
  return {ok:true as const};
 }catch{return {ok:false as const,message:'Yükleme doğrulanamadı. Aynı dosyayla yeniden deneyin; dosyayı veya kategoriyi değiştirmek için yeni yükleme başlatın.'};}
}
export async function talentAttachmentLinkAction(scope:TalentScope,id:string){
 try{const {c}=await context(scope);const r=await c.storage.from('person-files').createSignedUrl(id,60);if(r.error||!r.data.signedUrl)throw Error('ATTACHMENT_LINK');return {ok:true as const,url:r.data.signedUrl,expiresAt:Date.now()+55000};}catch{return {ok:false as const,message:'Dosyaya erişilemiyor. Yetkinizi kontrol edip yeniden deneyin.'};}
}

export async function talentConversationListAction(scope:TalentScope,personId:string,offset:number){
 try{
  const {c}=await context(scope);
  const {isUuid}=await import('@/lib/operations/pilot-validation');
  if(!isUuid(personId)||!Number.isSafeInteger(offset)||offset<0||offset>100000)throw Error('CONVERSATION_VALIDATION');
  const {parseConversationList}=await import('@/lib/talent/conversations');
  const r=await c.rpc('talent_conversation_list',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_person_id:personId,p_offset:offset});
  if(r.error)throw r.error;
  return {ok:true as const,data:parseConversationList(r.data,scope,personId)};
 }catch{return {ok:false as const,message:'Görüşme geçmişi okunamadı. Yeniden deneyin.'};}
}
export async function talentConversationSaveAction(scope:TalentScope,input:unknown){
 try{
  const {c}=await context(scope);
  const {validateConversation,parseConversation}=await import('@/lib/talent/conversations');
  const value=validateConversation(input);
  const r=await c.rpc('talent_conversation_save',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_input:{...value}});
  if(r.error)throw r.error;
  const row=parseConversation(r.data,scope,value.personId);
  if(row.actorId!==scope.actorId||row.commandId!==value.commandId||row.channel!==value.channel||row.outcome!==value.outcome||row.note!==value.note||row.requestId!==value.requestId)throw Error('CONVERSATION_RESPONSE');
  return {ok:true as const,data:row};
 }catch{return {ok:false as const,message:'Görüşme sonucu doğrulanamadı. Aynı kayıtla yeniden deneyin.'};}
}

export async function talentAttachmentPendingAction(scope:TalentScope,personId:string){
 try{const {c}=await context(scope);const {parseAttachmentRows}=await import('@/lib/talent/attachments');const r=await c.rpc('talent_attachment_pending',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_person_id:personId});if(r.error)throw r.error;return {ok:true as const,data:parseAttachmentRows(r.data,personId)};}catch{return {ok:false as const,message:'Bekleyen yüklemeler okunamadı.'};}
}
export async function talentAttachmentFinishAction(scope:TalentScope,id:string){
 try{const {c}=await context(scope);const {isUuid}=await import('@/lib/operations/pilot-validation');if(!isUuid(id))throw Error('ATTACHMENT_INVALID');const r=await c.rpc('talent_attachment_finish',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_id:id});if(r.error||r.data!==true)throw Error('ATTACHMENT_NOT_UPLOADED');return {ok:true as const};}catch{return {ok:false as const,message:'Dosya henüz doğrulanamadı. Aynı dosya ve belge grubuyla yüklemeyi yeniden deneyin.'};}
}

export async function talentAttachmentCancelAction(scope:TalentScope,id:string){
 try{
  const {c}=await context(scope);const {isUuid}=await import('@/lib/operations/pilot-validation');if(!isUuid(id))throw Error('ATTACHMENT_INVALID');
  const args={p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_id:id};
  const cancelled=await c.rpc('talent_attachment_cancel',args);if(cancelled.error||cancelled.data!==true)throw Error('ATTACHMENT_CANCEL');
  const removed=await c.storage.from('person-files').remove([id]);if(removed.error)throw removed.error;
  const finished=await c.rpc('talent_attachment_cancel',{...args,p_finish:true});if(finished.error||finished.data!==true)throw Error('ATTACHMENT_CLEANUP');
  return {ok:true as const};
 }catch{return {ok:false as const,message:'İptal veya dosya temizliği doğrulanamadı. Tamamlanmış dosyalar silinmez. Listeyi yenileyip tekrar deneyin.'};}
}

export async function talentAvailabilityReadAction(scope:TalentScope,personId:string){
 try{const {c}=await context(scope);const {isUuid}=await import('@/lib/operations/pilot-validation');if(!isUuid(personId))throw Error('ID');const r=await c.rpc('talent_availability_read',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_person_id:personId});if(r.error)throw r.error;const {parseAvailability}=await import('@/lib/talent/availability');return {ok:true as const,data:parseAvailability(r.data,scope,personId)};}catch{return {ok:false as const,message:'Müsaitlik geçmişi okunamadı.'};}
}
export async function talentAvailabilitySaveAction(scope:TalentScope,personId:string,input:unknown){
 try{const {c}=await context(scope);const {validateAvailability,parseAvailability}=await import('@/lib/talent/availability');const v=validateAvailability(input);const r=await c.rpc('talent_availability_save',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_person_id:personId,p_command_id:v.commandId,p_expected_revision:v.expectedRevision,p_state:v.state,p_starts_on:v.startsOn,p_ends_on:v.endsOn});
 if(r.error){if(r.error.message.includes('AVAILABILITY_CONFLICT'))return {ok:false as const,conflict:true,message:'Başka bir teyit kaydedildi. Güncel kaydı okuyup tarih ve durumu yeniden değerlendirin.'};throw r.error;}
 const row=parseAvailability([r.data],scope,personId)[0];if(row.actor_id!==scope.actorId||row.command_id!==v.commandId||row.expected_revision!==v.expectedRevision||row.state!==v.state||row.starts_on!==v.startsOn||row.ends_on!==v.endsOn)throw Error('RESPONSE');return {ok:true as const};
 }catch{return {ok:false as const,conflict:false,message:'Kayıt sonucu doğrulanamadı. Aynı işlemle tekrar deneyin.'};}
}

export async function talentPrepareWorkerAction(scope:TalentScope,input:unknown){
 try{
  const {c}=await context(scope);
  const {validateWorkerPreparation,parseWorkerPreparation}=await import('@/lib/talent/worker-prepare');
  const v=validateWorkerPreparation(input);
  const r=await c.rpc('talent_prepare_worker',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_person_id:v.personId,p_command_id:v.commandId,p_expected_revision:v.expectedRevision,p_code:v.code,p_kind:v.kind});
  if(r.error)throw r.error;
  return {ok:true as const,data:parseWorkerPreparation(r.data,v)};
 }catch(e){
  const message=e&&typeof e==='object'&&'message' in e?String(e.message):'';
  return {ok:false as const,message:message.includes('TALENT_WORKER_CONFLICT')?'Kişi değişmiş veya zaten operasyona bağlanmış. Kişi kartını yeniden açıp güncel kaydı kontrol edin.':message.includes('duplicate key')?'Bu personel kodu kullanılıyor. Mevcut kaydı kontrol edin; aynı kişi için ikinci kayıt oluşturmayın.':message.includes('TALENT_FORBIDDEN')?'Personel kaydı hazırlamak için yönetici yetkisi gerekir.':'İşlem sonucu doğrulanamadı. Aynı bilgilerle yeniden deneyin veya kişi kartını yeniden açıp bağlantıyı kontrol edin.'};
 }
}

export async function talentMatchSourceAction(scope:TalentScope,input:unknown){
 try{const queries=validateMatchQueries(input);const {c}=await context(scope);const {data,error}=await c.rpc("talent_match_source",{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_rows:queries.map(q=>({...q}))});if(error)throw error;return {ok:true as const,data};}catch(e){return {ok:false as const,message:talentError(e)};}

}

export async function talentWorkCopyPageAction(scope:TalentScope,cursor:import('@/lib/talent/work-copy-pages').ExportCursor|null){
 try{const {validateExportCursor}=await import('@/lib/talent/work-copy-pages');validateExportCursor(cursor);const {c}=await context(scope);const {data,error}=await c.rpc('talent_work_copy_page',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,...(cursor?{p_after:cursor.after,p_version:cursor.version}:{})});if(error)throw error;return {ok:true as const,data};}catch(e){return {ok:false as const,message:talentError(e)};}
}

export async function talentImportChangeAction(scope:TalentScope,batchId:string,number:number,undo=false){
 try{const {c}=await context(scope);const {reviewImportUpdate}=await import('@/lib/services/import-undo');return {ok:true as const,data:await reviewImportUpdate(c,scope,batchId,number,undo)};}catch{return {ok:false as const,message:'Aktarım değişiklikleri doğrulanamadı. Yeniden kontrol edin.'};}
}

export async function talentMergeReviewAction(scope:TalentScope,left:string,right:string){
 try{const {c}=await context(scope);const {reviewPersonMerge}=await import('@/lib/services/person-merge');return {ok:true as const,data:await reviewPersonMerge(c,scope,left,right)};}
 catch{return {ok:false as const,message:'Karşılaştırma yüklenemedi. Yönetici yetkinizi ve seçtiğiniz iki kaydı kontrol edip yeniden deneyin.'};}
}

export async function talentMergeApplyAction(scope:TalentScope,input:unknown){
 try{const {c}=await context(scope);const {applyPersonMerge}=await import('@/lib/services/person-merge');return {ok:true as const,data:await applyPersonMerge(c,scope,input)};}
 catch{return {ok:false as const,message:'Birleştirme sonucu doğrulanamadı. Yeni işlem başlatmadan önce sonucu kontrol edin.'};}
}
export async function talentMergeResolveAction(scope:TalentScope,input:unknown){
 try{const {c}=await context(scope);const {resolvePersonMerge}=await import('@/lib/services/person-merge');return {ok:true as const,data:await resolvePersonMerge(c,scope,input)};}
 catch{return {ok:false as const,message:'Sonuç kontrol edilemedi. Yönetici oturumunuzu ve bağlantınızı kontrol edip yeniden deneyin.'};}
}

export async function talentMergedAvailabilityAction(scope:TalentScope,personId:string,offset=0){
 try{
  const {checkMergedAvailabilityQuery,parseMergedAvailability}=await import('@/lib/talent/merged-availability');
  checkMergedAvailabilityQuery(personId,offset);const {c}=await context(scope);
  const {data,error}=await c.rpc('talent_merged_availability',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_person:personId,p_offset:offset});
  if(error)throw error;return {ok:true as const,data:parseMergedAvailability(data,scope,personId,offset)};
 }catch{return {ok:false as const,message:'Birleşen kartların eski teyitleri okunamadı.'};}
}

export async function talentContactSummariesAction(scope:TalentScope,people:unknown){
 try{const {c}=await context(scope);const {validateSummaryIds,parseContactSummaries}=await import('@/lib/talent/contact-summary');const ids=validateSummaryIds(people);const r=await c.rpc('talent_contact_summaries',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_people:ids});if(r.error)throw r.error;return {ok:true as const,data:parseContactSummaries(r.data,scope,ids)};}catch{return {ok:false as const,message:'Son görüşmeler okunamadı. Yeniden deneyin.'};}
}

export async function talentSharedViewsAction(scope:TalentScope){
 try{const {c}=await context(scope);const {parseSharedViews}=await import('@/lib/talent/shared-views');
 const r=await c.rpc('talent_shared_views_read',{p_actor:scope.actorId,p_tenant:scope.tenantId});if(r.error)throw r.error;
 return {ok:true as const,data:parseSharedViews(r.data,scope)};
 }catch{return {ok:false as const,message:'Ekip görünümleri okunamadı. Yeniden deneyin.'};}
}
export async function talentSharedViewCreateAction(scope:TalentScope,id:string,name:string,query:unknown){
 try{const {c}=await context(scope);const {sharedViewInput}=await import('@/lib/talent/shared-views');const v=sharedViewInput(id,name,query);
 const r=await c.rpc('talent_shared_view_create',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_id:v.id,p_name:v.name,p_query:{...v.query}});if(r.error)throw r.error;if(r.data!==id)throw Error('TALENT_RESPONSE');
 return {ok:true as const};
 }catch(e){const msg=e&&typeof e==='object'&&'message' in e?String(e.message):'';
 return {ok:false as const,message:msg.includes('SHARED_VIEW_NAME')?'Bu isimde bir ekip görünümü var. Farklı bir ad kullanın.':msg.includes('SHARED_VIEW_LIMIT')?'En fazla 100 ekip görünümü saklanabilir. Kullanılmayan bir görünümü kaldırın.':talentError(e)};}
}
export async function talentSharedViewArchiveAction(scope:TalentScope,id:string){
 try{const {c}=await context(scope);const {isUuid}=await import('@/lib/operations/pilot-validation');if(!isUuid(id))throw Error('TALENT_VALIDATION');
 const r=await c.rpc('talent_shared_view_archive',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_id:id});if(r.error)throw r.error;if(r.data!==id)throw Error('TALENT_RESPONSE');
 return {ok:true as const};
 }catch(e){return {ok:false as const,message:talentError(e)};}
}

export async function talentCallListsAction(scope:TalentScope){
 try{const {c}=await context(scope);const {parseCallLists}=await import('@/lib/talent/call-lists');const r=await c.rpc('talent_call_lists_read',{p_actor:scope.actorId,p_tenant:scope.tenantId});if(r.error)throw r.error;return {ok:true as const,data:parseCallLists(r.data,scope)};}catch{return {ok:false as const,message:'Arama listeleri okunamadı. Yeniden deneyin.'};}
}
export async function talentCallListPeopleAction(scope:TalentScope,id:string){
 try{const {c}=await context(scope);const {parseCallListPeople}=await import('@/lib/talent/call-lists');const r=await c.rpc('talent_call_list_people',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_id:id});if(r.error)throw r.error;return {ok:true as const,data:parseCallListPeople(r.data,scope,id)};}catch{return {ok:false as const,message:'Liste açılamadı. Kaldırılmış olabilir veya kişi kayıtları değişmiştir. Listeleri yenileyin.'};}
}
export async function talentCallListCreateAction(scope:TalentScope,id:string,name:string,ids:unknown){
 try{const {c}=await context(scope);const {validateCallList}=await import('@/lib/talent/call-lists');const v=validateCallList(id,name,ids);const r=await c.rpc('talent_call_list_create',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_id:v.id,p_name:v.name,p_ids:v.ids});if(r.error)throw r.error;if(r.data!==id)throw Error('TALENT_RESPONSE');return {ok:true as const};}
 catch(e){const m=e&&typeof e==='object'&&'message'in e?String(e.message):'';return {ok:false as const,message:m.includes('CALL_LIST_NAME')?'Bu isimde bir liste var. Farklı bir ad kullanın.':m.includes('CALL_LIST_LIMIT')?'En fazla 100 liste saklanabilir. Kullanılmayan bir listeyi kaldırın.':m.includes('CALL_LIST_PEOPLE_CHANGED')?'Seçilen kişiler değişti. Havuzu yenileyip yeniden seçin.':talentError(e)};}
}
export async function talentCallListArchiveAction(scope:TalentScope,id:string){
 try{const {c}=await context(scope);const r=await c.rpc('talent_call_list_archive',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_id:id});if(r.error)throw r.error;if(r.data!==id)throw Error('TALENT_RESPONSE');return {ok:true as const};}catch(e){return {ok:false as const,message:talentError(e)};}
}

export async function talentPlacementContextAction(scope:TalentScope,hint:import('@/lib/operations/pool-placement-link').PoolPlacement){
 try{
  const {c}=await context(scope);
  if(hint.tenantId!==scope.tenantId||process.env.BPS_DAILY_OPERATIONS_ENABLED!=='true')throw Error('TALENT_SCOPE');
  const role=await c.rpc('current_user_role');if(role.error||!['yonetici','operasyon'].includes(role.data??''))throw Error('TALENT_FORBIDDEN');
  const {loadPilotBoard,listPilotCompanies}=await import('@/lib/services/daily-operations');
  const {buildPoolPlacementContext}=await import('@/lib/operations/pool-placement-context');
  const [board,companies]=await Promise.all([loadPilotBoard(c,hint.companyId,hint.day),listPilotCompanies(c)]);
  // Do not return data if the active workspace changed during these reads.
  await context(scope);
  return {ok:true as const,data:buildPoolPlacementContext(hint,companies,board)};
 }catch{return {ok:false as const,message:'Talep açılamadı. Talep kapanmış, dolmuş veya erişiminiz değişmiş olabilir. Günlük taleplere dönüp yeniden seçin.'};}
}
