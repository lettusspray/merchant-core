import { createFileRoute } from "@tanstack/react-router";

import { PortalLocationsPage } from "@/components/portal/portal-locations";

export const Route = createFileRoute("/portal/locations")({
  component: PortalLocationsPage,
});
