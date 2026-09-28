import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {MODULE_CATALOG,validateModuleCatalog}=await importActualTypeScript(new URL('../src/lib/modules/catalog.ts',import.meta.url));
validateModuleCatalog(MODULE_CATALOG);
export const migrationUrl=new URL('../supabase/migrations/20260928000900_tenant_module_foundation.sql',import.meta.url);
export function renderCatalogSql(){
 const rows=MODULE_CATALOG.map(m=>` ('${m.key}',ARRAY[${m.requires.map(k=>`'${k}'`).join(',')}]::text[])`).join(',\n');
 return `-- BEGIN GENERATED MODULE CATALOG v1\nCREATE FUNCTION public.workspace_module_catalog_v1()\nRETURNS TABLE(module_key text, requires text[])\nLANGUAGE sql IMMUTABLE SET search_path='' AS $$\n VALUES\n${rows}\n$$;\nREVOKE ALL ON FUNCTION public.workspace_module_catalog_v1() FROM PUBLIC,anon,authenticated,service_role;\n-- END GENERATED MODULE CATALOG v1`;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const current=readFileSync(migrationUrl,'utf8');
 const pattern=/-- BEGIN GENERATED MODULE CATALOG v1[\s\S]*?-- END GENERATED MODULE CATALOG v1/;
 if(!pattern.test(current))throw Error('Missing generation boundary');
 const generated=current.replace(pattern,()=>renderCatalogSql());
 if(process.argv[2]==='--check'){
  if(current!==generated)throw Error('Module SQL differs from the TypeScript catalog');
  console.log(`Catalog SQL matches ${MODULE_CATALOG.length} modules`);
 }else if(process.argv[2]==='--write')writeFileSync(migrationUrl,generated);
 else throw Error('Use --check or --write (only before this migration is applied)');
}
