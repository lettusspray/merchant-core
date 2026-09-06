import { createFileRoute } from "@tanstack/react-router";
import { Eye } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SectionPage } from "@/components/section-page";

export const Route = createFileRoute("/visibility")({
  component: Visibility,
});

const DESCRIPTION =
  "AI visibility results — dispatch runs against MercerCroft, track queries and per-engine citation and rank outcomes.";

function Visibility() {
  return (
    <AppShell title="AI Visibility">
      <SectionPage icon={Eye} title="AI Visibility" description={DESCRIPTION} />
    </AppShell>
  );
}
