import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { SettingsPage } from "@/components/settings/settings-page";

export const Route = createFileRoute("/admin/settings")({
  component: Settings,
});

function Settings() {
  return (
    <AppShell title="Settings">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Operator view of integration readiness and provider configuration.
          </p>
        </div>
        <SettingsPage />
      </div>
    </AppShell>
  );
}
