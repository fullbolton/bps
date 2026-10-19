import {notFound} from 'next/navigation';
import AccessSettings from './AccessSettings';
export default function Page(){
 if(process.env.BPS_ACCESS_PREVIEW_ENABLED!=='true')notFound();
 return <AccessSettings/>;
}
