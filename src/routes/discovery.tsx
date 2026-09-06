import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { DiscoveryPage } from "@/components/discovery/discovery-page";

export const Route = createFileRoute("/discovery")({
  component: Discovery,
});

function Discovery() {
  return (
    <AppShell title="Discovery">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Discovery</h2>
          <p className="text-sm text-muted-foreground">
            Prospect and business discovery candidates from registry, licensing, and presence
            connectors — inspect the signals before claiming them as merchants.
          </p>
        </div>
        <DiscoveryPage />
      </div>
    </AppShell>
  );
}
