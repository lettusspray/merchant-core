import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { VisibilityPage } from "@/components/visibility/visibility-page";

export const Route = createFileRoute("/visibility")({
  component: Visibility,
});

function Visibility() {
  return (
    <AppShell title="AI Visibility">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Visibility</h2>
          <p className="text-sm text-muted-foreground">
            Visibility runs and scores against AI engines — status, mode, and persisted results for
            each merchant.
          </p>
        </div>
        <VisibilityPage />
      </div>
    </AppShell>
  );
}
