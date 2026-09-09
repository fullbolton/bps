import DashboardClient from "./DashboardClient";
export default function DashboardPage(){return <DashboardClient operationsEnabled={process.env.BPS_DAILY_OPERATIONS_ENABLED==='true'}/>;}
