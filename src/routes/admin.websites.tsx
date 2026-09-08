import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { WebsitesPage } from "@/components/websites/websites-page";

export const Route = createFileRoute("/admin/websites")({
  component: Websites,
});

function Websites() {
  return (
    <AppShell title="Websites">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Websites</h2>
          <p className="text-sm text-muted-foreground">
            Public pages generated from the merchant graph. Generate a draft, publish it, and
            regenerate any time the graph changes.
          </p>
        </div>
        <WebsitesPage />
      </div>
    </AppShell>
  );
}
