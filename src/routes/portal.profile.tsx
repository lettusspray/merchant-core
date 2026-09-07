import { createFileRoute } from "@tanstack/react-router";

import { PortalProfilePage } from "@/components/portal/portal-profile";

export const Route = createFileRoute("/portal/profile")({
  component: PortalProfilePage,
});
