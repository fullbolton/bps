import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {entries} from './talent-module-gates.mjs';
const once=(text,from,to)=>{if(text.split(from).length!==2)throw Error('Conversation anchor drift');return text.replace(from,()=>to);};
export const patches=['talent_conversation_list','talent_conversation_save'].map(name=>{
 const e=entries.find(e=>e.name===name),previous=e.body.replace(e.anchor,()=>e.anchor+e.guard);
 let body;
 if(name==='talent_conversation_list'){
  body=once(previous,' SELECT coalesce(',` IF NOT (public.current_workspace_modules_v1()->'modules'->>'staffing')::boolean THEN
  SELECT coalesce(jsonb_agg((e.value-'requestContext')||jsonb_build_object('requestContext',NULL,'requestContextHidden',e.value->>'requestId' IS NOT NULL) ORDER BY e.n),'[]') INTO result
  FROM jsonb_array_elements(rows) WITH ORDINALITY e(value,n);
  RETURN result;
 END IF;
 SELECT coalesce(`);
  body=once(body,"jsonb_build_object('requestContext',CASE","jsonb_build_object('requestContextHidden',false,'requestContext',CASE");
 }else{
  // Add to the existing module barrier, before any profile/business locks.
  body=once(previous,e.guard,e.guard+" IF p_input->>'requestId' IS NOT NULL THEN\n  PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY['staffing']);\n END IF;\n");
 }
 return {...e,previous,body,hash:createHash('sha256').update(previous).digest('hex')};
});
const q=s=>"'"+s.replaceAll("'","''")+"'";
export const migrationUrl=new URL('../supabase/migrations/20261005002600_talent_conversation_modules.sql',import.meta.url);
export function render(){return `-- Historical talent conversations remain readable; live staffing context is optional.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE item record;target regprocedure;original text;definition text;
BEGIN
 FOR item IN SELECT * FROM (VALUES
${patches.map(e=>`(${q(e.signature)},${q(e.hash)},${q(e.body)})`).join(',\n')}
 ) AS patches(signature,hash,body) LOOP
  target:=to_regprocedure(item.signature);
  IF target IS NULL OR NOT EXISTS(SELECT FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=target AND p.prosecdef AND l.lanname='plpgsql') THEN RAISE EXCEPTION 'CONVERSATION_MODULE_SIGNATURE_DRIFT';END IF;
  SELECT prosrc INTO original FROM pg_proc WHERE oid=target;
  IF encode(sha256(convert_to(original,'UTF8')),'hex')<>item.hash THEN RAISE EXCEPTION 'CONVERSATION_MODULE_BODY_DRIFT';END IF;
  definition:=pg_get_functiondef(target);
  IF strpos(definition,original)=0 THEN RAISE EXCEPTION 'CONVERSATION_MODULE_ANCHOR_DRIFT';END IF;
  EXECUTE replace(definition,original,item.body);
 END LOOP;
END $patch$;
COMMIT;
`;}
if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){if(process.argv.includes('--check')){if(readFileSync(migrationUrl,'utf8')!==render())throw Error('Conversation migration drift');}else writeFileSync(migrationUrl,render());}
