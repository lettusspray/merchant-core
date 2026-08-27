/**
 * Read/write helpers for the operator console. All queries run through the
 * caller's authenticated Supabase client, so tenant isolation is enforced by
 * RLS in the database, not by application filtering alone.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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
  const scoped = <T extends keyof Database["public"]["Tables"]>(table: T) =>
    supabase.from(table).select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);

  const [merchants, active, prospects, pendingContent, pendingObs, orders, subs] = await Promise.all([
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
    supabase.from("subscriptions").select("price_cents, status, interval").eq("tenant_id", tenantId),
  ]);

  const paidOrders = (orders.data ?? []).filter((o) => o.status !== "cancelled" && o.status !== "refunded");
  const gmvCents = paidOrders.reduce((sum, o) => sum + o.total_cents, 0);
  const mrrCents = (subs.data ?? [])
    .filter((s) => s.status === "active" || s.status === "trialing")
    .reduce((sum, s) => sum + (s.interval === "year" ? Math.round(s.price_cents / 12) : s.price_cents), 0);

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
    .select("id, name, slug, vertical, status, tagline, data_quality, updated_at, locations(city, region, is_primary)")
    .eq("tenant_id", tenantId)
    .order("name");
  if (filters.search) query = query.ilike("name", `%${filters.search}%`);
  if (filters.vertical) query = query.eq("vertical", filters.vertical as never);
  if (filters.status) query = query.eq("status", filters.status as never);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
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
    supabase.from("websites").select("*, website_pages(id, path, title, state, meta_description, updated_at)").match(eq),
    supabase
      .from("visibility_snapshots")
      .select("*, visibility_queries(prompt, intent)")
      .match(eq)
      .order("captured_at", { ascending: false }),
    supabase.from("orders").select("*, order_items(*)").match(eq).order("placed_at", { ascending: false }),
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
