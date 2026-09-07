import { createFileRoute } from "@tanstack/react-router";

import { PortalHappeningsPage } from "@/components/portal/portal-happenings";

export const Route = createFileRoute("/portal/happenings")({
  component: PortalHappeningsPage,
});
