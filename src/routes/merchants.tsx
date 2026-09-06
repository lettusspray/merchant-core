import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { MerchantsPage } from "@/components/merchants/merchants-page";

export const Route = createFileRoute("/merchants")({
  component: Merchants,
});

function Merchants() {
  return (
    <AppShell title="Merchants">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Merchants</h2>
          <p className="text-sm text-muted-foreground">
            Every record in the canonical graph — identities, locations, and enrichment.
          </p>
        </div>
        <MerchantsPage />
      </div>
    </AppShell>
  );
}
