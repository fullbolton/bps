import ReportsClient from "./ReportsClient";
export default function ReportsPage(){return <ReportsClient operationsEnabled={process.env.BPS_DAILY_OPERATIONS_ENABLED==='true'}/>;}
