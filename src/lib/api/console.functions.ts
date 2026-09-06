import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  dashboardSnapshot,
  discoveryCandidates,
  happeningsList,
  listWorkspaces,
  merchantDetail,
  merchantList,
  ordersList,
  resolveTenant,
  systemActivity,
  visibilityRuns,
  visibilitySnapshots,
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

export const discoveryCandidatesFn = createServerFn({ method: "GET" })
  .validator((input: { q?: string; status?: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const filters: { search?: string; status?: string } = {};
    if (data.q?.trim()) filters.search = data.q.trim();
    if (data.status?.trim()) filters.status = data.status.trim();
    const candidates = await discoveryCandidates(supabase, tenantId, filters);

    return { candidates };
  });

export const happeningsListFn = createServerFn({ method: "GET" })
  .validator((input: { q?: string; status?: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const filters: { search?: string; status?: string } = {};
    if (data.q?.trim()) filters.search = data.q.trim();
    if (data.status?.trim()) filters.status = data.status.trim();
    const happenings = await happeningsList(supabase, tenantId, filters);

    return { happenings };
  });

export const visibilityRunsFn = createServerFn({ method: "GET" })
  .validator((input: { merchantId?: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const merchantId = data.merchantId?.trim() ? data.merchantId.trim() : undefined;
    const runs = await visibilityRuns(supabase, tenantId, merchantId);

    return { runs };
  });

export const visibilitySnapshotsFn = createServerFn({ method: "GET" })
  .validator((input: { runId?: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const runId = data.runId?.trim() ? data.runId.trim() : undefined;
    const opts: { runId?: string; limit?: number } = { limit: 200 };
    if (runId) opts.runId = runId;
    const snapshots = await visibilitySnapshots(supabase, tenantId, opts);

    return { snapshots };
  });

export const ordersListFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const { orders, subscriptions } = await ordersList(supabase, tenantId);

    return { orders, subscriptions };
  });

export const systemActivityFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const { events, workflows } = await systemActivity(supabase, tenantId);

    return { events, workflows };
  });
