// Alters only the disposable browser fixture's response, never stored business data.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const [db,mode]=process.argv.slice(2);
if(!/^bps_storage_http_[0-9]+$/.test(db)||!['future','normal'].includes(mode))throw Error('Disposable database and known mode required');
const server='supabase_db_bps-supabase-acceptance';
const source=readFileSync(new URL('../../supabase/migrations/20261019000100_module_history_catalog_versions.sql',import.meta.url),'utf8');
let definition=source.slice(source.indexOf('CREATE FUNCTION'),source.indexOf('REVOKE ALL')).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
if(mode==='future')definition=definition.replace(" RETURN jsonb_build_object('historySchemaVersion'", " context:=jsonb_set(context,'{catalogVersion}','2');\n RETURN jsonb_build_object('historySchemaVersion'");
execFileSync('docker',['exec','-i',server,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],{input:definition,stdio:['pipe','pipe','pipe']});
console.log(`Disposable history response: ${mode}`);
