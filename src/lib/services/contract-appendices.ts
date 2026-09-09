import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {transferId} from '@/lib/task-transfer';
import {parseAppendices,parseDocumentHistory} from '@/lib/contract-appendices';
import type {PdfScope} from '@/lib/services/contract-pdf';
type Client=SupabaseClient<Database>;
const args=(scope:PdfScope,contractId:string)=>({p_actor_id:transferId(scope.actorId),p_tenant_id:transferId(scope.tenantId),p_contract_id:transferId(contractId)});
export async function loadAppendices(client:Client,scope:PdfScope,contractId:string,afterId:string|null=null){
 const {data,error}=await client.rpc('contract_appendices',{...args(scope,contractId),p_after_id:afterId===null?null:transferId(afterId)});if(error)throw error;return parseAppendices(data,contractId,afterId);
}
export async function loadDocumentHistory(client:Client,scope:PdfScope,contractId:string,documentId:string){
 const {data,error}=await client.rpc('contract_document_history',{...args(scope,contractId),p_document_id:transferId(documentId)});if(error)throw error;return parseDocumentHistory(data,contractId,documentId);
}
export async function downloadDocumentVersion(client:Client,scope:PdfScope,contractId:string,documentId:string,versionId:string){
 const {data,error}=await client.rpc('contract_document_version_path',{...args(scope,contractId),p_document_id:transferId(documentId),p_version_id:transferId(versionId)});
 if(error||typeof data!=='string'||!data)throw Error('Belge sürümüne erişilemiyor.');
 const signed=await client.storage.from('documents').createSignedUrl(data,60);if(signed.error||!signed.data?.signedUrl)throw Error('Bağlantı oluşturulamadı.');return signed.data.signedUrl;
}
