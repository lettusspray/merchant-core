import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { SystemPage } from "@/components/system/system-page";

export const Route = createFileRoute("/admin/system")({
  component: System,
});

function System() {
  return (
    <AppShell title="System">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System</h2>
          <p className="text-sm text-muted-foreground">
            Provider health, the audit trail of business events, and background workflow runs.
          </p>
        </div>
        <SystemPage />
      </div>
    </AppShell>
  );
}
