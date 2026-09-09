// Test-only loader: executes actual TS service modules without a second implementation.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=new URL('../../src/',import.meta.url);
const cache=new Map();
function compiledUrl(file){
  if(cache.has(file.href))return cache.get(file.href);
  let code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  const ast=ts.createSourceFile(fileURLToPath(file),code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const replacements=[];
  function visit(node){
    const literal=(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))?node.moduleSpecifier:
      ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword?node.arguments[0]:null;
    if(literal&&ts.isStringLiteral(literal)){
      const spec=literal.text;
      if(spec.startsWith('@/')||spec.startsWith('.')){
        const target=spec.startsWith('@/')?new URL(spec.slice(2)+'.ts',root):new URL(spec+'.ts',file);
        replacements.push({start:literal.getStart(ast),end:literal.end,value:JSON.stringify(compiledUrl(target))});
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(ast);
  for(const r of replacements.sort((a,b)=>b.start-a.start))code=code.slice(0,r.start)+r.value+code.slice(r.end);
  const result='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
  cache.set(file.href,result);return result;
}
export const importActualTypeScript=file=>import(compiledUrl(file));
