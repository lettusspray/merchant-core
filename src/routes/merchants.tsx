import { createFileRoute } from "@tanstack/react-router";
import { Store } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SectionPage } from "@/components/section-page";

export const Route = createFileRoute("/merchants")({
  component: Merchants,
});

const DESCRIPTION =
  "Browse, manage, and enrich every merchant record in the canonical graph — identities, locations, products, sources and observations.";

function Merchants() {
  return (
    <AppShell title="Merchants">
      <SectionPage icon={Store} title="Merchants" description={DESCRIPTION} />
    </AppShell>
  );
}
