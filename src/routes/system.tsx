import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SectionPage } from "@/components/section-page";

export const Route = createFileRoute("/system")({
  component: System,
});

const DESCRIPTION =
  "System health and activity — provider status, background workflows, and the audit trail for privileged changes.";

function System() {
  return (
    <AppShell title="System">
      <SectionPage icon={Activity} title="System" description={DESCRIPTION} />
    </AppShell>
  );
}
