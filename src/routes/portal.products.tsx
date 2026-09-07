import { createFileRoute } from "@tanstack/react-router";

import { PortalProductsPage } from "@/components/portal/portal-catalog";

export const Route = createFileRoute("/portal/products")({
  component: PortalProductsPage,
});
