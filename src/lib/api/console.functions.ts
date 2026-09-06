import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { providerStatuses, type ProviderConfigStatus } from "@/lib/config.server";
import {
  createMerchant,
  dashboardSnapshot,
  discoveryCandidates,
  happeningsList,
  listWorkspaces,
  merchantDetail,
  merchantList,
  ordersList,
  promoteCandidate,
  recordEvent,
  resolveTenant,
  runMockVisibility,
  systemActivity,
  updateHappeningStatus,
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
  .validator((input: { q?: string; status?: string; kind?: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const filters: { search?: string; status?: string; kind?: string } = {};
    if (data.q?.trim()) filters.search = data.q.trim();
    if (data.status?.trim()) filters.status = data.status.trim();
    if (data.kind?.trim()) filters.kind = data.kind.trim();
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
  .validator((input: { status?: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const filter: { status?: string } = {};
    if (data.status?.trim()) filter.status = data.status.trim();
    const { orders, subscriptions } = await ordersList(supabase, tenantId, filter);

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

export const providerStatusesFn = createServerFn({ method: "GET" }).handler(() => {
  return { statuses: providerStatuses() };
});

export const updateHappeningStatusFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      happeningId: string;
      status: "draft" | "in_review" | "approved" | "published" | "rejected";
      notes?: string;
    }) => input,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    await updateHappeningStatus(
      supabase,
      tenantId,
      context.userId,
      data.happeningId,
      data.status,
      data.notes,
    );
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "happening.status_changed",
      subjectType: "happening",
      subjectId: data.happeningId,
      payload: { status: data.status },
    });
  });

export const promoteCandidateFn = createServerFn({ method: "POST" })
  .validator((input: { candidateId: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const merchant = await promoteCandidate(supabase, tenantId, context.userId, data.candidateId);
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "candidate.promoted",
      subjectType: "candidate",
      subjectId: data.candidateId,
      payload: { merchantId: merchant.id },
    });
    return { merchant };
  });

export const createMerchantFn = createServerFn({ method: "POST" })
  .validator((input: { name: string; vertical?: string; city?: string; region?: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const merchant = await createMerchant(supabase, tenantId, data);
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "merchant.created",
      subjectType: "merchant",
      subjectId: merchant.id,
      payload: { name: data.name, vertical: data.vertical },
    });
    return { merchant };
  });

export const runMockVisibilityFn = createServerFn({ method: "POST" })
  .validator((input: { merchantId: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const result = await runMockVisibility(supabase, tenantId, context.userId, data.merchantId);
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "visibility.run_local",
      subjectType: "visibility_run",
      subjectId: result.runId,
      payload: { mode: result.mode, merchantId: data.merchantId },
    });
    return { result };
  });
