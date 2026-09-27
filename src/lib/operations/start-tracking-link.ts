import {isWorkDate} from './daily-demand';
import {isUuid} from './pilot-validation';

/** Return context is navigation only, never a company filter on the tracking query. */
export function startBoardHref(day:string,returnCompanyId?:string|null){
  if(!isWorkDate(day))return null;
  const params=new URLSearchParams({gun:day});
  if(isUuid(returnCompanyId))params.set('donusFirma',returnCompanyId);
  return `/talepler/ise-baslama?${params.toString()}`;
}

export function dailyPlanReturnHref(day:string,returnCompanyId?:string|null){
  if(!isWorkDate(day))return '/talepler/gunluk';
  const params=new URLSearchParams({gun:day});
  if(isUuid(returnCompanyId))params.set('firma',returnCompanyId);
  return `/talepler/gunluk?${params.toString()}`;
}

/** Search is server-side across all pages; names are not unique assignment IDs. */
export function startTrackingHref(day:string,workerName:string,returnCompanyId?:string|null){
  const href=startBoardHref(day,returnCompanyId);
  if(!href||!workerName.trim())return null;
  return `${href}&${new URLSearchParams({ara:workerName.trim().slice(0,200)})}`;
}
