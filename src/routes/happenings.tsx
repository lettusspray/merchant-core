import { createFileRoute } from "@tanstack/react-router";
import { Webhook } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SectionPage } from "@/components/section-page";

export const Route = createFileRoute("/happenings")({
  component: Happenings,
});

const DESCRIPTION =
  "Content and updates engine — ingest current happenings, review candidate content, approve and queue publications.";

function Happenings() {
  return (
    <AppShell title="Happenings">
      <SectionPage icon={Webhook} title="Happenings" description={DESCRIPTION} />
    </AppShell>
  );
}
