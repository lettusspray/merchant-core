import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  dashboardSnapshot,
  listWorkspaces,
  merchantDetail,
  merchantList,
  resolveTenant,
} from "./console.server";

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

export const workspaceSummaryFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const [tenantId, workspaces] = await Promise.all([
      resolveTenant(supabase),
      listWorkspaces(supabase),
    ]);
    const workspace = workspaces.find((w) => w.tenantId === tenantId) ?? workspaces[0];

    return {
      signedIn: true,
      tenantId,
      tenantName: workspace?.name ?? "Workspace",
      workspaceRole: workspace?.role ?? "member",
    };
  });

export const merchantsListFn = createServerFn({ method: "GET" })
  .validator((input: { search?: string; status?: string; vertical?: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const filters: { search?: string; status?: string; vertical?: string } = {};
    if (data.search?.trim()) filters.search = data.search.trim();
    if (data.status?.trim()) filters.status = data.status.trim();
    if (data.vertical?.trim()) filters.vertical = data.vertical.trim();
    const merchants = await merchantList(supabase, tenantId, filters);

    return { merchants };
  });

export const merchantDetailFn = createServerFn({ method: "GET" })
  .validator((input: { merchantId: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const detail = await merchantDetail(supabase, tenantId, data.merchantId);

    return { ...detail };
  });
