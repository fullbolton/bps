import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { SURFACE_CANVAS } from "@/styles/tokens";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-screen ${SURFACE_CANVAS}`}>
      <Sidebar />
      <Topbar />
      <main className="ml-64 pt-14 min-h-screen">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
