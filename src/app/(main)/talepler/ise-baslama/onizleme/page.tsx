import Preview from './Preview';
export default function StartTrackingPreviewPage(){if(process.env.BPS_DAILY_OPERATIONS_ENABLED!=='true')return <p>Bu önizleme henüz kullanıma açılmadı.</p>;return <Preview/>;}
