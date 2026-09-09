import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {transferId} from '@/lib/task-transfer';
import {parsePdfVersions} from '@/lib/contract-pdf';
type Client=SupabaseClient<Database>;
export interface PdfScope {actorId:string;tenantId:string}
export async function loadContractPdfVersions(client:Client,scope:PdfScope,contractId:string){
 const {data,error}=await client.rpc('contract_pdf_versions',{p_actor_id:transferId(scope.actorId),p_tenant_id:transferId(scope.tenantId),p_contract_id:transferId(contractId)});
 if(error)throw error;return parsePdfVersions(data,contractId);
}
export async function downloadContractPdfVersion(client:Client,scope:PdfScope,versionId:string){
 const {data:path,error}=await client.rpc('contract_pdf_version_path',{p_actor_id:transferId(scope.actorId),p_tenant_id:transferId(scope.tenantId),p_version_id:transferId(versionId)});
 if(error||typeof path!=='string'||!path)throw Error('PDF sürümüne erişilemiyor.');
 const signed=await client.storage.from('documents').createSignedUrl(path,60);
 if(signed.error||!signed.data?.signedUrl)throw Error('PDF indirme bağlantısı oluşturulamadı.');
 return signed.data.signedUrl;
}
