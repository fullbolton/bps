import { Layout } from "@/components/shell";
import { RoleProvider } from "@/context/RoleContext";
import { NavigationGuardProvider } from "@/context/NavigationGuardContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <WorkspaceProvider><NavigationGuardProvider><Layout>{children}</Layout></NavigationGuardProvider></WorkspaceProvider>
    </RoleProvider>
  );
}
