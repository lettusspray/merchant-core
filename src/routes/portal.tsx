import { createFileRoute, redirect } from "@tanstack/react-router";

import { PortalProvider } from "@/components/portal/portal-context";
import { PortalShell } from "@/components/portal/portal-shell";
import { myPortalDataFn } from "@/lib/api/portal.functions";

export const Route = createFileRoute("/portal")({
  loader: async () => {
    try {
      const data = await myPortalDataFn();
      return { data };
    } catch {
      throw redirect({ to: "/signin" });
    }
  },
  component: PortalLayoutRoute,
});

function PortalLayoutRoute() {
  const { data } = Route.useLoaderData();
  return (
    <PortalProvider data={data}>
      <PortalShell />
    </PortalProvider>
  );
}
