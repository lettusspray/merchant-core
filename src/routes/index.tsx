import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { DashboardPage } from "@/components/dashboard/dashboard-page";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <AppShell title="Dashboard">
      <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
      <DashboardPage />
    </AppShell>
  );
}
