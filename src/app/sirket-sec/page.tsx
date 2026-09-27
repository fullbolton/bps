import {notFound} from 'next/navigation';
import WorkspacePicker from './WorkspacePicker';
export default function Page(){
 if(process.env.NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED!=='true')notFound();
 return <WorkspacePicker/>;
}
