import { AppShell } from "@/components/app-shell";
import { AdminPage } from "@/components/pages/admin-page";

export const metadata = { title: "User Management — Marco.ai" };

export default function Page() {
  return (
    <AppShell title="User Management" searchPlaceholder="Search users...">
      <AdminPage />
    </AppShell>
  );
}
