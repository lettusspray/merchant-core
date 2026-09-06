import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SectionPage } from "@/components/section-page";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const DESCRIPTION =
  "Workspace settings — memberships, roles, integrations, source connectors and provider configuration.";

function SettingsPage() {
  return (
    <AppShell title="Settings">
      <SectionPage icon={Settings} title="Settings" description={DESCRIPTION} />
    </AppShell>
  );
}
