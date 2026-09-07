import { createFileRoute } from "@tanstack/react-router";

import { PortalServicesPage } from "@/components/portal/portal-catalog";

export const Route = createFileRoute("/portal/services")({
  component: PortalServicesPage,
});
