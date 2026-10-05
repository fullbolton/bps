// A hotfix may encounter the exact release body or its reviewed module-guarded body.
// Unknown edits still abort; guards must never be stripped by a business fix.
import {createHash} from 'node:crypto';
import {entries as operations} from '../operations-module-gates.mjs';
import {entries as talent} from '../talent-module-gates.mjs';
import {entries as reporting} from '../reporting-module-gates.mjs';
const gates=new Map([...operations,...talent,...reporting].map(e=>[e.signature,e]));
const hash=s=>createHash('sha256').update(s).digest('hex');
export function variants(signature,body,next){
 const result=[{hash:hash(body),body:next}],gate=gates.get(signature);
 if(gate){
  if(gate.body!==body)throw Error('Hotfix/module baseline mismatch: '+signature);
  const guard=s=>s.replace(gate.anchor,()=>gate.anchor+gate.guard);
  result.push({hash:hash(guard(body)),body:guard(next)});
 }
 return result;
}
export function renderPatches(patches){
 const q=s=>"'"+s.replaceAll("'","''")+"'";
 const data=patches.map(e=>({signature:e.signature,variants:variants(e.signature,e.body,e.next)}));
 return `BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE entry record;candidate jsonb;target regprocedure;original text;definition text;next_body text;
BEGIN
 FOR entry IN SELECT * FROM (VALUES
${data.map(e=>`(${q(e.signature)},jsonb_build_array(${e.variants.map(v=>`jsonb_build_object('hash',${q(v.hash)},'body',${q(v.body)})`).join(',')}))`).join(',\n')}
 ) AS patches(signature,variants) LOOP
  target:=to_regprocedure(entry.signature);
  IF target IS NULL THEN RAISE EXCEPTION 'HOTFIX_SIGNATURE_MISSING: %',entry.signature;END IF;
  SELECT prosrc INTO original FROM pg_proc WHERE oid=target;
  next_body:=NULL;
  FOR candidate IN SELECT value FROM jsonb_array_elements(entry.variants) LOOP
   IF encode(sha256(convert_to(original,'UTF8')),'hex')=candidate->>'hash' THEN next_body:=candidate->>'body';EXIT;END IF;
  END LOOP;
  IF next_body IS NULL THEN RAISE EXCEPTION 'HOTFIX_SOURCE_DRIFT: %',entry.signature;END IF;
  definition:=pg_get_functiondef(target);
  IF strpos(definition,original)=0 THEN RAISE EXCEPTION 'HOTFIX_DEFINITION_DRIFT';END IF;
  EXECUTE replace(definition,original,next_body);
 END LOOP;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
`;
}
