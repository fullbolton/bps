// Synthetic layout QA only: extracts the actual report JSX and print CSS. Does not authenticate or connect to Supabase.
// Requires a compiled .next/static/css/app/layout.css, BPS_PLAYWRIGHT_MODULE and optional BPS_CHROME_EXECUTABLE.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const ts=require(root+'/node_modules/typescript');
const React=require(root+'/node_modules/react');
const {renderToStaticMarkup}=require(root+'/node_modules/react-dom/server');
const {chromium}=require(process.env.BPS_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const file=root+'/src/app/(main)/talepler/haftalik/WeeklyOperations.tsx';const source=fs.readFileSync(file,'utf8');
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let section;
 function visit(n){if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(ast)==='section'&&n.openingElement.attributes.getText(ast).includes('Haftalık plan'))section=n;ts.forEachChild(n,visit);}visit(ast);if(!section)throw Error('Report JSX not found');
 const markup=section.getText(ast); let printCss; function styles(n){if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(ast)==='style'){const e=n.children.find(ts.isJsxExpression)?.expression;if(e&&ts.isStringLiteral(e))printCss=e.text;}ts.forEachChild(n,styles);}styles(ast);if(!printCss)throw Error('Print CSS missing');
 const code=ts.transpileModule('return ('+markup+');',{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
 const {addDays,weeklyTotals}=await import(root+'/scripts/helpers/import-typescript.mjs').then(m=>m.importActualTypeScript(new URL('file://'+root+'/src/lib/operations/weekly-plan.ts')));
 const render=new Function('React','current','start','end','showCancelled','totals','rows','companyId','dayLabel','addDays','weeklyTotals','Link','EmptyState',code);
 const dayLabel=d=>new Intl.DateTimeFormat('tr-TR',{timeZone:'UTC',day:'2-digit',month:'2-digit',weekday:'short'}).format(new Date(d+'T00:00:00Z'));
 const dir=process.env.BPS_PRINT_OUTPUT||fs.mkdtempSync('/private/tmp/bps-weekly-print-');fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.BPS_CHROME_EXECUTABLE,headless:true});
 try{for(const [name,count] of [['single',1],['multi',40],['long',1]]){
 const rows=Array.from({length:count},(_,i)=>({id:String(i),locationName:'ŞUBE_'+String(i).padStart(3,'0')+' İstanbul Kadıköy Hizmet Noktası',city:'İstanbul',workDate:'2026-09-09',serviceLine:'Temizlik',position:'Temizlik görevlisi',requiredCount:4,lifecycle:'active',assignments:[{name:'Çağrı Öztürk'},{name:'Şükran Çelik'}]}));
 if(name==='long'){rows[0].requiredCount=100;rows[0].assignments=Array.from({length:100},(_,i)=>({name:'PERSONEL_'+String(i).padStart(3,'0')+' Çağrı Şükran Öztürk'}));}
 const current={companyId:'synthetic',companyName:'SENTETİK PDF KABUL FİRMASI',weekStart:'2026-09-07',generatedAt:'2026-09-10T13:00:00Z',requests:rows};
 const node=render(React,current,current.weekStart,'2026-09-13',false,weeklyTotals(rows),rows,current.companyId,dayLabel,addDays,weeklyTotals,({children,...p})=>React.createElement('a',p,children),()=>null);
 const html='<!doctype html><html lang="tr"><meta charset="utf-8"><style>'+fs.readFileSync(root+'/.next/static/css/app/layout.css','utf8')+'</style><style>'+printCss+'</style><body>'+renderToStaticMarkup(node)+'</body></html>';
 fs.writeFileSync(dir+'/'+name+'.html',html);const page=await browser.newPage();await page.route('**/*',r=>r.abort());await page.setContent(html);const visible=await page.locator('tbody').innerText();if(name==='long'&&(visible.match(/PERSONEL_\d{3}/g)||[]).length!==100)throw Error('Screen staff list differs');const visibleRows=await page.locator('tbody tr').evaluateAll(rs=>rs.filter(r=>getComputedStyle(r).display!=='none').length);if(visibleRows!==count)throw Error('Screen request count differs');await page.emulateMedia({media:'print'});const printed=await page.locator('tbody').innerText();if(name==='long'&&(printed.match(/PERSONEL_\d{3}/g)||[]).length!==100)throw Error('Print staff list differs');await page.pdf({path:dir+'/'+name+'.pdf',preferCSSPageSize:true,printBackground:true});await page.close();
 } }finally{await browser.close();}
 console.log(dir);
})().catch(e=>{console.error(e);process.exitCode=1});
