/** Inspect declared ZIP expansion before a workbook decoder runs.
 * Metadata limits do not verify actual inflated bytes; decoding still needs a worker. */
export function assertWorkbookZipBounds(bytes: ArrayBuffer): void {
   const v=new DataView(bytes);let end=-1;
   for(let p=v.byteLength-22;p>=Math.max(0,v.byteLength-65557);p--)if(v.getUint32(p,true)===0x06054b50&&p+22+v.getUint16(p+20,true)===v.byteLength){end=p;break;}
   if(end<0||v.getUint16(end+4,true)!==0||v.getUint16(end+6,true)!==0)throw Error("Geçerli bir XLSX dosyası seçin. Dosyayı Excel’den yeniden kaydedip deneyin.");
   const count=v.getUint16(end+10,true),size=v.getUint32(end+12,true);let p=v.getUint32(end+16,true),expanded=0;
   if(count>2000||count===65535||v.getUint16(end+8,true)!==count||p+size!==end)throw Error("Excel dosyası desteklenen arşiv sınırlarını aşıyor. Daha küçük bir dosya seçin.");
   for(let i=0;i<count;i++){
    if(p+46>end||v.getUint32(p,true)!==0x02014b50||v.getUint16(p+8,true)&1)throw Error("Excel dosyasının arşiv yapısı desteklenmiyor veya dosya şifreli.");
    const length=v.getUint32(p+24,true);expanded+=length;if(length>64*1024*1024||expanded>128*1024*1024)throw Error("Excel dosyasının açılmış içeriği boyut sınırını aşıyor. Dosyayı bölüp deneyin.");
    p+=46+v.getUint16(p+28,true)+v.getUint16(p+30,true)+v.getUint16(p+32,true);
   }
   if(p!==end)throw Error("Excel dosyasının arşiv yapısı desteklenmiyor veya dosya şifreli.");
}
