import { createFileRoute } from "@tanstack/react-router";

import { PortalOffersPage } from "@/components/portal/portal-offers";

export const Route = createFileRoute("/portal/offers")({
  component: PortalOffersPage,
});
