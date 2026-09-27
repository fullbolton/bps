import {talentScopeAction} from '../actions';
import ImportPreview from './ImportPreview';
export const dynamic='force-dynamic';
export default async function ImportPage(){const scope=await talentScopeAction();if(!scope.ok)return <p role="alert">{scope.message}</p>;return <ImportPreview scope={scope.data}/>;}
