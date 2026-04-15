import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { SURFACE_CANVAS } from "@/styles/tokens";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-screen ${SURFACE_CANVAS}`}>
      <div className="print:hidden">
        <Sidebar />
        <Topbar />
      </div>
      <main className="ml-64 pt-14 min-h-screen print:ml-0 print:pt-0">
        <div className="p-6 print:p-0">{children}</div>
      </main>
    </div>
  );
}
