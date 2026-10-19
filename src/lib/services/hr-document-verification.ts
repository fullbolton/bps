import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {isUuid} from '@/lib/operations/pilot-validation';
import {pdfDigest} from '@/lib/pdf-upload';
import {parseHrUploadReceipt,type HrUploadInput} from './hr-document-upload';

/** Server orchestration only. The caller supplies a scoped user client and a
 * trusted verifier client. The database never grants attestation to browsers.
 * No credentials are constructed here; no public route is enabled yet. */
export async function verifyAndFinishHrDocument(
 user:SupabaseClient<Database>, verifier:SupabaseClient<Database>,
 context:{actor:string;tenant:string;employee:string}, expected:HrUploadInput,
){
 const args={p_actor:context.actor,p_tenant:context.tenant,p_upload:expected.id};
 const snapshot=await user.rpc('hr_document_verification_context_v1',args).abortSignal(AbortSignal.timeout(12000));
 if(snapshot.error)throw snapshot.error;
 const receipt=parseHrUploadReceipt(snapshot.data,context,expected);
 if(receipt.state==='cancelled')throw Error('HR_UPLOAD_CANCELLED');
 const object=snapshot.data as Record<string,unknown>;
 const path=`${context.tenant}/${expected.id}.pdf`;
 if(!isUuid(object.objectId)||typeof object.objectVersion!=='string'||!object.objectVersion||object.path!==path)throw Error('HR_UPLOAD_OBJECT');
 // Use the user client for download, so a server credential never bypasses read scope.
 const stored=await user.storage.from('hr-private').download(path);
 if(stored.error||!stored.data)throw Error('HR_UPLOAD_UNCERTAIN');
 if(stored.data.size!==expected.size)throw Error('HR_UPLOAD_CONTENT');
 const bytes=await stored.data.arrayBuffer();
 if(await pdfDigest(bytes)!==expected.sha256)throw Error('HR_UPLOAD_CONTENT');
 const attestation=await verifier.rpc('hr_document_attest_v1',{
  p_tenant:context.tenant,p_actor:context.actor,p_upload:expected.id,
  p_object:object.objectId,p_version:object.objectVersion,p_size:expected.size,p_sha256:expected.sha256,
 }).abortSignal(AbortSignal.timeout(12000));
 if(attestation.error)throw attestation.error;
 const finished=await user.rpc('hr_document_finish_v1',args).abortSignal(AbortSignal.timeout(12000));
 if(finished.error)throw finished.error;
 const result=parseHrUploadReceipt(finished.data,context,expected);
 if(result.state!=='published')throw Error('HR_UPLOAD_RESPONSE');
 return result;
}
