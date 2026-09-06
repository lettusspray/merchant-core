import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SectionPage } from "@/components/section-page";

export const Route = createFileRoute("/commerce")({
  component: Commerce,
});

const DESCRIPTION =
  "Commerce operations — orders, order items, subscriptions, payments, payouts and platform commissions.";

function Commerce() {
  return (
    <AppShell title="Commerce">
      <SectionPage icon={ShoppingCart} title="Commerce" description={DESCRIPTION} />
    </AppShell>
  );
}
