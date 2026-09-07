import { createFileRoute } from "@tanstack/react-router";

import { PublicMerchantPage } from "@/components/public/public-merchant-page";
import { getPublishedPublicPageFn } from "@/lib/api/public-functions";

export const Route = createFileRoute("/p/$merchantSlug")({
  component: PublicRoute,
  loader: async ({ params }) => {
    const slug = params.merchantSlug;
    const page = await getPublishedPublicPageFn({ data: { slug } });
    return { page };
  },
  head: ({ loaderData }) => {
    const revision = loaderData?.page?.revision;
    const website = loaderData?.page?.website;
    // SEO comes from the persisted published revision — never regenerated from
    // live merchant data at request time.
    const title = revision?.seoTitle ?? revision?.title ?? website?.slug ?? null;
    return {
      meta: [
        ...(title ? [{ title }] : []),
        ...(revision?.metaDescription
          ? [{ name: "description", content: revision.metaDescription }]
          : []),
      ],
    };
  },
});

function PublicRoute() {
  const { page } = Route.useLoaderData();
  return <PublicMerchantPage page={page} />;
}
