/** Wall-clock scheduling in the operation's local calendar. Not payroll or UTC instants. */
export type ShiftClock = {startTime:string;endTime:string;nextDay:boolean};
export type ShiftWindow = {workDate:string;clock:ShiftClock|null};
const MINUTES_PER_DAY=1440;

export function clockMinutes(value:unknown):number {
 if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw Error('Saati SS:DD biçiminde girin.');
 return Number(value.slice(0,2))*60+Number(value.slice(3));
}
export function shiftDuration(value:ShiftClock):number {
 if(!value||typeof value.nextDay!=='boolean')throw Error('Bitişin ertesi gün olup olmadığını seçin.');
 const duration=clockMinutes(value.endTime)-clockMinutes(value.startTime)+(value.nextDay?MINUTES_PER_DAY:0);
 if(duration<=0||duration>MINUTES_PER_DAY)throw Error('Vardiya süresi sıfırdan büyük ve en fazla 24 saat olmalı.');
 return duration;
}
function calendarDay(value:unknown):number {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'2000-01-01'||value>'2100-12-31')throw Error('Geçerli bir çalışma tarihi seçin (2000–2100).');
 const day=Date.parse(value+'T00:00:00Z');
 if(!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==value)throw Error('Çalışma tarihi geçersiz.');
 return day/86400000;
}
/** Unknown times reserve the whole calendar day. Adjacent [start,end) windows do not overlap. */
export function shiftBounds(value:ShiftWindow):{start:number;end:number} {
 if(!value||typeof value!=='object')throw Error('Vardiya bilgisi eksik.');
 const day=calendarDay(value.workDate)*MINUTES_PER_DAY;
 if(value.clock===null)return {start:day,end:day+MINUTES_PER_DAY};
 const duration=shiftDuration(value.clock);
 const start=day+clockMinutes(value.clock.startTime);
 return {start,end:start+duration};
}
export function shiftsOverlap(left:ShiftWindow,right:ShiftWindow):boolean {
 const a=shiftBounds(left),b=shiftBounds(right);
 return a.start<b.end&&b.start<a.end;
}

export type ShiftPattern = {weekdays:number[];clock:ShiftClock};
export type ShiftException = {day:string;clock:ShiftClock|null}; // null = explicit day off
export type ShiftPreviewInput = {start:string;end:string;patterns:ShiftPattern[];exceptions:ShiftException[]};
export type PlannedShift = {workDate:string;clock:ShiftClock;source:'weekly'|'exception'};
/** One slot per date. Separate slots remain separate plans; persistence must key by plan + date. */
export function previewShiftDates(input:ShiftPreviewInput):PlannedShift[] {
 if(!input||typeof input!=='object')throw Error('Vardiya planı eksik.');
 const first=calendarDay(input.start),last=calendarDay(input.end);
 if(last<first||last-first>30)throw Error('Önizleme için en fazla 31 günlük aralık seçin.');
 if(!Array.isArray(input.patterns)||input.patterns.length<1||input.patterns.length>7||!Array.isArray(input.exceptions)||input.exceptions.length>31)throw Error('Haftalık plan veya istisnalar geçersiz.');
 const weekly=new Map<number,ShiftClock>();
 for(const pattern of input.patterns){
  if(!pattern||!Array.isArray(pattern.weekdays)||!pattern.weekdays.length||pattern.weekdays.length>7)throw Error('Çalışma günlerini seçin.');
  shiftDuration(pattern.clock);
  for(const weekday of pattern.weekdays){
   if(!Number.isInteger(weekday)||weekday<1||weekday>7||weekly.has(weekday))throw Error('Her hafta günü için yalnız bir saat aralığı seçin.');
   weekly.set(weekday,{...pattern.clock});
  }
 }
 const exceptions=new Map<string,ShiftClock|null>();
 for(const exception of input.exceptions){
  if(!exception||typeof exception!=='object')throw Error('İstisna günü geçersiz.');
  const day=calendarDay(exception.day);
  if(day<first||day>last||exceptions.has(exception.day))throw Error('İstisnalar plan aralığında ve farklı günlerde olmalı.');
  if(exception.clock!==null)shiftDuration(exception.clock);
  exceptions.set(exception.day,exception.clock===null?null:{...exception.clock});
 }
 const result:PlannedShift[]=[];
 for(let day=first;day<=last;day++){
  const date=new Date(day*86400000),workDate=date.toISOString().slice(0,10);
  const changed=exceptions.has(workDate),clock=changed?exceptions.get(workDate):weekly.get(date.getUTCDay()||7);
  if(clock)result.push({workDate,clock:{...clock},source:changed?'exception':'weekly'});
 }
 for(let i=1;i<result.length;i++)if(shiftsOverlap(result[i-1],result[i]))throw Error('Ardışık günlerin vardiya saatleri çakışıyor.');
 return result;
}
