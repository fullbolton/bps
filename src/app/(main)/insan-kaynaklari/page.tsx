import {notFound} from 'next/navigation';
import HrDirectory from './HrDirectory';
export default function Page(){
 if(process.env.BPS_HR_PREVIEW_ENABLED!=='true')notFound();
 return <HrDirectory/>;
}
