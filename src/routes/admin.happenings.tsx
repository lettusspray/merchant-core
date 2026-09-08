import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { HappeningsPage } from "@/components/happenings/happenings-page";

export const Route = createFileRoute("/admin/happenings")({
  component: Happenings,
});

function Happenings() {
  return (
    <AppShell title="Happenings">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Happenings</h2>
          <p className="text-sm text-muted-foreground">
            Events, promotions, and announcements ingested for your merchants — review candidates
            and their evidence.
          </p>
        </div>
        <HappeningsPage />
      </div>
    </AppShell>
  );
}
