/**
 * Read/write helpers for the operator console. All queries run through the
 * caller's authenticated Supabase client, so tenant isolation is enforced by
 * RLS in the database, not by application filtering alone.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { mockVisibilityAdapter, type VisibilityEngine } from "@/lib/adapters/visibility.server";

export type Db = SupabaseClient<Database>;

export async function resolveTenant(supabase: Db, requested?: string | null): Promise<string> {
  const { data, error } = await supabase
    .from("memberships")
    .select("tenant_id, role, tenants(name, slug)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) throw new Error("No workspace membership found for this account.");
  const match = requested ? rows.find((row) => row.tenant_id === requested) : undefined;
  return (match ?? rows[0]!).tenant_id;
}

export async function listWorkspaces(supabase: Db) {
  const { data, error } = await supabase
    .from("memberships")
    .select("tenant_id, role, tenants(name, slug)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    tenantId: row.tenant_id,
    role: row.role,
    name: row.tenants?.name ?? "Workspace",
    slug: row.tenants?.slug ?? "",
  }));
}

/** Append-only business event. Every meaningful mutation is attributable. */
export async function recordEvent(
  supabase: Db,
  input: {
    tenantId: string;
    actorId: string;
    kind: string;
    subjectType?: string;
    subjectId?: string;
    payload?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("events").insert({
    tenant_id: input.tenantId,
    actor_id: input.actorId,
    kind: input.kind,
    subject_type: input.subjectType ?? null,
    subject_id: input.subjectId ?? null,
    payload: (input.payload ?? {}) as never,
  });
  if (error) throw error;
}

export async function dashboardSnapshot(supabase: Db, tenantId: string) {
  const scoped = (table: "merchants" | "discovery_candidates") =>
    supabase.from(table).select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);

  const [merchants, active, prospects, pendingContent, pendingObs, orders, subs] =
    await Promise.all([
      scoped("merchants"),
      supabase
        .from("merchants")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "active"),
      scoped("discovery_candidates"),
      supabase
        .from("happenings")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["draft", "in_review"]),
      supabase
        .from("observations")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "pending"),
      supabase.from("orders").select("total_cents, status").eq("tenant_id", tenantId),
      supabase
        .from("subscriptions")
        .select("price_cents, status, interval")
        .eq("tenant_id", tenantId),
    ]);

  const paidOrders = (orders.data ?? []).filter(
    (o) => o.status !== "cancelled" && o.status !== "refunded",
  );
  const gmvCents = paidOrders.reduce((sum, o) => sum + o.total_cents, 0);
  const mrrCents = (subs.data ?? [])
    .filter((s) => s.status === "active" || s.status === "trialing")
    .reduce(
      (sum, s) => sum + (s.interval === "year" ? Math.round(s.price_cents / 12) : s.price_cents),
      0,
    );

  const [visibility, recentEvents, workflows] = await Promise.all([
    supabase
      .from("visibility_snapshots")
      .select("score, engine, captured_at, mentioned, merchants(name)")
      .eq("tenant_id", tenantId)
      .order("captured_at", { ascending: false })
      .limit(12),
    supabase
      .from("events")
      .select("id, kind, subject_type, actor_label, created_at, payload")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("workflow_runs")
      .select("id, workflow, status, engine, started_at, finished_at, error")
      .eq("tenant_id", tenantId)
      .order("started_at", { ascending: false })
      .limit(8),
  ]);

  const scores = (visibility.data ?? []).map((row) => Number(row.score));
  return {
    counts: {
      merchants: merchants.count ?? 0,
      activeMerchants: active.count ?? 0,
      prospects: prospects.count ?? 0,
      pendingContent: pendingContent.count ?? 0,
      pendingObservations: pendingObs.count ?? 0,
      orders: paidOrders.length,
    },
    gmvCents,
    mrrCents,
    avgVisibility: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    visibility: visibility.data ?? [],
    events: recentEvents.data ?? [],
    workflows: workflows.data ?? [],
  };
}

export async function merchantList(
  supabase: Db,
  tenantId: string,
  filters: { search?: string; vertical?: string; status?: string },
) {
  let query = supabase
    .from("merchants")
    .select(
      "id, name, slug, vertical, status, tagline, data_quality, updated_at, locations(city, region, is_primary)",
    )
    .eq("tenant_id", tenantId)
    .order("name");
  if (filters.search) query = query.ilike("name", `%${filters.search}%`);
  if (filters.vertical) query = query.eq("vertical", filters.vertical as never);
  if (filters.status) query = query.eq("status", filters.status as never);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function discoveryCandidates(
  supabase: Db,
  tenantId: string,
  filters: { search?: string; status?: string },
) {
  let query = supabase
    .from("discovery_candidates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("score", { ascending: false })
    .order("updated_at", { ascending: false });
  if (filters.search) query = query.ilike("name", `%${filters.search}%`);
  if (filters.status) query = query.eq("status", filters.status as never);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function happeningsList(
  supabase: Db,
  tenantId: string,
  filters: { search?: string; status?: string; kind?: string },
) {
  let query = supabase
    .from("happenings")
    .select("*, merchants(name, slug)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (filters.search) query = query.ilike("title", `%${filters.search}%`);
  if (filters.status) query = query.eq("status", filters.status as never);
  if (filters.kind) query = query.eq("kind", filters.kind as never);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function updateHappeningStatus(
  supabase: Db,
  tenantId: string,
  actorId: string,
  happeningId: string,
  status: "draft" | "in_review" | "approved" | "published" | "rejected",
  notes?: string,
) {
  const { error } = await supabase
    .from("happenings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", happeningId)
    .select("id")
    .single();
  if (error) throw error;

  const { error: reviewError } = await supabase.from("happening_reviews").insert({
    tenant_id: tenantId,
    happening_id: happeningId,
    reviewer_id: actorId,
    action: status,
    notes: notes ?? null,
  });
  if (reviewError) throw reviewError;
}

export async function visibilityRuns(supabase: Db, tenantId: string, merchantId?: string) {
  let query = supabase
    .from("visibility_runs")
    .select("*, merchants(name)")
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false });
  if (merchantId) query = query.eq("merchant_id", merchantId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function visibilitySnapshots(
  supabase: Db,
  tenantId: string,
  opts: { runId?: string; limit?: number },
) {
  let query = supabase
    .from("visibility_snapshots")
    .select("*, merchants(name)")
    .eq("tenant_id", tenantId)
    .order("captured_at", { ascending: false });
  if (opts.runId) query = query.eq("run_id", opts.runId);
  if (opts.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function ordersList(
  supabase: Db,
  tenantId: string,
  filter?: { status?: string },
  limit = 100,
) {
  let ordersQuery = supabase
    .from("orders")
    .select("*, merchants(name), order_items(*)")
    .eq("tenant_id", tenantId)
    .order("placed_at", { ascending: false })
    .limit(limit);
  if (filter?.status) ordersQuery = ordersQuery.eq("status", filter.status as never);

  const subscriptionsQuery = supabase
    .from("subscriptions")
    .select("*, merchants(name)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const [orders, subscriptions] = await Promise.all([ordersQuery, subscriptionsQuery]);
  if (orders.error) throw orders.error;
  if (subscriptions.error) throw subscriptions.error;
  return { orders: orders.data ?? [], subscriptions: subscriptions.data ?? [] };
}

export async function systemActivity(supabase: Db, tenantId: string, limit = 50) {
  const [events, workflows] = await Promise.all([
    supabase
      .from("events")
      .select("id, kind, actor_label, subject_type, subject_id, created_at, payload")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("workflow_runs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("started_at", { ascending: false })
      .limit(limit),
  ]);
  if (events.error) throw events.error;
  if (workflows.error) throw workflows.error;
  return { events: events.data ?? [], workflows: workflows.data ?? [] };
}

export async function merchantDetail(supabase: Db, tenantId: string, merchantId: string) {
  const eq = { tenant_id: tenantId, merchant_id: merchantId };
  const [
    merchant,
    locations,
    hours,
    contacts,
    products,
    services,
    offers,
    observations,
    happenings,
    owners,
    websites,
    visibility,
    orders,
    subscription,
    events,
  ] = await Promise.all([
    supabase
      .from("merchants")
      .select("*, categories(name, slug)")
      .eq("tenant_id", tenantId)
      .eq("id", merchantId)
      .maybeSingle(),
    supabase.from("locations").select("*").match(eq).order("is_primary", { ascending: false }),
    supabase.from("business_hours").select("*").match(eq).order("day_of_week"),
    supabase.from("contacts").select("*").match(eq),
    supabase.from("products").select("*").match(eq).order("name"),
    supabase.from("services").select("*").match(eq).order("name"),
    supabase.from("offers").select("*").match(eq),
    supabase
      .from("observations")
      .select("*, source_records(external_id, fetched_at, source_connectors(provider, name))")
      .match(eq)
      .order("observed_at", { ascending: false }),
    supabase.from("happenings").select("*").match(eq).order("created_at", { ascending: false }),
    supabase.from("merchant_owners").select("*").match(eq),
    supabase
      .from("websites")
      .select("*, website_pages(id, path, title, state, meta_description, updated_at)")
      .match(eq),
    supabase
      .from("visibility_snapshots")
      .select("*, visibility_queries(prompt, intent)")
      .match(eq)
      .order("captured_at", { ascending: false }),
    supabase
      .from("orders")
      .select("*, order_items(*)")
      .match(eq)
      .order("placed_at", { ascending: false }),
    supabase.from("subscriptions").select("*").match(eq).maybeSingle(),
    supabase
      .from("events")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("subject_id", merchantId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (merchant.error) throw merchant.error;
  if (!merchant.data) throw new Error("Merchant not found");

  return {
    merchant: merchant.data,
    locations: locations.data ?? [],
    hours: hours.data ?? [],
    contacts: contacts.data ?? [],
    products: products.data ?? [],
    services: services.data ?? [],
    offers: offers.data ?? [],
    observations: observations.data ?? [],
    happenings: happenings.data ?? [],
    owners: owners.data ?? [],
    websites: websites.data ?? [],
    visibility: visibility.data ?? [],
    orders: orders.data ?? [],
    subscription: subscription.data ?? null,
    events: events.data ?? [],
  };
}

export const MERCHANT_VERTICALS = [
  "restaurant",
  "home_service",
  "beauty",
  "pet_service",
  "automotive",
  "local_retail",
  "other",
] as const;

export const MERCHANT_STATUSES = [
  "prospect",
  "onboarding",
  "active",
  "paused",
  "archived",
] as const;

export type MerchantIdentityInput = {
  name: string;
  slug: string;
  vertical: (typeof MERCHANT_VERTICALS)[number];
  status: (typeof MERCHANT_STATUSES)[number];
  tagline: string | null;
  description: string | null;
  brand_color: string | null;
  logo_url: string | null;
  primary_category_id: string | null;
};

export async function tenantCategories(supabase: Db, tenantId: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, vertical")
    .eq("tenant_id", tenantId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

/** Updates the merchant's canonical identity fields. Tenant scope is enforced
 *  server-side and again by RLS; the client never supplies a tenant id. */
export async function updateMerchantIdentity(
  supabase: Db,
  tenantId: string,
  merchantId: string,
  input: MerchantIdentityInput,
) {
  const { data, error } = await supabase
    .from("merchants")
    .update({
      name: input.name,
      slug: input.slug,
      vertical: input.vertical,
      status: input.status,
      tagline: input.tagline,
      description: input.description,
      brand_color: input.brand_color,
      logo_url: input.logo_url,
      primary_category_id: input.primary_category_id,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", merchantId)
    .select(
      "id, name, slug, vertical, status, tagline, description, brand_color, logo_url, primary_category_id, updated_at",
    )
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Merchant not found");
  return data;
}

export type LocationInput = {
  label: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  is_primary: boolean;
};

/** Creates or updates a merchant location. Tenant scope is enforced server-side
 *  and again by RLS; the client never supplies a tenant id. When a location is
 *  marked primary, all other locations for the merchant are un-marked first so
 *  there is always exactly one primary. */
export async function upsertLocation(
  supabase: Db,
  tenantId: string,
  merchantId: string,
  locationId: string | null,
  input: LocationInput,
) {
  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("id", merchantId)
    .maybeSingle();
  if (merchantError) throw merchantError;
  if (!merchant) throw new Error("Merchant not found");

  const payload = {
    label: input.label,
    address_line1: input.address_line1,
    address_line2: input.address_line2,
    city: input.city,
    region: input.region,
    postal_code: input.postal_code,
    country: input.country,
    phone: input.phone,
    is_primary: input.is_primary,
    updated_at: new Date().toISOString(),
  };

  if (input.is_primary) {
    const { error: clearError } = await supabase
      .from("locations")
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("merchant_id", merchantId);
    if (clearError) throw clearError;
  }

  if (locationId) {
    const { data, error } = await supabase
      .from("locations")
      .update(payload)
      .eq("tenant_id", tenantId)
      .eq("merchant_id", merchantId)
      .eq("id", locationId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Location not found");
    return { location: data, created: false };
  }

  const { data, error } = await supabase
    .from("locations")
    .insert({ tenant_id: tenantId, merchant_id: merchantId, ...payload })
    .select("*")
    .single();
  if (error) throw error;
  return { location: data, created: true };
}

export const PUBLISH_STATES = ["draft", "published", "archived"] as const;
export type PublishState = (typeof PUBLISH_STATES)[number];

export type CatalogItemInput =
  | {
      kind: "product";
      name: string;
      description: string | null;
      price_cents: number | null;
      state: PublishState;
      sku: string | null;
      currency: string;
    }
  | {
      kind: "service";
      name: string;
      description: string | null;
      price_cents: number | null;
      state: PublishState;
      duration_minutes: number | null;
    };

/** Creates or updates a product or service in the merchant's catalog. Tenant
 *  scope is enforced server-side and again by RLS; the client never supplies a
 *  tenant id. */
export async function upsertCatalogItem(
  supabase: Db,
  tenantId: string,
  merchantId: string,
  itemId: string | null,
  input: CatalogItemInput,
) {
  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("id", merchantId)
    .maybeSingle();
  if (merchantError) throw merchantError;
  if (!merchant) throw new Error("Merchant not found");

  const updatedAt = new Date().toISOString();

  if (input.kind === "product") {
    const payload = {
      name: input.name,
      description: input.description,
      price_cents: input.price_cents,
      sku: input.sku,
      currency: input.currency,
      state: input.state,
      updated_at: updatedAt,
    };
    if (itemId) {
      const { data, error } = await supabase
        .from("products")
        .update(payload)
        .eq("tenant_id", tenantId)
        .eq("merchant_id", merchantId)
        .eq("id", itemId)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Product not found");
      return { item: data, created: false };
    }
    const { data, error } = await supabase
      .from("products")
      .insert({ tenant_id: tenantId, merchant_id: merchantId, ...payload })
      .select("*")
      .single();
    if (error) throw error;
    return { item: data, created: true };
  }

  const payload = {
    name: input.name,
    description: input.description,
    price_cents: input.price_cents,
    duration_minutes: input.duration_minutes,
    state: input.state,
    updated_at: updatedAt,
  };
  if (itemId) {
    const { data, error } = await supabase
      .from("services")
      .update(payload)
      .eq("tenant_id", tenantId)
      .eq("merchant_id", merchantId)
      .eq("id", itemId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Service not found");
    return { item: data, created: false };
  }
  const { data, error } = await supabase
    .from("services")
    .insert({ tenant_id: tenantId, merchant_id: merchantId, ...payload })
    .select("*")
    .single();
  if (error) throw error;
  return { item: data, created: true };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function promoteCandidate(
  supabase: Db,
  tenantId: string,
  actorId: string,
  candidateId: string,
) {
  const { data: candidate, error: fetchError } = await supabase
    .from("discovery_candidates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", candidateId)
    .single();
  if (fetchError) throw fetchError;
  if (!candidate) throw new Error("Candidate not found");

  const slug = slugify(candidate.name) + "-" + candidateId.slice(0, 6);

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .insert({
      tenant_id: tenantId,
      name: candidate.name,
      slug,
      vertical: candidate.vertical,
      status: "prospect",
    })
    .select("id, name, slug, vertical, status, created_at")
    .single();
  if (merchantError) throw merchantError;

  const { error: updateError } = await supabase
    .from("discovery_candidates")
    .update({
      status: "claimed",
      merchant_id: merchant.id,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", candidateId);
  if (updateError) throw updateError;

  if (candidate.city || candidate.region) {
    const { error: locationError } = await supabase.from("locations").insert({
      tenant_id: tenantId,
      merchant_id: merchant.id,
      label: candidate.name,
      city: candidate.city ?? null,
      region: candidate.region ?? null,
      is_primary: true,
    });
    if (locationError) throw locationError;
  }

  return merchant;
}

export async function createMerchant(
  supabase: Db,
  tenantId: string,
  input: { name: string; vertical?: string; city?: string; region?: string },
) {
  const slug = slugify(input.name) + "-" + Date.now().toString(36);

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      slug,
      vertical: (input.vertical as never) ?? "other",
      status: "prospect",
    })
    .select("id, name, slug, vertical, status, created_at")
    .single();
  if (merchantError) throw merchantError;

  if (input.city || input.region) {
    const { error: locationError } = await supabase.from("locations").insert({
      tenant_id: tenantId,
      merchant_id: merchant.id,
      label: input.name,
      city: input.city ?? null,
      region: input.region ?? null,
      is_primary: true,
    });
    if (locationError) throw locationError;
  }

  return merchant;
}

export async function runMockVisibility(
  supabase: Db,
  tenantId: string,
  actorId: string,
  merchantId: string,
) {
  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select(
      "id, name, vertical, data_quality, websites(state, domain), products(id), services(id), offers(id), locations(city, region)",
    )
    .eq("tenant_id", tenantId)
    .eq("id", merchantId)
    .single();
  if (merchantError) throw merchantError;
  if (!merchant) throw new Error("Merchant not found");

  const websites = Array.isArray(merchant.websites) ? merchant.websites : [];
  const website = websites[0] as { state: string | null; domain: string | null } | undefined;
  const published = website?.state === "published";
  const locations = Array.isArray(merchant.locations) ? merchant.locations : [];
  const primaryLocation = locations.find((l) => (l as { is_primary?: boolean }).is_primary) as
    { city: string | null; region: string | null } | undefined;
  const city = primaryLocation?.city ?? null;
  const region = primaryLocation?.region ?? null;

  const vertical = String(merchant.vertical ?? "local business");
  const productCount = Array.isArray(merchant.products) ? merchant.products.length : 0;
  const serviceCount = Array.isArray(merchant.services) ? merchant.services.length : 0;
  const offerCount = Array.isArray(merchant.offers) ? merchant.offers.length : 0;

  const scope = [city, region, vertical].filter(Boolean).join(" · ");
  const prompts = [
    {
      id: crypto.randomUUID(),
      prompt: `When customers ask for a ${vertical} in ${scope || "this area"}, does ${merchant.name} show up with accurate details?`,
      intent: "local_presence",
    },
    {
      id: crypto.randomUUID(),
      prompt: `Evaluating the online storefront of ${merchant.name}: is it complete, accurate, and compelling enough to turn a search into a visit?`,
      intent: "storefront_readiness",
    },
  ];

  const { error: queriesError } = await supabase.from("visibility_queries").insert(
    prompts.map((p) => ({
      id: p.id,
      tenant_id: tenantId,
      merchant_id: merchantId,
      prompt: p.prompt,
      intent: p.intent,
    })),
  );
  if (queriesError) throw queriesError;

  const engines: VisibilityEngine[] = [{ engine: "local-readiness", model: "canonical-data-v1" }];

  const runResult = await mockVisibilityAdapter().run({
    merchantId,
    merchantName: merchant.name,
    locale: "en",
    city,
    prompts,
    engines,
    idempotencyKey: crypto.randomUUID(),
    context: {
      website: website?.domain ?? null,
      published,
      productCount,
      serviceCount,
      publishedUpdates: offerCount,
      dataQuality: merchant.data_quality,
    },
  });

  const now = new Date().toISOString();
  const { data: run, error: runError } = await supabase
    .from("visibility_runs")
    .insert({
      tenant_id: tenantId,
      merchant_id: merchantId,
      provider: runResult.provider,
      mode: runResult.mode,
      status: runResult.status,
      engines: engines as never,
      metrics: runResult.metrics as never,
      warnings: runResult.warnings as never,
      cost_usd: runResult.costUsd,
      started_at: now,
      finished_at: now,
      system_version: runResult.systemVersion,
      requested_by: actorId,
    })
    .select("id")
    .single();
  if (runError) throw runError;

  const snapshots = runResult.results.map((row) => ({
    tenant_id: tenantId,
    merchant_id: merchantId,
    run_id: run.id,
    query_id: row.queryId,
    engine: row.engine,
    provider: runResult.provider,
    model: row.model,
    score: row.score,
    rank: row.rank,
    mentioned: row.mentioned,
    recommended: row.recommended,
    sentiment: row.sentiment,
    factual_accuracy: row.factualAccuracy,
    answer_excerpt: row.answerExcerpt,
    citations: row.citations as never,
    mentioned_entities: row.mentionedEntities as never,
    cost_usd: row.costUsd,
    captured_at: row.capturedAt,
  }));
  const { error: snapshotsError } = await supabase.from("visibility_snapshots").insert(snapshots);
  if (snapshotsError) throw snapshotsError;

  return { runId: run.id, mode: runResult.mode, snapshots: snapshots.length };
}

export const MOCK_DISCOVERY_SOURCE = "mock_discovery";

export type RunDiscoveryInput = {
  query?: string;
  city?: string;
  vertical?: string;
};

export type RunDiscoveryResult = {
  status: "succeeded" | "failed";
  jobId: string;
  provider: string;
  query: string;
  vertical: string | null;
  city: string | null;
  foundCount: number;
  createdCount: number;
  updatedCount: number;
  error: string | null;
};

const VERTICAL_DEMO_NAMES: Record<string, string[]> = {
  restaurant: [
    "Harborline Grill",
    "The Gilded Skillet",
    "Marlow's Pasta Bar",
    "Ember & Oak Kitchen",
    "Saffron Street Eatery",
    "Brine & Branch",
  ],
  home_service: [
    "TrueNorth Plumbing",
    "Brightline Electric",
    "Pine & Copper Renovation",
    "Summit Appliance Repair",
    "Cedar Brook Heating",
    "Crestpoint Roofing",
  ],
  beauty: [
    "Lumen Beauty Bar",
    "Copper Fox Salon",
    "Pureform Skin Studio",
    "Mirror & Muse Nails",
    "Vela Hair Collective",
    "Bloom & Tonic Spa",
  ],
  pet_service: [
    "Wagstone Pet Co.",
    "Pawprint Boarding",
    "Fetch & Feather Grooming",
    "Happy Tail Training",
    "Velvet Pup Daycare",
    "Treadwell Mobile Vet",
  ],
  automotive: [
    "Monarch Auto Works",
    "Redline Brake & Tire",
    "Slate City Motors",
    "Hardline Detailing",
    "Cornerstone Lube",
    "Ironworks Garage",
  ],
  local_retail: [
    "Maple & Thread",
    "Harbor Row Supply",
    "Granite Street Market",
    "Blue Door General",
    "Pilion Books & Goods",
    "Anchor & Grain",
  ],
  other: [
    "Westfield Traders",
    "Grandview Services",
    "Fieldstone Studio",
    "Ridgeline Supplies",
    "Marlowe & Co.",
    "Cedar Post Goods",
  ],
};

const DEMO_VERTICALS = Object.keys(VERTICAL_DEMO_NAMES);
const DEFAULT_QUERY = "local business";

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic, vertical-aware mock candidates so re-runs refresh instead of duplicate. */
function generateMockCandidates(input: RunDiscoveryInput): Array<{
  name: string;
  vertical: string;
  city: string | null;
  region: string | null;
  phone: string;
  website: string;
  score: number;
  dedupeKey: string;
  signals: unknown[];
  evidence: unknown[];
  payload: Record<string, unknown>;
}> {
  const vertical = DEMO_VERTICALS.includes(input.vertical ?? "")
    ? (input.vertical as string)
    : "other";
  const pool = VERTICAL_DEMO_NAMES[vertical] ?? VERTICAL_DEMO_NAMES["other"]!;
  const rand = seededRand(
    hashString(`${input.query ?? DEFAULT_QUERY}|${input.city ?? ""}|${vertical}`),
  );

  const order = [...pool];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }

  const city = input.city?.trim() ? input.city.trim() : null;
  const now = new Date().toISOString();

  return order.slice(0, 5).map((name, index) => ({
    name,
    vertical,
    city,
    region: null,
    phone: `+1-415-555-01${index}`,
    website: `https://www.${slugify(name).replace(/-/g, "")}.demo`,
    score: Math.round((0.55 + rand() * 0.45) * 100) / 100,
    dedupeKey: `${MOCK_DISCOVERY_SOURCE}:${slugify(name)}`,
    signals: [
      { signal: "listings_provider", value: MOCK_DISCOVERY_SOURCE },
      { signal: "source", value: "mock local directory" },
      { signal: "recently_observed", value: true },
    ],
    evidence: [
      {
        source: MOCK_DISCOVERY_SOURCE,
        note: "Generated from a mock discovery source for demos.",
        observed_at: now,
      },
    ],
    payload: {
      source: MOCK_DISCOVERY_SOURCE,
      mock: true,
      provider_version: "1.0",
    },
  }));
}

/** Run a mock discovery pass: persist a job, transcribe results into candidates, dedupe by key. */
export async function runDiscovery(
  supabase: Db,
  tenantId: string,
  actorId: string,
  input: RunDiscoveryInput,
): Promise<RunDiscoveryResult> {
  const query = input.query?.trim() ? input.query.trim() : DEFAULT_QUERY;
  const vertical =
    input.vertical && DEMO_VERTICALS.includes(input.vertical) ? input.vertical : null;
  const city = input.city?.trim() ? input.city.trim() : null;

  const { data: job, error: jobError } = await supabase
    .from("discovery_jobs")
    .insert({
      tenant_id: tenantId,
      provider: MOCK_DISCOVERY_SOURCE,
      query,
      vertical: (vertical as never) ?? null,
      city,
      status: "running",
      requested_by: actorId,
    })
    .select("id")
    .single();
  if (jobError) throw jobError;

  try {
    const found = generateMockCandidates({
      query,
      ...(vertical ? { vertical } : {}),
      ...(city ? { city } : {}),
    });

    const { data: existing, error: fetchError } = await supabase
      .from("discovery_candidates")
      .select("id, dedupe_key")
      .eq("tenant_id", tenantId)
      .in(
        "dedupe_key",
        found.map((c) => c.dedupeKey),
      );
    if (fetchError) throw fetchError;

    const existingKeys = new Set(
      (existing ?? []).flatMap((row) => (row.dedupe_key ? [row.dedupe_key] : [])),
    );
    const now = new Date().toISOString();

    const fresh = found.filter((c) => !existingKeys.has(c.dedupeKey));
    const refresh = found.filter((c) => existingKeys.has(c.dedupeKey));

    let createdCount = 0;
    if (fresh.length > 0) {
      const { error: insertError } = await supabase.from("discovery_candidates").insert(
        fresh.map((c) => ({
          tenant_id: tenantId,
          name: c.name,
          vertical: c.vertical as never,
          city: c.city,
          region: c.region,
          website: c.website,
          phone: c.phone,
          score: c.score,
          status: "new",
          provider: MOCK_DISCOVERY_SOURCE,
          job_id: job.id,
          dedupe_key: c.dedupeKey,
          signals: c.signals as never,
          evidence: c.evidence as never,
          payload: c.payload as never,
          observed_at: now,
        })),
      );
      if (insertError) throw insertError;
      createdCount = fresh.length;
    }

    let updatedCount = 0;
    if (refresh.length > 0) {
      const candidateByKey = new Map(refresh.map((c) => [c.dedupeKey, c]));
      for (const row of existing ?? []) {
        if (!row.dedupe_key) continue;
        const candidate = candidateByKey.get(row.dedupe_key);
        if (!candidate) continue;
        const { error: updateError } = await supabase
          .from("discovery_candidates")
          .update({
            score: candidate.score,
            city: candidate.city,
            website: candidate.website,
            phone: candidate.phone,
            signals: candidate.signals as never,
            evidence: candidate.evidence as never,
            payload: candidate.payload as never,
            job_id: job.id,
            observed_at: now,
            updated_at: now,
          })
          .eq("tenant_id", tenantId)
          .eq("id", row.id);
        if (updateError) throw updateError;
        updatedCount += 1;
      }
    }

    const { error: completeError } = await supabase
      .from("discovery_jobs")
      .update({
        status: "succeeded",
        found_count: found.length,
        created_count: createdCount,
        finished_at: now,
      })
      .eq("tenant_id", tenantId)
      .eq("id", job.id);
    if (completeError) throw completeError;

    return {
      status: "succeeded",
      jobId: job.id,
      provider: MOCK_DISCOVERY_SOURCE,
      query,
      vertical,
      city,
      foundCount: found.length,
      createdCount,
      updatedCount,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Discovery run failed.";
    await supabase
      .from("discovery_jobs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", job.id);
    return {
      status: "failed",
      jobId: job.id,
      provider: MOCK_DISCOVERY_SOURCE,
      query,
      vertical,
      city,
      foundCount: 0,
      createdCount: 0,
      updatedCount: 0,
      error: message,
    };
  }
}

// =============== WEBSITE FACTORY ===============

export type MerchantGraph = {
  merchant: {
    id: string;
    name: string;
    slug: string;
    vertical: string;
    tagline: string | null;
    description: string | null;
    logo_url: string | null;
    brand_color: string | null;
  };
  locations: Array<{
    id: string;
    label: string;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    region: string | null;
    postal_code: string | null;
    country: string | null;
    phone: string | null;
    is_primary: boolean;
    business_hours: Array<{
      id: string;
      day_of_week: number;
      opens_at: string | null;
      closes_at: string | null;
      is_closed: boolean;
    }>;
  }>;
  products: Array<{
    id: string;
    name: string;
    description: string | null;
    price_cents: number | null;
    currency: string;
    sku: string | null;
  }>;
  services: Array<{
    id: string;
    name: string;
    description: string | null;
    price_cents: number | null;
    duration_minutes: number | null;
  }>;
  offers: Array<{
    id: string;
    title: string;
    description: string | null;
    discount_label: string | null;
    ends_at: string | null;
  }>;
};

async function loadMerchantGraph(
  supabase: Db,
  tenantId: string,
  merchantId: string,
): Promise<MerchantGraph> {
  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id, name, slug, vertical, tagline, description, logo_url, brand_color")
    .eq("tenant_id", tenantId)
    .eq("id", merchantId)
    .single();
  if (merchantError) throw merchantError;

  const { data: locations, error: locationsError } = await supabase
    .from("locations")
    .select("*, business_hours(id, day_of_week, opens_at, closes_at, is_closed)")
    .eq("tenant_id", tenantId)
    .eq("merchant_id", merchantId)
    .order("is_primary", { ascending: false });
  if (locationsError) throw locationsError;

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, description, price_cents, currency, sku")
    .eq("tenant_id", tenantId)
    .eq("merchant_id", merchantId)
    .eq("state", "published")
    .order("name");
  if (productsError) throw productsError;

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id, name, description, price_cents, duration_minutes")
    .eq("tenant_id", tenantId)
    .eq("merchant_id", merchantId)
    .eq("state", "published")
    .order("name");
  if (servicesError) throw servicesError;

  const { data: offers, error: offersError } = await supabase
    .from("offers")
    .select("id, title, description, discount_label, ends_at")
    .eq("tenant_id", tenantId)
    .eq("merchant_id", merchantId)
    .eq("state", "published")
    .order("created_at", { ascending: false });
  if (offersError) throw offersError;

  return {
    merchant: merchant,
    locations: (locations ?? []) as MerchantGraph["locations"],
    products: products ?? [],
    services: services ?? [],
    offers: (offers ?? []).map((offer) => ({
      id: offer.id,
      title: offer.title,
      description: offer.description,
      discount_label: offer.discount_label,
      ends_at: offer.ends_at,
    })),
  };
}

export async function findWebsiteForMerchant(supabase: Db, tenantId: string, merchantId: string) {
  const { data, error } = await supabase
    .from("websites")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function ensureWebsiteForMerchant(supabase: Db, tenantId: string, merchantId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("websites")
    .select("id, slug, state")
    .eq("tenant_id", tenantId)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing.id;

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("name, slug")
    .eq("tenant_id", tenantId)
    .eq("id", merchantId)
    .single();
  if (merchantError) throw merchantError;

  const { data: website, error: websiteError } = await supabase
    .from("websites")
    .insert({
      tenant_id: tenantId,
      merchant_id: merchantId,
      domain: `${merchant.slug}.local`,
      slug: merchant.slug,
      theme: "classic",
      state: "draft",
      seo_title: merchant.name,
    })
    .select("id")
    .single();
  if (websiteError) throw websiteError;
  return website.id;
}

export async function listWebsites(supabase: Db, tenantId: string) {
  const { data, error } = await supabase
    .from("websites")
    .select(
      "id, merchant_id, slug, state, theme, domain, seo_title, published_version, published_at, last_generated_at, created_at, updated_at, merchant:merchants(name, slug, vertical), website_pages(id)",
    )
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((website) => ({
    ...website,
    pagesCount: Array.isArray(website.website_pages) ? website.website_pages.length : 0,
  }));
}

export async function getWebsiteWithPages(supabase: Db, tenantId: string, websiteId: string) {
  const { data: website, error } = await supabase
    .from("websites")
    .select(
      "*, merchant:merchants(id, name, slug, vertical, tagline, description), website_pages(id, path, title, kind, state, version, seo_title, meta_description, updated_at, created_at)",
    )
    .eq("tenant_id", tenantId)
    .eq("id", websiteId)
    .maybeSingle();
  if (error) throw error;
  return website ?? null;
}

export async function generateHomePageFromGraph(
  supabase: Db,
  tenantId: string,
  websiteId: string,
  actorId: string,
) {
  const { data: website, error: websiteError } = await supabase
    .from("websites")
    .select("id, merchant_id")
    .eq("tenant_id", tenantId)
    .eq("id", websiteId)
    .single();
  if (websiteError) throw websiteError;
  if (!website) throw new Error("Website not found");

  const graph = await loadMerchantGraph(supabase, tenantId, website.merchant_id);
  const { merchant } = graph;

  const primary = graph.locations.find((location) => location.is_primary) ?? graph.locations[0];
  const city = primary?.city ?? null;
  const locationLine = primary ? [primary.city, primary.region].filter(Boolean).join(", ") : null;

  const blocks = [
    {
      type: "hero",
      name: merchant.name,
      tagline: merchant.tagline,
      description: merchant.description,
      vertical: merchant.vertical,
      logoUrl: merchant.logo_url,
    },
    {
      type: "locations",
      city: city,
      locationLine: locationLine,
      items: graph.locations.map((location) => ({
        label: location.label,
        addressLine1: location.address_line1,
        addressLine2: location.address_line2,
        city: location.city,
        region: location.region,
        postalCode: location.postal_code,
        country: location.country,
        phone: location.phone,
        isPrimary: location.is_primary,
        hours: location.business_hours.map((hours) => ({
          dayOfWeek: hours.day_of_week,
          opensAt: hours.opens_at,
          closesAt: hours.closes_at,
          isClosed: hours.is_closed,
        })),
      })),
    },
    {
      type: "services",
      items: graph.services.map((service) => ({
        name: service.name,
        description: service.description,
        priceCents: service.price_cents,
        durationMinutes: service.duration_minutes,
      })),
    },
    {
      type: "products",
      items: graph.products.map((product) => ({
        name: product.name,
        description: product.description,
        priceCents: product.price_cents,
        currency: product.currency,
        sku: product.sku,
      })),
    },
    {
      type: "offers",
      items: graph.offers.map((offer) => ({
        title: offer.title,
        description: offer.description,
        discountLabel: offer.discount_label,
        endsAt: offer.ends_at,
      })),
    },
  ];

  const seoTitle = merchant.name + (city ? ` in ${city}` : "");
  const metaDescription =
    merchant.tagline ??
    merchant.description?.slice(0, 155) ??
    `${merchant.name} — a local ${merchant.vertical} business.`;

  const { data: existing, error: existingError } = await supabase
    .from("website_pages")
    .select("id, version")
    .eq("tenant_id", tenantId)
    .eq("website_id", websiteId)
    .eq("path", "/")
    .maybeSingle();
  if (existingError) throw existingError;

  const now = new Date().toISOString();
  const version = (existing?.version ?? 0) + 1;

  const pageFields: Database["public"]["Tables"]["website_pages"]["Insert"] = {
    tenant_id: tenantId,
    website_id: websiteId,
    merchant_id: website.merchant_id,
    path: "/",
    kind: "home",
    title: merchant.name,
    seo_title: seoTitle,
    meta_description: metaDescription,
    body: buildHomeBody(graph),
    blocks: blocks as never,
    state: "draft",
    generated: true,
    locked: true,
    sort_order: 0,
    version,
    updated_at: now,
  };

  const { data: page, error: pageError } = existing
    ? await supabase
        .from("website_pages")
        .update(pageFields)
        .eq("tenant_id", tenantId)
        .eq("id", existing.id)
        .select("id, path, title, state, version, updated_at")
        .single()
    : await supabase
        .from("website_pages")
        .insert(pageFields)
        .select("id, path, title, state, version, updated_at")
        .single();
  if (pageError) throw pageError;

  const { error: updateError } = await supabase
    .from("websites")
    .update({
      state: "draft",
      last_generated_at: now,
      seo_title: seoTitle,
      published_at: null,
      updated_at: now,
    })
    .eq("tenant_id", tenantId)
    .eq("id", websiteId);
  if (updateError) throw updateError;

  return {
    websiteId,
    merchantId: website.merchant_id,
    page,
    version,
    sectionCount: blocks.length,
  };
}

function buildHomeBody(graph: MerchantGraph): string {
  const { merchant } = graph;
  const lines: string[] = [];
  lines.push(`# ${merchant.name}`);
  if (merchant.tagline) lines.push(merchant.tagline);
  if (merchant.description) lines.push("", merchant.description);

  if (graph.locations.length > 0) {
    lines.push("", "## Locations");
    for (const location of graph.locations) {
      const parts = [location.label, [location.city, location.region].filter(Boolean).join(", ")]
        .filter(Boolean)
        .join(" — ");
      const hours = location.business_hours
        .filter((entry) => !entry.is_closed)
        .map((entry) => `${entry.day_of_week}: ${entry.opens_at ?? "—"}-${entry.closes_at ?? "—"}`)
        .join(", ");
      lines.push(`- ${parts}${hours ? ` (${hours})` : ""}`);
    }
  }

  if (graph.services.length > 0) {
    lines.push("", "## Services");
    for (const service of graph.services) {
      const price = service.price_cents != null ? `$${(service.price_cents / 100).toFixed(2)}` : "";
      const duration = service.duration_minutes ? ` · ${service.duration_minutes} min` : "";
      lines.push(`- ${service.name}${price ? ` — ${price}` : ""}${duration}`);
    }
  }

  if (graph.products.length > 0) {
    lines.push("", "## Products");
    for (const product of graph.products) {
      const price = product.price_cents != null ? `$${(product.price_cents / 100).toFixed(2)}` : "";
      lines.push(`- ${product.name}${price ? ` — ${price}` : ""}`);
    }
  }

  if (graph.offers.length > 0) {
    lines.push("", "## Offers");
    for (const offer of graph.offers) {
      const ends = offer.ends_at
        ? ` valid until ${new Date(offer.ends_at).toISOString().slice(0, 10)}`
        : "";
      lines.push(
        `- ${offer.title}${offer.discount_label ? ` — ${offer.discount_label}` : ""}${ends}`,
      );
    }
  }

  return lines.join("\n");
}

export async function publishPage(supabase: Db, tenantId: string, websiteId: string) {
  const now = new Date().toISOString();
  const { data: website, error: websiteError } = await supabase
    .from("websites")
    .select("id, merchant_id")
    .eq("tenant_id", tenantId)
    .eq("id", websiteId)
    .maybeSingle();
  if (websiteError) throw websiteError;
  if (!website) throw new Error("Website not found");

  const { data: home, error: homeError } = await supabase
    .from("website_pages")
    .select("id, path, version")
    .eq("tenant_id", tenantId)
    .eq("website_id", websiteId)
    .eq("path", "/")
    .maybeSingle();
  if (homeError) throw homeError;
  if (!home) throw new Error("Generate a homepage before publishing.");

  const { error: websiteUpdateError } = await supabase
    .from("websites")
    .update({
      state: "published",
      published_at: now,
      published_version: home.version,
      updated_at: now,
    })
    .eq("tenant_id", tenantId)
    .eq("id", websiteId);
  if (websiteUpdateError) throw websiteUpdateError;

  const { error: pageError } = await supabase
    .from("website_pages")
    .update({ state: "published", published_at: now, updated_at: now })
    .eq("tenant_id", tenantId)
    .eq("id", home.id);
  if (pageError) throw pageError;

  return { websiteId, merchantId: website.merchant_id, publishedVersion: home.version };
}

export async function unpublishPage(supabase: Db, tenantId: string, websiteId: string) {
  const now = new Date().toISOString();
  const { error: websiteError } = await supabase
    .from("websites")
    .update({ state: "draft", published_at: null, updated_at: now })
    .eq("tenant_id", tenantId)
    .eq("id", websiteId);
  if (websiteError) throw websiteError;

  const { data: home, error: fetchError } = await supabase
    .from("website_pages")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("website_id", websiteId)
    .eq("path", "/")
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (home) {
    const { error: pageError } = await supabase
      .from("website_pages")
      .update({ state: "draft", published_at: null, updated_at: now })
      .eq("tenant_id", tenantId)
      .eq("id", home.id);
    if (pageError) throw pageError;
  }

  return { websiteId };
}

export async function getPublishedPublicPage(supabase: Db, slug: string) {
  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id, name, slug, tagline, description, vertical, logo_url")
    .eq("slug", slug)
    .maybeSingle();
  if (merchantError) throw merchantError;
  if (!merchant) return null;

  const { data: website, error: websiteError } = await supabase
    .from("websites")
    .select("id, slug, state, theme, published_version, published_at, updated_at, seo_title")
    .eq("merchant_id", merchant.id)
    .eq("state", "published")
    .maybeSingle();
  if (websiteError) throw websiteError;
  if (!website) return null;

  const { data: pages, error: pagesError } = await supabase
    .from("website_pages")
    .select("id, path, title, state, version, seo_title, meta_description")
    .eq("website_id", website.id)
    .eq("state", "published");
  if (pagesError) throw pagesError;

  const page = (pages ?? []).find((candidate) => candidate.path === "/");
  if (!page) return null;

  const [locations, products, services, offers] = await Promise.all([
    supabase
      .from("locations")
      .select(
        "id, label, address_line1, address_line2, city, region, postal_code, country, phone, is_primary, business_hours(id, day_of_week, opens_at, closes_at, is_closed)",
      )
      .eq("merchant_id", merchant.id)
      .order("is_primary", { ascending: false }),
    supabase
      .from("products")
      .select("id, name, description, price_cents, currency, sku")
      .eq("merchant_id", merchant.id)
      .eq("state", "published")
      .order("name"),
    supabase
      .from("services")
      .select("id, name, description, price_cents, duration_minutes")
      .eq("merchant_id", merchant.id)
      .eq("state", "published")
      .order("name"),
    supabase
      .from("offers")
      .select("id, title, description, discount_label, ends_at")
      .eq("merchant_id", merchant.id)
      .eq("state", "published")
      .order("created_at", { ascending: false }),
  ]);

  return {
    website: {
      id: website.id,
      slug: website.slug,
      state: website.state,
      theme: website.theme,
      publishedVersion: website.published_version,
      publishedAt: website.published_at,
      updatedAt: website.updated_at,
      seoTitle: website.seo_title,
    },
    merchant,
    page: {
      id: page.id,
      path: page.path,
      title: page.title,
      state: page.state,
      version: page.version,
      seoTitle: page.seo_title,
      metaDescription: page.meta_description,
    },
    locations: locations.data ?? [],
    products: products.data ?? [],
    services: services.data ?? [],
    offers: offers.data ?? [],
  };
}

// =============== MERCHANT PORTAL ===============

export const HAPPENING_KINDS = [
  "event",
  "promotion",
  "announcement",
  "menu_change",
  "hours_change",
] as const;
export type HappeningKind = (typeof HAPPENING_KINDS)[number];

/** Resolves the tenant for a merchant that the caller may manage — either as a
 *  linked store owner (merchant_owners) or as an operator via workspace
 *  membership. Portal server functions must authorize through here, never the
 *  raw tenant, so owners are scoped strictly to their own merchant. */
export async function resolveManageableMerchant(
  supabase: Db,
  userId: string,
  merchantId: string,
): Promise<{ tenantId: string; merchant: { id: string; name: string } }> {
  const { data: owner, error: ownerError } = await supabase
    .from("merchant_owners")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (ownerError) throw ownerError;

  if (owner) {
    const merchant = await getTenantMerchant(supabase, owner.tenant_id, merchantId);
    return { tenantId: owner.tenant_id, merchant };
  }

  const tenantId = await resolveTenant(supabase);
  const merchant = await getTenantMerchant(supabase, tenantId, merchantId);
  return { tenantId, merchant };
}

async function getTenantMerchant(
  supabase: Db,
  tenantId: string,
  merchantId: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from("merchants")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("id", merchantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Merchant not found");
  return data;
}

/** Resolves the caller's owned merchants. Pending invites (invited by email,
 *  not yet claimed) are claimed automatically when the signed-in user's email
 *  matches, so a merchant who simply opens the portal with the invited email
 *  is linked without operator action. */
export async function merchantPortalContext(supabase: Db, userId: string) {
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const email = user.user?.email ?? null;

  if (email) {
    const { error: claimError } = await supabase
      .from("merchant_owners")
      .update({ user_id: userId })
      .ilike("email", email)
      .is("user_id", null);
    if (claimError) throw claimError;
  }

  const { data: owned, error: ownedError } = await supabase
    .from("merchant_owners")
    .select("tenant_id, merchant_id")
    .eq("user_id", userId);
  if (ownedError) throw ownedError;

  const merchants = [];
  for (const owner of owned ?? []) {
    const detail = await merchantDetail(supabase, owner.tenant_id, owner.merchant_id);
    const website = (detail.websites ?? [])[0];
    let websitePages: Awaited<ReturnType<typeof getWebsiteWithPages>> = null;
    if (website) {
      websitePages = await getWebsiteWithPages(supabase, owner.tenant_id, website.id);
    }
    merchants.push({ ...detail, websitePages });
  }

  let operator = false;
  try {
    await resolveTenant(supabase);
    operator = true;
  } catch {
    operator = false;
  }

  return { merchants, operator };
}

export type MerchantProfileInput = {
  name: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  brand_color: string | null;
};

/** Merchant self-service identity update. Unlike the operator identity edit,
 *  store owners cannot change slugs, verticals, statuses, or categories. */
export async function updateMerchantProfile(
  supabase: Db,
  tenantId: string,
  merchantId: string,
  input: MerchantProfileInput,
) {
  const { data, error } = await supabase
    .from("merchants")
    .update({
      name: input.name,
      tagline: input.tagline,
      description: input.description,
      logo_url: input.logo_url,
      brand_color: input.brand_color,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", merchantId)
    .select("id, name, slug, tagline, description, logo_url, brand_color")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Merchant not found");
  return data;
}

type HoursEntry = {
  day_of_week: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
};

/** Saves a location (create or update) and replaces its business hours in one
 *  call so the public site always reflects consistent hours. */
export async function saveLocationWithHours(
  supabase: Db,
  tenantId: string,
  merchantId: string,
  locationId: string | null,
  input: LocationInput,
  hours: HoursEntry[],
) {
  const { location } = await upsertLocation(supabase, tenantId, merchantId, locationId, input);

  const { error: deleteError } = await supabase
    .from("business_hours")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("location_id", location.id);
  if (deleteError) throw deleteError;

  if (hours.length > 0) {
    const { error: insertError } = await supabase.from("business_hours").insert(
      hours.map((hour) => ({
        tenant_id: tenantId,
        location_id: location.id,
        day_of_week: hour.day_of_week,
        opens_at: hour.opens_at,
        closes_at: hour.closes_at,
        is_closed: hour.is_closed,
      })),
    );
    if (insertError) throw insertError;
  }

  return { location };
}

export async function deleteLocationRow(
  supabase: Db,
  tenantId: string,
  merchantId: string,
  locationId: string,
) {
  const { error } = await supabase
    .from("locations")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("merchant_id", merchantId)
    .eq("id", locationId);
  if (error) throw error;
}

export type OfferInput = {
  title: string;
  description: string | null;
  discount_label: string | null;
  starts_at: string | null;
  ends_at: string | null;
  state: PublishState;
};

export async function upsertOffer(
  supabase: Db,
  tenantId: string,
  merchantId: string,
  offerId: string | null,
  input: OfferInput,
) {
  const payload = {
    title: input.title,
    description: input.description,
    discount_label: input.discount_label,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    state: input.state,
    updated_at: new Date().toISOString(),
  };
  if (offerId) {
    const { data, error } = await supabase
      .from("offers")
      .update(payload)
      .eq("tenant_id", tenantId)
      .eq("merchant_id", merchantId)
      .eq("id", offerId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Offer not found");
    return { offer: data, created: false };
  }
  const { data, error } = await supabase
    .from("offers")
    .insert({ tenant_id: tenantId, merchant_id: merchantId, ...payload })
    .select("*")
    .single();
  if (error) throw error;
  return { offer: data, created: true };
}

export async function deleteOfferRow(
  supabase: Db,
  tenantId: string,
  merchantId: string,
  offerId: string,
) {
  const { error } = await supabase
    .from("offers")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("merchant_id", merchantId)
    .eq("id", offerId);
  if (error) throw error;
}

export type HappeningInput = {
  kind: HappeningKind;
  title: string;
  body: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: "draft" | "published";
};

/** Merchant self-service happening upsert. Publishing is seamless: the row is
 *  marked published immediately and published_at is stamped. */
export async function upsertHappeningRow(
  supabase: Db,
  tenantId: string,
  merchantId: string,
  happeningId: string | null,
  input: HappeningInput,
) {
  const now = new Date().toISOString();
  const payload = {
    kind: input.kind,
    title: input.title,
    body: input.body,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    status: input.status,
    published_at: input.status === "published" ? now : null,
    updated_at: now,
  };
  if (happeningId) {
    const { data, error } = await supabase
      .from("happenings")
      .update(payload)
      .eq("tenant_id", tenantId)
      .eq("merchant_id", merchantId)
      .eq("id", happeningId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Happening not found");
    return { happening: data, created: false };
  }
  const { data, error } = await supabase
    .from("happenings")
    .insert({ tenant_id: tenantId, merchant_id: merchantId, ...payload })
    .select("*")
    .single();
  if (error) throw error;
  return { happening: data, created: true };
}

export async function deleteHappeningRow(
  supabase: Db,
  tenantId: string,
  merchantId: string,
  happeningId: string,
) {
  const { error } = await supabase
    .from("happenings")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("merchant_id", merchantId)
    .eq("id", happeningId);
  if (error) throw error;
}

export async function deleteCatalogItem(
  supabase: Db,
  tenantId: string,
  merchantId: string,
  kind: "product" | "service",
  itemId: string,
) {
  const table = kind === "product" ? "products" : "services";
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("tenant_id", tenantId)
    .eq("merchant_id", merchantId)
    .eq("id", itemId);
  if (error) throw error;
}
