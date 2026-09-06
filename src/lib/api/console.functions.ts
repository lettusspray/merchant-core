import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dashboardSnapshot, listWorkspaces, resolveTenant } from "./console.server";

export const consoleOverviewFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const [snapshot, workspaces] = await Promise.all([
      dashboardSnapshot(supabase, tenantId),
      listWorkspaces(supabase),
    ]);
    const workspace = workspaces.find((w) => w.tenantId === tenantId) ?? workspaces[0];

    return {
      signedIn: true,
      tenantId,
      tenantName: workspace?.name ?? "Workspace",
      workspaceRole: workspace?.role ?? "member",
      snapshot,
    };
  });
