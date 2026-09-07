import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { providerStatuses, type ProviderConfigStatus } from "@/lib/config.server";
import {
  createMerchant,
  dashboardSnapshot,
  discoveryCandidates,
  ensureWebsiteForMerchant,
  generateHomePageFromGraph,
  getWebsiteWithPages,
  happeningsList,
  listWebsites,
  listWorkspaces,
  MERCHANT_STATUSES,
  MERCHANT_VERTICALS,
  merchantDetail,
  merchantList,
  ordersList,
  promoteCandidate,
  PUBLISH_STATES,
  publishPage,
  recordEvent,
  resolveTenant,
  runDiscovery,
  runMockVisibility,
  systemActivity,
  tenantCategories,
  unpublishPage,
  updateHappeningStatus,
  updateMerchantIdentity,
  upsertCatalogItem,
  upsertLocation,
  visibilityRuns,
  visibilitySnapshots,
} from "./console.server";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);

const merchantIdentitySchema = z.object({
  merchantId: z.string().uuid(),
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(160),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters.")
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens."),
  vertical: z.enum(MERCHANT_VERTICALS),
  status: z.enum(MERCHANT_STATUSES),
  tagline: optionalText(200),
  description: optionalText(4000),
  brand_color: z
    .string()
    .trim()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a hex color such as #1F6FEB.")
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  logo_url: z
    .string()
    .trim()
    .url("Logo must be a valid URL.")
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
  primary_category_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
});

export type MerchantIdentityFormInput = z.input<typeof merchantIdentitySchema>;

const locationSchema = z.object({
  merchantId: z.string().uuid(),
  locationId: z.string().uuid().nullable().optional(),
  label: z.string().trim().min(2, "Label must be at least 2 characters.").max(200),
  address_line1: optionalText(200),
  address_line2: optionalText(200),
  city: optionalText(120),
  region: optionalText(120),
  postal_code: optionalText(20),
  country: optionalText(80),
  phone: optionalText(40),
  is_primary: z.boolean(),
});

const runDiscoverySchema = z.object({
  query: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  vertical: z.string().trim().max(40).optional(),
});

const catalogItemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("product"),
    merchantId: z.string().uuid(),
    itemId: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(2, "Name must be at least 2 characters.").max(160),
    description: optionalText(2000),
    sku: optionalText(80),
    currency: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z]{3}$/, "Currency must be a 3-letter code such as usd.")
      .default("usd"),
    price_cents: z
      .number()
      .int("Price must be a whole number of cents.")
      .min(0)
      .max(999999999)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    state: z.enum(PUBLISH_STATES),
  }),
  z.object({
    kind: z.literal("service"),
    merchantId: z.string().uuid(),
    itemId: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(2, "Name must be at least 2 characters.").max(160),
    description: optionalText(2000),
    price_cents: z
      .number()
      .int("Price must be a whole number of cents.")
      .min(0)
      .max(999999999)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    duration_minutes: z
      .number()
      .int()
      .min(0)
      .max(100000)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    state: z.enum(PUBLISH_STATES),
  }),
]);

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
    const [detail, categoryOptions] = await Promise.all([
      merchantDetail(supabase, tenantId, data.merchantId),
      tenantCategories(supabase, tenantId),
    ]);

    return { ...detail, categoryOptions };
  });

export const updateMerchantIdentityFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => merchantIdentitySchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const { merchantId, ...fields } = data;
    const merchant = await updateMerchantIdentity(supabase, tenantId, merchantId, fields);
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "merchant.updated",
      subjectType: "merchant",
      subjectId: merchantId,
      payload: { fields },
    });
    return { merchant };
  });

export const upsertLocationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => locationSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const { merchantId, locationId, ...fields } = data;
    const result = await upsertLocation(supabase, tenantId, merchantId, locationId ?? null, fields);
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: result.created ? "merchant.location_created" : "merchant.location_updated",
      subjectType: "merchant",
      subjectId: merchantId,
      payload: { locationId: result.location.id, fields },
    });
    return { location: result.location, created: result.created };
  });

export const upsertCatalogItemFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => catalogItemSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const { merchantId, itemId, ...fields } = data;
    const result = await upsertCatalogItem(supabase, tenantId, merchantId, itemId ?? null, fields);
    const entity = fields.kind;
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: result.created ? `merchant.${entity}_created` : `merchant.${entity}_updated`,
      subjectType: "merchant",
      subjectId: merchantId,
      payload: { itemId: result.item.id, fields },
    });
    return { item: result.item, created: result.created };
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

export const runDiscoveryFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => runDiscoverySchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const result = await runDiscovery(supabase, tenantId, context.userId, {
      ...(data.query ? { query: data.query } : {}),
      ...(data.city ? { city: data.city } : {}),
      ...(data.vertical ? { vertical: data.vertical } : {}),
    });
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: result.status === "failed" ? "discovery.run_failed" : "discovery.run_completed",
      subjectType: "discovery_job",
      subjectId: result.jobId,
      payload: {
        provider: result.provider,
        query: result.query,
        vertical: result.vertical ?? undefined,
        city: result.city ?? undefined,
        found: result.foundCount,
        created: result.createdCount,
        updated: result.updatedCount,
        error: result.error ?? undefined,
      },
    });
    if (result.status === "failed") {
      throw new Error(result.error ?? "Discovery run failed.");
    }
    return { result };
  });

// =============== WEBSITE FACTORY ===============

export const websitesListFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const websites = await listWebsites(supabase, tenantId);
    return { websites };
  });

export const websiteDetailFn = createServerFn({ method: "GET" })
  .validator((input: { websiteId: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const website = await getWebsiteWithPages(supabase, tenantId, data.websiteId);
    if (!website) throw new Error("Website not found");
    return { website };
  });

const websiteSchema = z.object({ websiteId: z.string().uuid() });
const merchantIdSchema = z.object({ merchantId: z.string().uuid() });

export const ensureWebsiteForMerchantFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => merchantIdSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const websiteId = await ensureWebsiteForMerchant(supabase, tenantId, data.merchantId);
    const website = await getWebsiteWithPages(supabase, tenantId, websiteId);
    return { website };
  });

export const generateHomePageFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => websiteSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const result = await generateHomePageFromGraph(
      supabase,
      tenantId,
      data.websiteId,
      context.userId,
    );
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "website.generated",
      subjectType: "website_page",
      subjectId: result.page.id,
      payload: {
        websiteId: result.websiteId,
        merchantId: result.merchantId,
        path: "/",
        version: result.version,
        sections: result.sectionCount,
        state: "draft",
      },
    });
    return { result };
  });

export const publishPageFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => websiteSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const result = await publishPage(supabase, tenantId, data.websiteId);
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "website.published",
      subjectType: "website",
      subjectId: data.websiteId,
      payload: { merchantId: result.merchantId, publishedVersion: result.publishedVersion },
    });
    return { result };
  });

export const unpublishPageFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => websiteSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const result = await unpublishPage(supabase, tenantId, data.websiteId);
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "website.unpublished",
      subjectType: "website",
      subjectId: data.websiteId,
      payload: {},
    });
    return { result };
  });

export const linkMerchantOwnerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ merchantId: z.string().uuid(), email: z.string().email() }).parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const tenantId = await resolveTenant(supabase);
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", data.merchantId)
      .maybeSingle();
    if (merchantError) throw merchantError;
    if (!merchant) throw new Error("Merchant not found");

    const email = data.email.trim().toLowerCase();
    const { error } = await supabase.from("merchant_owners").insert({
      tenant_id: tenantId,
      merchant_id: data.merchantId,
      email,
      role: "owner",
    });
    if (error) throw error;
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "merchant.portal.invited",
      subjectType: "merchant",
      subjectId: data.merchantId,
      payload: { email },
    });
    return { ok: true };
  });
