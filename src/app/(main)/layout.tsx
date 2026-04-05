import { Layout } from "@/components/shell";
import { RoleProvider } from "@/context/RoleContext";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <Layout>{children}</Layout>
    </RoleProvider>
  );
}
