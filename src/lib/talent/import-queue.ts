import {importReference,type ImportReference} from './import-batches';
export function parseImportQueue(value:unknown):ImportReference[]{
 if(!Array.isArray(value)||value.length>1000)throw Error('TALENT_IMPORT_QUEUE');
 const seen=new Set<string>();
 return value.map(item=>{const ref=importReference(item);if(seen.has(ref.batchId))throw Error('TALENT_IMPORT_QUEUE');seen.add(ref.batchId);return ref;});
}
