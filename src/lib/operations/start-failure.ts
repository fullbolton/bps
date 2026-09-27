import {isStartRejection,startError} from './start-board';
import {reconcilePending,type CommandScope} from './pending-commands';

/** A rejection of this request does not prove that a prior attempt never committed. */
export async function settleStartFailure(
 error:unknown,id:string,scope:CommandScope,storage:Pick<Storage,'getItem'|'setItem'>,
 locks:Parameters<typeof reconcilePending>[4],readAndClose:(ids:string[])=>Promise<unknown>
):Promise<{state:'confirmed'|'closed'|'unknown';message:string}>{
 if(!isStartRejection(error))return {state:'unknown',message:startError(error)};
 try{
  const value=await readAndClose([id]);
  const result=await reconcilePending(scope,[id],value,storage,locks);
  if(result.confirmed===1)return {state:'confirmed',message:'Bu işlem daha önce kaydedilmiş. Liste güncellendi.'};
  if(result.closed===1)return {state:'closed',message:startError(error)+' Bu deneme kaydedilmedi; alanları kontrol edip yeniden deneyebilirsiniz.'};
 }catch{/* A lost response, scope denial or storage failure must preserve uncertainty. */}
 return {state:'unknown',message:startError(error)+' Önceki denemenin sonucu doğrulanamadı; bekleyen işlem korundu.'};
}
