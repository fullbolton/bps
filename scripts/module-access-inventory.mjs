// Planning inventory, not a proof of runtime authorization. Dynamic calls stay visible.
import {readFileSync,readdirSync,statSync,mkdirSync,writeFileSync,realpathSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const output='qa/tenant-modules-foundation-20260928';
const files=[];
function walk(path,ancestors=new Set()){
 const real=realpathSync(path);if(ancestors.has(real))throw Error('Inventory symlink loop: '+path);
 const next=new Set(ancestors).add(real);
 for(const name of readdirSync(path).sort()){
  const entry=path+'/'+name,stat=statSync(entry);
  if(stat.isDirectory())walk(entry,next);
  else if(stat.isFile()&&/\.tsx?$/.test(name))files.push(entry);
  else if(!stat.isFile())throw Error('Inventory special file: '+entry);
 }
}
walk('src');if(!files.length)throw Error('No source files');
const routes=[],calls=[];
const routeOwners={firmalar:'customers',gorevler:'tasks',randevular:'calendar',evraklar:'documents',sozlesmeler:'contracts','personel-havuzu':'talent',talepler:'staffing','aktif-isgucu':'staffing',projeler:'reporting','finansal-ozet':'finance','luca-import':'finance',import:'customers/contracts','kurumsal-tarihler':'shared/projection',dashboard:'projection',raporlar:'projection',yonetim:'projection',ayarlar:'infrastructure',kurulum:'projection',davet:'infrastructure',admin:'platform',login:'identity',kayit:'identity','sirket-sec':'identity',auth:'identity',api:'review'};
const member=node=>ts.isPropertyAccessExpression(node)?node.name.text:ts.isElementAccessExpression(node)&&node.argumentExpression&&(ts.isStringLiteral(node.argumentExpression)||ts.isNoSubstitutionTemplateLiteral(node.argumentExpression))?node.argumentExpression.text:null;
const transparent=node=>ts.isParenthesizedExpression(node)||ts.isNonNullExpression(node)||ts.isAsExpression(node)||ts.isTypeAssertionExpression(node)||ts.isSatisfiesExpression(node);
function chainCalls(node){
 const methods=[];let current=node;
 while(current.parent){
  const parent=current.parent;
  if(transparent(parent)&&parent.expression===current){current=parent;continue;}
  if((ts.isPropertyAccessExpression(parent)||ts.isElementAccessExpression(parent))&&parent.expression===current){current=parent;continue;}
  if(ts.isCallExpression(parent)&&parent.expression===current){methods.push(member(parent.expression)??'<dynamic>');current=parent;continue;}
  break;
 }
 return methods;
}
for(const file of files){
 const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 if(!Array.isArray(source.parseDiagnostics)||source.parseDiagnostics.length)throw Error('Cannot parse '+file);
 if(/\/(page\.tsx|route\.ts)$/.test(file)){
  const route='/'+file.replace(/^src\/app\//,'').replace(/\([^/]+\)\//g,'').replace(/\/(page\.tsx|route\.ts)$/,'').replace(/^page\.tsx$/,'');
  const root=route.split('/')[1];routes.push({route,file,owner:routeOwners[root]??(route==='/'?'public':'review')});
 }
 function visit(node){
  if(ts.isCallExpression(node)){
   const method=member(node.expression);
   if((method==='from'||method==='rpc') && !['Array.from','Buffer.from','Uint8Array.from'].includes(node.expression.getText(source))){
    const arg=node.arguments[0],literal=arg&&(ts.isStringLiteral(arg)||ts.isNoSubstitutionTemplateLiteral(arg));
    calls.push({file,line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,
     kind:method==='rpc'?'rpc':/\.storage\b/.test(node.expression.getText(source))?'storage':'table-candidate',
     target:literal?arg.text:'<dynamic>',expression:node.expression.getText(source),operations:chainCalls(node)});
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(source);
}
// Latest textual declaration; SQL catalog/ACL measurement is a separate required M2 input.
const functions=new Map();
for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()){
 const sql=readFileSync('supabase/migrations/'+file,'utf8');
 for(const match of sql.matchAll(/^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-z0-9_]+)\s*\(/gim)){
  functions.set(match[1],{name:match[1],file:'supabase/migrations/'+file,line:sql.slice(0,match.index).split('\n').length});
 }
}
const data={baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceFileCount:files.length,routeCount:routes.length,callCount:calls.length,
 caveats:['Static .from/.rpc candidates; not an authorization proof.','SQL declarations indexed by name, not signature; overloads, drops and effective grants require database catalog verification.','Calls through aliases/helpers/SDK internals are not resolved.','storage upload/download/remove and service-role consumers require manual review.'],routes,calls,sqlFunctionDeclarations:[...functions.values()].sort((a,b)=>a.name.localeCompare(b.name))};
mkdirSync(output,{recursive:true});writeFileSync(output+'/access-inventory.json',JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({sourceFiles:data.sourceFileCount,routes:data.routeCount,calls:data.callCount,dynamicCalls:calls.filter(c=>c.target==='<dynamic>').length,sqlNames:functions.size}));
