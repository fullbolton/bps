// Executable H0 proposal. Not imported by production; SQL/RPC wiring remains open.
import {importActualTypeScript} from '../../scripts/helpers/import-typescript.mjs';
const {MODULE_CATALOG,parseModuleStates}=await importActualTypeScript(new URL('../../src/lib/modules/catalog.ts',import.meta.url));
const keys=MODULE_CATALOG.map(m=>m.key);
export function parseV2(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length+1||!Object.hasOwn(value,'hr')||typeof value.hr!=='boolean')throw Error('CATALOG_STATE');
 const legacy=Object.fromEntries(Object.entries(value).filter(([key])=>key!=='hr'));
 return Object.freeze({...parseModuleStates(legacy),hr:value.hr});
}
export function upgradeV1(value){return parseV2({...parseModuleStates(value),hr:false});}
export function projectV1(value){const v2=parseV2(value);return parseModuleStates(Object.fromEntries(keys.map(key=>[key,v2[key]])));}
function revision(value){if(typeof value!=='string'||! /^[1-9][0-9]{0,18}$/.test(value)||BigInt(value)>9223372036854775807n)throw Error('CATALOG_REVISION');return BigInt(value);}
/** Server transition specification only: caller must authenticate, lock row, recheck
 * modules/open work, and persist receipt+revision atomically in the actual RPC. */
export function proposeChange({current,revision:currentRevision,expectedRevision,clientVersion,desired,hrEntitled=false,hrReady=false}){
 const number=revision(currentRevision);revision(expectedRevision);
 if(currentRevision!==expectedRevision)throw Error('CATALOG_STALE');
 const before=parseV2(current);
 let after;
 if(clientVersion===1)after=parseV2({...parseModuleStates(desired),hr:before.hr});
 else if(clientVersion===2)after=parseV2(desired);
 else throw Error('CATALOG_VERSION');
 if(!before.hr&&after.hr&&(!hrEntitled||!hrReady))throw Error('CATALOG_HR_UNAVAILABLE');
 const changed=[...keys,'hr'].filter(key=>before[key]!==after[key]);
 if(changed.length&&number===9223372036854775807n)throw Error('CATALOG_REVISION_EXHAUSTED');
 return Object.freeze({modules:after,revision:changed.length?String(number+1n):currentRevision,changed:Object.freeze(changed)});
}
