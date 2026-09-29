// Replay only the two reviewed historical migration blocks. This is not a general SQL parser.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=name=>readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8');
const roles=read('20260926000100_multi_workspace_cutover.sql').split('-- 05_operation_roles.sql')[1].split('END $patch$;')[0]+'END $patch$;';
const shift=read('20260927000100_shift_scheduling.sql');
const roleRows=[...roles.matchAll(/\('(public\.[^']+)',\$old\$([\s\S]*?)\$old\$,\$new\$([\s\S]*?)\$new\$,(\d+)\)/g)];
if(roleRows.length!==8)throw Error('Role patch layout changed');
const literal="'((?:''|[^'])*)'";
const shiftRows=[...shift.matchAll(new RegExp('SELECT pg_temp\\.shift_patch\\('+literal+',\\s*'+literal+',\\s*'+literal+'\\);','g'))];
if(shiftRows.length!==7)throw Error('Shift patch layout changed');
const decode=s=>s.replaceAll("''","'");
const changes=[...roleRows.map(m=>({signature:m[1],old:m[2],next:m[3],count:Number(m[4])})),...shiftRows.map(m=>({signature:decode(m[1]),old:decode(m[2]),next:decode(m[3]),count:1}))];
const times=shift.split('-- 07_start_times')[1].split('COMMIT;')[0];
// These assignments are individually extracted, so both model and DB fixture use the committed historical text.
const timeChanges=[...times.matchAll(new RegExp('old_text:='+literal+';new_text:='+literal+';','g'))].map(m=>({old:decode(m[1]),next:decode(m[2]),count:1}));
if(timeChanges.length!==3)throw Error('Start time patch layout changed');
changes.push(...timeChanges.slice(0,2).map(c=>({...c,signature:'public.ops_start_board_filtered(uuid,uuid,date,integer,text,boolean,boolean)'})),{...timeChanges[2],signature:'public.ops_start_board(uuid,uuid,date,integer)'});
const board=shift.split('-- 05_board')[1].split('-- 06_week')[0];
const boardPattern=new RegExp('old_text:='+literal+';\\s*new_text:=(?:'+literal+'|\\$fragment\\$([\\s\\S]*?)\\$fragment\\$);','g');
const boardChanges=[...board.matchAll(boardPattern)].map(m=>({old:decode(m[1]),next:m[2]===undefined?m[3]:decode(m[2]),count:1,signature:'public.ops_board(uuid,date)'}));
if(boardChanges.length!==2)throw Error('Board patch layout changed');
changes.push(...boardChanges);
const week=shift.split('-- 06_week')[1].split('-- 07_start_times')[0];
const firstWeekOld=week.match(new RegExp('old_text:='+literal+';'));
const firstWeekNew=week.match(new RegExp('d:=replace\\(d,old_text,'+literal+'\\);'));
const secondWeek=[...week.matchAll(new RegExp('old_text:='+literal+';\\s*new_text:='+literal+';','g'))];
if(!firstWeekOld||!firstWeekNew||secondWeek.length!==1)throw Error('Week patch layout changed');
for(const signature of ['public.ops_week(uuid,date)','public.ops_attendance_week(uuid,date)'])changes.push(
 {signature,old:decode(firstWeekOld[1]),next:decode(firstWeekNew[1]),count:1},
 {signature,old:decode(secondWeek[0][1]),next:decode(secondWeek[0][2]),count:1});
export function withOperationsHistory(entry){
 let body=entry.body;const applied=[];
 for(const c of changes.filter(c=>c.signature===entry.signature)){
  if(body.split(c.old).length-1!==c.count)throw Error('Historical operation source drift: '+entry.signature);
  body=body.replaceAll(c.old,c.next);applied.push(c);
 }
 return {...entry,baseBody:entry.body,baseDeclaration:entry.declaration,body,appliedHistoryCount:applied.length,
  declaration:entry.declaration.replace(entry.body,()=>body),hash:createHash('sha256').update(body).digest('hex')};
}
export function historicalOperationsSql(signatures){
 const selected=new Set(signatures),q=s=>"'"+s.replaceAll("'","''")+"'";
 // Execute the original role DO block; scope it to functions under test, not to an alternate implementation.
 const roleBlock=roles.slice(roles.indexOf('DO $patch$')).replace('AS changes(signature,old_expression,new_expression,expected_count) LOOP',`AS changes(signature,old_expression,new_expression,expected_count) WHERE signature=ANY(ARRAY[${signatures.map(q).join(',')}]) LOOP`);
 const helper=shift.slice(shift.indexOf('CREATE FUNCTION pg_temp.shift_patch'),shift.indexOf('SELECT pg_temp.shift_patch'));
 const calls=shiftRows.filter(m=>selected.has(decode(m[1]))).map(m=>m[0]).join('\n');
 const timeNames=['public.ops_start_board(uuid,uuid,date,integer)','public.ops_start_board_filtered(uuid,uuid,date,integer,text,boolean,boolean)'];
 if(timeNames.some(n=>selected.has(n))&&!timeNames.every(n=>selected.has(n)))throw Error('History fixture requires both start boards');
 const weekNames=['public.ops_week(uuid,date)','public.ops_attendance_week(uuid,date)'];
 if(weekNames.some(n=>selected.has(n))&&!weekNames.every(n=>selected.has(n)))throw Error('History fixture requires both weekly readers');
 return roleBlock+'\n'+helper+'\n'+calls+'\n'+(timeNames.every(n=>selected.has(n))?times:'')
  +'\n'+(selected.has('public.ops_board(uuid,date)')?board:'')+'\n'+(weekNames.every(n=>selected.has(n))?week:'');
}
