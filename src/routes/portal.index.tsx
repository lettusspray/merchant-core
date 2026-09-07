import { createFileRoute } from "@tanstack/react-router";

import { PortalHomePage } from "@/components/portal/portal-home";

export const Route = createFileRoute("/portal/")({
  component: PortalHomePage,
});
