import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileOperationsNav from "./MobileOperationsNav";
import { SURFACE_CANVAS } from "@/styles/tokens";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-screen ${SURFACE_CANVAS}`}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-white focus:p-3">İçeriğe geç</a>
      <div className="print:hidden">
        <Sidebar />
        <Topbar />
        <MobileOperationsNav dailyEnabled={process.env.BPS_DAILY_OPERATIONS_ENABLED === 'true'} />
      </div>
      <main id="main-content" tabIndex={-1} className="md:ml-64 pt-16 min-h-screen print:ml-0 print:pt-0">
        <div className="mx-auto max-w-[1600px] p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 md:pb-6 lg:p-8 print:p-0">{children}</div>
      </main>
    </div>
  );
}
