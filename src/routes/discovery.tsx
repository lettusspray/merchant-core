import { createFileRoute } from "@tanstack/react-router";
import { Compass } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SectionPage } from "@/components/section-page";

export const Route = createFileRoute("/discovery")({
  component: Discovery,
});

const DESCRIPTION =
  "Prospect and business discovery workspace — source candidates from registries, licensing data, announcements and provider-neutral connectors.";

function Discovery() {
  return (
    <AppShell title="Discovery">
      <SectionPage icon={Compass} title="Discovery" description={DESCRIPTION} />
    </AppShell>
  );
}
