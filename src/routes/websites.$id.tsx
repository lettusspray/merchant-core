import { createFileRoute } from "@tanstack/react-router";

import { WebsiteDetailPage } from "@/components/websites/website-detail-page";

export const Route = createFileRoute("/websites/$id")({
  component: WebsiteDetailRoute,
});

function WebsiteDetailRoute() {
  const { id } = Route.useParams();
  return <WebsiteDetailPage websiteId={id} />;
}
