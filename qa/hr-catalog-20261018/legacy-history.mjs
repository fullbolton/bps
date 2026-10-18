// Characterization of the real shipped parser: do not weaken it to hide HR events.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {importActualTypeScript} from '../../scripts/helpers/import-typescript.mjs';
const {parseModuleHistory}=await importActualTypeScript(new URL('../../src/lib/modules/change-history.ts',import.meta.url));
const {MODULE_CATALOG}=await importActualTypeScript(new URL('../../src/lib/modules/catalog.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const modules=Object.fromEntries(MODULE_CATALOG.map(m=>[m.key,true]));
const context={actorId:id(1),tenantId:id(2),membershipVersion:id(3),selectionVersion:null,name:'Synthetic',role:'yonetici',schemaVersion:1,catalogVersion:1,configRevision:'2',modules};
const bootstrap={kind:'bootstrap',revision:'1',createdAt:'2026-10-18T00:00:00Z',actorName:null,before:{},after:modules};
const hr={kind:'settings',revision:'2',createdAt:'2026-10-18T01:00:00Z',actorName:'Synthetic',before:{...modules,hr:false},after:{...modules,hr:true}};
assert.throws(()=>parseModuleHistory({context,entries:[hr,bootstrap]},context),/MODULE_CONFIG_RESPONSE/);
assert.throws(()=>parseModuleHistory({context,entries:[{...hr,before:modules,after:modules},bootstrap]},context),/MODULE_HISTORY_ENTRY/);
assert.throws(()=>parseModuleHistory({context,entries:[bootstrap]},context),/MODULE_HISTORY_SCOPE/);
writeFileSync(new URL('./legacy-history-result.json',import.meta.url),JSON.stringify({measuredAt:new Date().toISOString(),checks:['Raw HR-only history event rejected by exact v1 state parser','Stripping HR produces no-op event, correctly rejected','Dropping HR event breaks revision/entry count, correctly rejected'],decision:'A compatibility-aware client/history contract must precede HR activation; do not filter or fabricate history to satisfy old parser',productionChanged:false},null,2)+'\n');
console.log('PASS 3 real legacy history incompatibility characterizations');
