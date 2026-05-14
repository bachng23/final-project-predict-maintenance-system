import { AppShell } from "@/components/app-shell";
import { AgentsPage } from "@/components/pages/agents-page";

export const metadata = { title: "Monitor — Marco.ai" };

export default function Page() {
  return (
    <AppShell title="Monitor" searchPlaceholder="Search bearings...">
      <AgentsPage />
    </AppShell>
  );
}
