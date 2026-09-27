import {isUuid} from '@/lib/operations/pilot-validation';
import {attachmentCategories,type AttachmentCategory} from './attachments';
import {checkTalentScope,type TalentScope} from './people';

type CommandStorage = Pick<Storage,'getItem'|'setItem'|'removeItem'>;

/** Store only an opaque command UUID. File contents and names stay out of browser storage. */
function attachmentCommandKey(scope:TalentScope,personId:string,category:AttachmentCategory,fingerprint:string){
 checkTalentScope(scope);
 if(!isUuid(personId)||!Object.hasOwn(attachmentCategories,category)||!/^[a-f0-9]{64}$/.test(fingerprint))throw Error('ATTACHMENT_COMMAND_INVALID');
 return `bps:attachment:v1:${scope.actorId}:${scope.tenantId}:${personId}:${category}:${fingerprint}`;
}

export function attachmentCommand(storage:CommandStorage,scope:TalentScope,personId:string,category:AttachmentCategory,fingerprint:string,createId:()=>string){
 const key=attachmentCommandKey(scope,personId,category,fingerprint);
 const existing=storage.getItem(key);
 if(existing!==null){
  if(!isUuid(existing))throw Error('ATTACHMENT_COMMAND_INVALID');
  return {key,id:existing};
 }
 const id=createId();if(!isUuid(id))throw Error('ATTACHMENT_COMMAND_INVALID');
 storage.setItem(key,id);
 // Some browser modes silently ignore storage writes. Never start an unrecoverable upload.
 if(storage.getItem(key)!==id)throw Error('ATTACHMENT_COMMAND_STORAGE');
 return {key,id};
}

export function clearAttachmentCommand(storage:CommandStorage,command:{key:string;id:string}){
 // Do not remove a command another tab has replaced.
 if(storage.getItem(command.key)!==command.id)return false;
 storage.removeItem(command.key);
 return storage.getItem(command.key)===null;
}

export type AttachmentCommandLocks = {
 request<T>(name:string,callback:()=>T|PromiseLike<T>):Promise<T>;
};

/** Coordinate the read/create/write across tabs; do not silently fall back to an unlocked write. */
export async function reserveAttachmentCommand(storage:CommandStorage,locks:AttachmentCommandLocks|undefined,scope:TalentScope,personId:string,category:AttachmentCategory,fingerprint:string,createId:()=>string){
 if(!locks||typeof locks.request!=='function')throw Error('ATTACHMENT_COMMAND_LOCK_UNAVAILABLE');
 const key=attachmentCommandKey(scope,personId,category,fingerprint);
 return locks.request(`${key}:lock`,()=>attachmentCommand(storage,scope,personId,category,fingerprint,createId));
}

/** Confirmation must share the reservation lock: comparison and removal are one critical section. */
export async function settleAttachmentCommand(storage:CommandStorage,locks:AttachmentCommandLocks|undefined,command:{key:string;id:string}){
 if(!locks||typeof locks.request!=='function')throw Error('ATTACHMENT_COMMAND_LOCK_UNAVAILABLE');
 return locks.request(`${command.key}:lock`,()=>clearAttachmentCommand(storage,command));
}

/** Release matching opaque references only after the server confirms cancellation and cleanup. */
export async function settleCancelledAttachment(storage:Storage,locks:AttachmentCommandLocks|undefined,scope:TalentScope,personId:string,id:string){
 checkTalentScope(scope);if(!isUuid(personId)||!isUuid(id))throw Error('ATTACHMENT_COMMAND_INVALID');
 const prefix=`bps:attachment:v1:${scope.actorId}:${scope.tenantId}:${personId}:`;
 const keys=Array.from({length:storage.length},(_,i)=>storage.key(i)).filter((key):key is string=>!!key&&key.startsWith(prefix));
 for(const key of keys)if(storage.getItem(key)===id)await settleAttachmentCommand(storage,locks,{key,id});
}
