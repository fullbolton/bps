// Narrow source contract for the status-only command route, not an authorization proof.
// SQL payload/role/module enforcement is exercised separately by database tests.
export function companyStatusContract(ts, actions, commands, actionName, status) {
 if(typeof actions!=='string'||typeof commands!=='string')return false;
 const parse=(name,source)=>ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const a=parse('actions.ts',actions),c=parse('commands.ts',commands);
 if(!Array.isArray(a.parseDiagnostics)||!Array.isArray(c.parseDiagnostics)||a.parseDiagnostics.length||c.parseDiagnostics.length)return false;
 const printer=ts.createPrinter({removeComments:true});
 const text=node=>printer.printNode(ts.EmitHint.Unspecified,node,node.getSourceFile()).replace(/\s/g,'');
 const fn=(file,name)=>{const matches=file.statements.filter(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);return matches.length===1?matches[0]:null;};
 const onlyReturnCall=(f,name,args)=>{
  if(!f?.body||f.body.statements.length!==1)return false;
  const statement=f.body.statements[0],call=statement.expression;
  return ts.isReturnStatement(statement)&&call&&ts.isCallExpression(call)&&ts.isIdentifier(call.expression)&&call.expression.text===name&&call.arguments.length===args.length&&call.arguments.every((arg,i)=>typeof args[i]==='function'?args[i](arg):text(arg)===args[i]);
 };
 if(!onlyReturnCall(fn(a,actionName),'changeCompanyStatus',['companyId',n=>ts.isStringLiteral(n)&&n.text===status]))return false;
 const imported=a.statements.some(n=>ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&n.moduleSpecifier.text==='@/lib/supabase/company-commands'
  &&n.importClause?.namedBindings&&ts.isNamedImports(n.importClause.namedBindings)&&n.importClause.namedBindings.elements.some(e=>e.name.text==='setCompanyStatus'&&!e.propertyName&&!e.isTypeOnly));
 if(!imported)return false;
 const shared=fn(a,'changeCompanyStatus');if(!shared?.body)return false;
 const calls=[];const visit=n=>{if(ts.isCallExpression(n))calls.push(n);ts.forEachChild(n,visit);};visit(shared.body);
 const writes=calls.filter(n=>ts.isIdentifier(n.expression)&&n.expression.text==='setCompanyStatus');
 if(writes.length!==1||writes[0].arguments.map(text).join('|')!=='supabase|companyId|tenant.data|identity.data.user.id|status')return false;
 if(calls.some(n=>ts.isPropertyAccessExpression(n.expression)&&['insert','update','delete','upsert'].includes(n.expression.name.text)))return false;
 return onlyReturnCall(fn(c,'setCompanyStatus'),'execute',['client',n=>ts.isStringLiteral(n)&&n.text==='status','companyId','tenantId','actorId',n=>ts.isObjectLiteralExpression(n)&&n.properties.length===1&&ts.isShorthandPropertyAssignment(n.properties[0])&&n.properties[0].name.text==='status']);
}
