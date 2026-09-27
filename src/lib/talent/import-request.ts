import {extendedImportFields} from './import-fields';
import {compareSourcePeople,type SourcePerson,type CompareSnapshot,type ComparedRow} from './import-compare';
import {reviewImportDecisions,type DecisionMap} from './import-decisions';
import {validateImportRequest,type ImportBatchRow,type ImportFieldKey} from './import-batches';
export async function buildImportRequests(rows:SourcePerson[],snapshot:CompareSnapshot,decisions:DecisionMap,matched?:ComparedRow[]){
 const comparison=matched??compareSourcePeople(rows,snapshot),review=reviewImportDecisions(rows,snapshot,decisions,comparison);
 if(!review.ready)throw Error('Tüm satır kararlarını ve çakışmaları çözün.');
 const plan:ImportBatchRow[]=rows.map((r,i)=>{
  const d=decisions[r.number];if(d.kind==='hold')return {number:r.number,kind:'hold'};
  const source={name:r.name,city:r.city,phone:r.phone,email:r.email,...Object.fromEntries(extendedImportFields.filter(k=>r[k]!==undefined).map(k=>[k,r[k]]))};if(d.kind==='new')return {number:r.number,kind:'new',source};
  const candidate=comparison[i].candidates.find(c=>c.person.id===d.personId)!;
  const fields=d.changes.map(n=>{const change=candidate.differences[n];return change.field==='contacts'?change.contactKind!:change.field;}).sort() as ImportFieldKey[];
  // Existing-row v1 validation still requires a name. Reuse the already
  // stored name when it is not selected; never send rejected source values.
  const selectedSource={name:fields.includes('name')?r.name:candidate.person.name,
   city:fields.includes('city')?r.city:'',phone:candidate.differences.find((c,n)=>d.changes.includes(n)&&c.contactKind==='phone')?.after??'',email:candidate.differences.find((c,n)=>d.changes.includes(n)&&c.contactKind==='email')?.after??'',...Object.fromEntries(extendedImportFields.filter(k=>fields.includes(k)).map(k=>[k,r[k]]))};
  return {number:r.number,kind:'existing',source:selectedSource,targetId:d.personId,expectedRevision:candidate.person.revision,fields};
 });
 return splitImportPlan(plan);
}

/** Validate decisions across the whole file before partitioning: duplicate targets cannot hide across parts. */
export async function splitImportPlan(plan:ImportBatchRow[]){
 if(!plan.length||plan.length>50000)throw Error('TALENT_IMPORT_LIMIT');
 const numbers=new Set<number>(),targets=new Set<string>();
 for(const row of plan){if(numbers.has(row.number))throw Error('TALENT_IMPORT_RESPONSE');numbers.add(row.number);if(row.kind==='existing'){if(targets.has(row.targetId))throw Error('TALENT_IMPORT_RESPONSE');targets.add(row.targetId);}}
 const chunks:ImportBatchRow[][]=[];let chunk:ImportBatchRow[]=[],bytes=2;
 for(const row of plan){const size=new TextEncoder().encode(JSON.stringify(row)).length;if(size+2>1000000)throw Error('TALENT_IMPORT_LIMIT');if(chunk.length===500||bytes+size+(chunk.length?1:0)>1000000){chunks.push(chunk);chunk=[];bytes=2;}bytes+=size+(chunk.length?1:0);chunk.push(row);}
 if(chunk.length)chunks.push(chunk);
 return Promise.all(chunks.map(async rows=>{
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({version:1,rows})));
  const sourceHash=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
  return validateImportRequest({batchId:crypto.randomUUID(),sourceHash,total:rows.length,rows});
 }));
}

export async function buildImportRequest(rows:SourcePerson[],snapshot:CompareSnapshot,decisions:DecisionMap){
 const parts=await buildImportRequests(rows,snapshot,decisions);
 if(parts.length!==1)throw Error('TALENT_IMPORT_LIMIT');
 return parts[0];
}
