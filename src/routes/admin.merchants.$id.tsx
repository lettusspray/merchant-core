import { createFileRoute } from "@tanstack/react-router";

import { MerchantDetailPage } from "@/components/merchants/merchant-detail-page";

export const Route = createFileRoute("/admin/merchants/$id")({
  component: MerchantDetailRoute,
});

function MerchantDetailRoute() {
  const { id } = Route.useParams();
  return <MerchantDetailPage merchantId={id} />;
}
