import { AppShell } from "@/components/app-shell";
import { AgentsPage } from "@/components/pages/agents-page";

export const metadata = { title: "Agent Monitor — Marco.ai" };

export default function Page() {
  return (
    <AppShell title="Agent Monitor" searchPlaceholder="Search agents...">
      <AgentsPage />
    </AppShell>
  );
}
