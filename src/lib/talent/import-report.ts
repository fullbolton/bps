import {parseImportStatus,type ImportReference,type ImportRowStatus} from './import-batches';
import type {TalentScope} from './people';
export const importStatusLabels:Record<ImportRowStatus,string>={pending:'Bekliyor',created:'Eklendi',updated:'Güncellendi',reverted:'Geri alındı',unchanged:'Bilgiler korundu',held:'Bekletildi',blocked:'İnceleme gerekiyor',cancelled:'İptal edildi'};
export const importBlockReasons:Record<string,string>={TALENT_IMPORT_MATCH:'Havuzda eşleşebilecek kişi bulundu. Yeniden karşılaştırın.',TALENT_CONFLICT:'Kişi başka işlemde değişti. Yeniden karşılaştırın.',TALENT_NOT_FOUND:'Kişi bulunamadı.',TALENT_VALIDATION:'Alanlar veya iletişim sınırı uygun değil.',TALENT_IMPORT_VALIDATION:'Kaynak bilgilerini kontrol edin.'};
export type ImportReportMode='all'|'remaining';
export function buildImportReport(input:unknown,scope:TalentScope,reference:ImportReference,mode:ImportReportMode,generatedAt:string){
 if(!['all','remaining'].includes(mode)||!Number.isFinite(Date.parse(generatedAt)))throw Error('TALENT_IMPORT_RESPONSE');
 const status=parseImportStatus(input,scope,reference);
 const selected=status.rows.filter(r=>mode==='all'||['pending','held','blocked','cancelled'].includes(r.status)).sort((a,b)=>a.number-b.number);
 const cell=(v:string|number)=>'"'+String(v).replace(/"/g,'""')+'"';
 const table:(string|number)[][]=[['Rapor zamanı (UTC)','Şirket kimliği','Aktarım kimliği','Partideki toplam kaynak satırı','Kaynak satırı','Durum kodu','Durum','Açıklama','BPS kişi kimliği','Kayıt sürümü']];
 for(const r of selected){const receipt=r.result&&'personId' in r.result?r.result:null;const reason=r.result&&'code' in r.result?importBlockReasons[r.result.code]:r.status==='held'?'Bu aktarımda işlenmedi.':r.status==='cancelled'?'İşlenmeden iptal edildi.':r.status==='pending'?'Henüz kesin sonuç yok; yeni kayıt olarak tekrar yüklemeyin.':'';
  table.push([generatedAt,status.tenantId,status.batchId,status.total,r.number,r.status,importStatusLabels[r.status],reason,receipt?.personId??'',receipt?.revision??'']);
 }
 return {csv:'\uFEFF'+table.map(row=>row.map(cell).join(';')).join('\r\n')+'\r\n',filename:`bps-aktarim-${status.batchId}-${mode==='all'?'tum-sonuclar':'incelenecekler'}.csv`,count:selected.length,total:status.total};
}
