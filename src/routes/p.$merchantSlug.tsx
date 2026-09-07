import { createFileRoute, notFound } from "@tanstack/react-router";

import { PublicMerchantPage } from "@/components/public/public-merchant-page";
import { getPublishedPublicPageFn } from "@/lib/api/public-functions";

export const Route = createFileRoute("/p/$merchantSlug")({
  component: PublicRoute,
  loader: async ({ params }) => {
    const slug = params.merchantSlug;
    const page = await getPublishedPublicPageFn({ data: { slug } });
    if (!page) throw notFound();
    return { page };
  },
  head: ({ loaderData }) => {
    const title = loaderData?.page?.website?.seoTitle ?? loaderData?.page?.merchant?.name;
    return {
      meta: [
        ...(title ? [{ title }] : []),
        ...(loaderData?.page?.page?.metaDescription
          ? [{ name: "description", content: loaderData.page.page.metaDescription }]
          : []),
      ],
    };
  },
});

function PublicRoute() {
  const { page } = Route.useLoaderData();
  return <PublicMerchantPage page={page} />;
}
