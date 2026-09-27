export function writeWorkCopy(rows:string[][],signal:AbortSignal,createWorker:()=>Worker,kind:'people'|'preview'='people'):Promise<ArrayBuffer>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(new DOMException('İptal edildi','AbortError'));return;}
  let worker:Worker;try{worker=createWorker();}catch{reject(Error('Excel hazırlayıcısı başlatılamadı.'));return;}
  let settled=false;
  const finish=(error?:Error,bytes?:ArrayBuffer)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);worker.terminate();if(error)reject(error);else resolve(bytes!);};
  const abort=()=>finish(new DOMException('İptal edildi','AbortError'));
  const timer=setTimeout(()=>finish(Error('Excel hazırlama süresi aşıldı. Dosya oluşturulmadı.')),30000);
  signal.addEventListener('abort',abort,{once:true});
  worker.onmessage=e=>{const d=e.data;if(d?.ok===true&&d.bytes instanceof ArrayBuffer&&d.bytes.byteLength>0&&d.bytes.byteLength<=10*1024*1024)finish(undefined,d.bytes);else finish(Error('Excel hazırlanamadı veya 10 MB sınırını aştı. Dosya oluşturulmadı.'));};
  worker.onerror=()=>finish(Error('Excel hazırlanamadı. Dosya oluşturulmadı.'));
  worker.onmessageerror=()=>finish(Error('Excel sonucu okunamadı.'));
  try{worker.postMessage({rows,kind});}catch{finish(Error('Excel hazırlayıcısına veriler iletilemedi.'));}
 });
}

/** Download only a completed workbook; revoke after the browser has consumed the URL. */
export function downloadWorkbook(bytes:ArrayBuffer,filename:string){
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const link=document.createElement('a');link.href=url;link.download=filename;
 try{document.body.appendChild(link);link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
}
