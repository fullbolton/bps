import WorkspaceSetup from './WorkspaceSetup';
export default function SetupPage(){return <WorkspaceSetup operationsEnabled={process.env.BPS_DAILY_OPERATIONS_ENABLED==='true'}/>;}
