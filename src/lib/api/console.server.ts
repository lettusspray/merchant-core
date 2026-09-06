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
