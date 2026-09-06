import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { CommercePage } from "@/components/commerce/commerce-page";

export const Route = createFileRoute("/commerce")({
  component: Commerce,
});

function Commerce() {
  return (
    <AppShell title="Commerce">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Commerce</h2>
          <p className="text-sm text-muted-foreground">
            Orders and subscriptions for your merchants — a local read-only view.
          </p>
        </div>
        <CommercePage />
      </div>
    </AppShell>
  );
}
