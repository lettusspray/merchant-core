/**
 * Discovery pipeline (server-only).
 *
 * One run does: create a running job → execute the provider adapter → receive
 * source records → normalize each → persist raw provenance (source_records) →
 * resolve-or-create candidates (stable external ID first, then normalized
 * domain / phone / address / name+location signals — never similar names alone)
 * → attach source-backed observations → score → handle duplicates with
 * explainable match reasons → persist counters on the job → update source
 * health → record an append-only event.
 *
 * Per-record failures are isolated: a single malformed source record is skipped
 * and counted, it never aborts the run. Ingestion is idempotent: the same
 * external record re-fetched never creates a second source record or candidate.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { discoveryAdapter } from "@/lib/adapters/discovery.server";
import { websiteProbeAdapter, type WebsiteProbeResult } from "@/lib/adapters/discovery.server";
import { ProviderNotConfiguredError } from "@/lib/adapters/contracts";
import {
  normalizeAddress,
  normalizeName,
  normalizeRecord,
  normalizedFields,
  slugify,
  type NormalizedCandidate,
  type SourceBusinessRecord,
} from "@/lib/discovery/normalize";
import { computeScore } from "@/lib/discovery/scoring";
import { discoverySourceMeta } from "@/lib/discovery/sources";

export type Db = SupabaseClient<Database>;

export type DiscoveryRunInput = {
  provider: string;
  query?: string;
  city?: string;
  region?: string;
  vertical?: string;
  limit?: number;
};

export type RunOutcome = "succeeded" | "partially" | "failed";

export type RunPipelineResult = {
  jobId: string;
  provider: string;
  label: string;
  status: RunOutcome;
  mode: string;
  query: string;
  vertical: string | null;
  city: string | null;
  region: string | null;
  foundCount: number;
  receivedCount: number;
  createdCount: number;
  updatedCount: number;
  dedupedCount: number;
  failedCount: number;
  warnings: string[];
  startedAt: string;
  finishedAt: string;
};

type JobRow = {
  id: string;
};

async function getOrCreateJob(
  supabase: Db,
  tenantId: string,
  actorId: string,
  connectorId: string,
  input: DiscoveryRunInput,
  mode: string,
  query: string,
): Promise<JobRow> {
  const { data, error } = await supabase
    .from("discovery_jobs")
    .insert({
      tenant_id: tenantId,
      connector_id: connectorId,
      provider: input.provider,
      query,
      city: input.city?.trim() || null,
      region: input.region?.trim() || null,
      vertical:
        ((input.vertical?.trim() || null) as Database["public"]["Enums"]["vertical"] | null) ??
        null,
      mode,
      status: "running",
      requested_by: actorId,
      warnings: [],
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

async function getOrCreateConnector(
  supabase: Db,
  tenantId: string,
  provider: string,
  name: string,
  category: string,
  configured: boolean,
): Promise<{
  id: string;
  status: string;
  records_received: number | null;
  records_ingested: number | null;
}> {
  const existing = await supabase
    .from("source_connectors")
    .select("id, status, records_received, records_ingested")
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    return existing.data;
  }
  const { data, error } = await supabase
    .from("source_connectors")
    .insert({
      tenant_id: tenantId,
      provider,
      name,
      category,
      status: configured ? "configured" : "not_configured",
    })
    .select("id, status, records_received, records_ingested")
    .single();
  if (error) {
    if (error.code === "23505") {
      const retry = await supabase
        .from("source_connectors")
        .select("id, status, records_received, records_ingested")
        .eq("tenant_id", tenantId)
        .eq("provider", provider)
        .maybeSingle();
      if (retry.error) throw retry.error;
      if (retry.data) return retry.data;
      throw new Error(`Connector create raced without a row for provider: ${provider}`);
    }
    throw error;
  }
  if (!data) throw new Error(`Connector create returned no row for provider: ${provider}`);
  return data;
}

/** Stable FNV-1a content hash for idempotent change detection (not crypto). */
export function contentHash(payload: string): string {
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function canonicalContent(normalized: NormalizedCandidate): string {
  return [
    normalized.name,
    normalized.vertical,
    normalized.categoryLabel ?? "",
    normalized.addressLine1 ?? "",
    normalized.city ?? "",
    normalized.region ?? "",
    normalized.postalCode ?? "",
    normalized.country ?? "",
    normalized.latitude ?? "",
    normalized.longitude ?? "",
    normalized.phoneE164 ?? "",
    normalized.website ?? "",
    normalized.hours ?? "",
  ]
    .join("|")
    .toLowerCase();
}

type CandidateLookup = {
  id: string;
  name: string;
  provider: string;
  external_id: string | null;
  dedupe_key: string | null;
  domain: string | null;
  phone_e164: string | null;
  address_line1: string | null;
  city: string | null;
  region: string | null;
  score: number;
  duplicate_of: string | null;
  status: Database["public"]["Enums"]["discovery_status"];
  merchant_id: string | null;
  refresh_count: number;
  normalized: unknown;
};

function findSignalMatches(
  candidates: CandidateLookup[],
  normalized: NormalizedCandidate,
): Array<{ candidateId: string; reason: string; score: number }> {
  const matches: Array<{ candidateId: string; reason: string; score: number }> = [];
  const normalizedAddress = normalizeAddress(normalized.addressLine1);
  for (const candidate of candidates) {
    let reason: string | null = null;
    if (normalized.domain && candidate.domain && normalized.domain === candidate.domain) {
      reason = `domain:${normalized.domain}`;
    } else if (
      normalized.phoneE164 &&
      candidate.phone_e164 &&
      normalized.phoneE164 === candidate.phone_e164
    ) {
      reason = `phone:${normalized.phoneE164}`;
    } else if (
      normalizedAddress &&
      candidate.address_line1 &&
      normalizedAddress === normalizeAddress(candidate.address_line1)
    ) {
      reason = `address:${normalizedAddress}`;
    } else if (
      candidate.city &&
      normalized.city &&
      candidate.city === normalized.city &&
      normalized.matchName.length >= 2 &&
      normalizeName(candidate.name) === normalized.matchName
    ) {
      reason = `name_and_city:${normalized.matchName}`;
    }
    if (reason) matches.push({ candidateId: candidate.id, reason, score: candidate.score });
  }
  return matches;
}

async function recordObservation(
  supabase: Db,
  tenantId: string,
  input: {
    candidateId: string;
    sourceRecordId: string | null;
    provider: string;
    fieldPath: string;
    observedValue: string | null;
    currentValue?: string | null;
    confidence?: number;
    sourceUrl?: string | null;
    observedAt?: string;
  },
) {
  const { error } = await supabase.from("observations").insert({
    tenant_id: tenantId,
    candidate_id: input.candidateId,
    source_record_id: input.sourceRecordId,
    provider: input.provider,
    field_path: input.fieldPath,
    observed_value: input.observedValue,
    current_value: input.currentValue ?? input.observedValue,
    confidence: input.confidence ?? 0.6,
    source_url: input.sourceUrl ?? null,
    observed_at: input.observedAt ?? new Date().toISOString(),
  });
  if (error) throw error;
}

/**
 * Executes one full discovery run and persists every counter the job row
 * carries. Throws only for fatal (setup) errors; per-record issues are counted.
 */
export async function runDiscoveryPipeline(
  supabase: Db,
  tenantId: string,
  actorId: string,
  input: DiscoveryRunInput,
): Promise<RunPipelineResult> {
  const provider = input.provider;
  const meta = discoverySourceMeta(provider);
  if (!meta) throw new Error(`Unknown discovery source: ${provider}`);

  const adapter = discoveryAdapter(provider);
  const status = adapter.status();
  const query = input.query?.trim() ? input.query.trim() : "nearby business";
  const nowIso = new Date().toISOString();

  const connector = await getOrCreateConnector(
    supabase,
    tenantId,
    provider,
    meta.label,
    "discovery",
    status.configured,
  );

  const job = await getOrCreateJob(
    supabase,
    tenantId,
    actorId,
    connector.id,
    input,
    status.mode,
    query,
  );

  await supabase
    .from("source_connectors")
    .update({ status: "syncing", last_run_at: nowIso })
    .eq("tenant_id", tenantId)
    .eq("id", connector.id);

  let records: SourceBusinessRecord[] = [];
  try {
    records = await adapter.search({
      query,
      ...(input.vertical?.trim() ? { vertical: input.vertical.trim() } : {}),
      ...(input.city?.trim() ? { city: input.city.trim() } : {}),
      ...(input.region?.trim() ? { region: input.region.trim() } : {}),
      limit: input.limit ?? 20,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Discovery run failed";
    const isNotConfigured = err instanceof ProviderNotConfiguredError;
    await Promise.all([
      supabase
        .from("discovery_jobs")
        .update({
          status: "failed",
          error: message,
          finished_at: nowIso,
        })
        .eq("tenant_id", tenantId)
        .eq("id", job.id),
      supabase
        .from("source_connectors")
        .update({
          status: "error",
          last_failure_at: nowIso,
          last_error: message,
        })
        .eq("tenant_id", tenantId)
        .eq("id", connector.id),
      supabase.from("events").insert({
        tenant_id: tenantId,
        actor_id: actorId,
        kind: isNotConfigured ? "discovery.run_rejected" : "discovery.run_failed",
        subject_type: "discovery_job",
        subject_id: job.id,
        payload: { provider, error: message },
      }),
    ]);
    return {
      jobId: job.id,
      provider,
      label: meta.label,
      status: "failed",
      mode: status.mode,
      query,
      vertical: input.vertical?.trim() || null,
      city: input.city?.trim() || null,
      region: input.region?.trim() || null,
      foundCount: 0,
      receivedCount: 0,
      createdCount: 0,
      updatedCount: 0,
      dedupedCount: 0,
      failedCount: 0,
      warnings: [message],
      startedAt: nowIso,
      finishedAt: nowIso,
    };
  }

  const warnings: string[] = [];
  let receivedCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let dedupedCount = 0;
  let failedCount = 0;

  // Candidate matching context — loaded once, matched in JS so normalized
  // comparison functions are used consistently.
  const { data: existingCandidates } = await supabase
    .from("discovery_candidates")
    .select(
      "id, name, provider, external_id, dedupe_key, domain, phone_e164, address_line1, city, region, score, duplicate_of, status, merchant_id, refresh_count, normalized",
    )
    .eq("tenant_id", tenantId);
  const lookup = (existingCandidates ?? []) as CandidateLookup[];

  for (const record of records) {
    let normalized: NormalizedCandidate;
    try {
      normalized = normalizeRecord(record, input.vertical?.trim() || null);
    } catch (err) {
      failedCount += 1;
      warnings.push(
        `Record ${record.externalId ?? "(no id)"}: ${err instanceof Error ? err.message : "malformed source record"}`,
      );
      continue;
    }
    receivedCount += 1;

    const hash = contentHash(canonicalContent(normalized));
    const fetchedAt = record.retrievedAt ?? nowIso;

    // 1) Persist raw provenance. Unique (tenant, connector, external_id).
    let sourceRecordId: string | null = null;
    if (record.externalId) {
      const { data: existing } = await supabase
        .from("source_records")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("connector_id", connector.id)
        .eq("external_id", record.externalId)
        .maybeSingle();
      if (existing) {
        sourceRecordId = existing.id;
      } else {
        const { data, error } = await supabase
          .from("source_records")
          .insert({
            tenant_id: tenantId,
            connector_id: connector.id,
            external_id: record.externalId,
            provider,
            payload: record.raw as never,
            fetched_at: fetchedAt,
            source_url: record.sourceUrl ?? null,
            content_hash: hash,
            kind: "discovery",
          })
          .select("id")
          .single();
        if (error) {
          failedCount += 1;
          warnings.push(`Record ${record.externalId}: could not persist source record.`);
          continue;
        }
        sourceRecordId = data.id;
      }
    }

    // 2) Resolve candidate: stable external ID first, then normalized signals.
    let resolved: { candidateId: string; created: boolean; reason: string | null } | null = null;

    if (record.externalId) {
      const byExternal = lookup.find(
        (candidate) =>
          candidate.provider === provider &&
          candidate.external_id != null &&
          candidate.external_id === record.externalId,
      );
      if (byExternal) {
        resolved = {
          candidateId: byExternal.id,
          created: false,
          reason: `external_id:${record.externalId}`,
        };
      }
    }

    if (!resolved) {
      const matches = findSignalMatches(lookup, normalized);
      if (matches.length > 0) {
        const duplicateOf = (candidateId: string) =>
          lookup.find((candidate) => candidate.id === candidateId)?.duplicate_of != null;
        const ordered = [...matches].sort((a, b) => {
          const dupA = duplicateOf(a.candidateId) ? 1 : 0;
          const dupB = duplicateOf(b.candidateId) ? 1 : 0;
          if (dupA !== dupB) return dupA - dupB;
          if (a.score !== b.score) return b.score - a.score;
          return a.candidateId.localeCompare(b.candidateId);
        });
        const survivor = ordered[0]!;
        resolved = { candidateId: survivor.candidateId, created: false, reason: survivor.reason };
        for (const lost of ordered.slice(1)) {
          await supabase
            .from("discovery_candidates")
            .update({
              duplicate_of: survivor.candidateId,
              match_reason: survivor.reason,
              updated_at: nowIso,
            })
            .eq("tenant_id", tenantId)
            .eq("id", lost.candidateId);
          dedupedCount += 1;
        }
      }
    }

    const score = computeScore(normalized, {
      provider,
      retrievedAt: fetchedAt,
      duplicateConfidence: 1,
      verticalHintMatched: Boolean(
        input.vertical?.trim() && normalized.vertical === input.vertical,
      ),
    });

    if (resolved) {
      // Refresh existing candidate: re-score, re-attach provenance, surface
      // changed fields as pending observations (never touching a merchant).
      const candidateId = resolved.candidateId;
      const previous = lookup.find((candidate) => candidate.id === candidateId);
      const previousNormalized = (previous?.normalized ?? {}) as NormalizedCandidate;
      const changedFields = normalizedFields(previousNormalized)
        .map((field, index) => ({
          field: field.path,
          previous: field.value,
          observed: normalizedFields(normalized)[index]?.value ?? null,
        }))
        .filter((change) => String(change.previous ?? "") !== String(change.observed ?? ""));

      const { error: updateError } = await supabase
        .from("discovery_candidates")
        .update({
          name: normalized.name,
          vertical: normalized.vertical as never,
          category_label: normalized.categoryLabel,
          address_line1: normalized.addressLine1,
          city: normalized.city,
          region: normalized.region,
          postal_code: normalized.postalCode,
          country: normalized.country,
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          phone: normalized.phone,
          phone_e164: normalized.phoneE164,
          website: normalized.website,
          domain: normalized.domain,
          source_url: normalized.sourceUrl,
          external_id: record.externalId ?? null,
          normalized: normalized as never,
          score: score.score,
          score_components: score.components as never,
          signals: score.signals as never,
          job_id: job.id,
          observed_at: fetchedAt,
          last_refreshed_at: nowIso,
          refresh_count: (previous?.refresh_count ?? 0) + 1,
          updated_at: nowIso,
        })
        .eq("tenant_id", tenantId)
        .eq("id", candidateId);
      if (updateError) throw updateError;
      updatedCount += 1;

      if (sourceRecordId) {
        await supabase
          .from("source_records")
          .update({ candidate_id: candidateId, updated_at: nowIso })
          .eq("tenant_id", tenantId)
          .eq("id", sourceRecordId);
      }
      for (const field of changedFields) {
        await recordObservation(supabase, tenantId, {
          candidateId,
          sourceRecordId,
          provider,
          fieldPath: `candidate.${field.field}`,
          observedValue: field.observed,
          currentValue: field.previous,
          confidence: 0.8,
          sourceUrl: record.sourceUrl ?? null,
          observedAt: fetchedAt,
        });
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("discovery_candidates")
        .insert({
          tenant_id: tenantId,
          name: normalized.name,
          vertical: normalized.vertical as never,
          category_label: normalized.categoryLabel,
          address_line1: normalized.addressLine1,
          city: normalized.city,
          region: normalized.region,
          postal_code: normalized.postalCode,
          country: normalized.country,
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          phone: normalized.phone,
          phone_e164: normalized.phoneE164,
          website: normalized.website,
          domain: normalized.domain,
          source_url: normalized.sourceUrl,
          provider,
          external_id: record.externalId ?? null,
          connector_id: connector.id,
          job_id: job.id,
          status: "new",
          origin: meta.kind === "demo" ? "demo" : "external",
          dedupe_key: record.externalId
            ? `${provider}:${record.externalId}`
            : `${provider}:${slugify(normalized.name)}`,
          normalized: normalized as never,
          score: score.score,
          score_components: score.components as never,
          signals: score.signals as never,
          evidence: [
            {
              source: provider,
              label: meta.label,
              external_id: record.externalId ?? null,
              observed_at: fetchedAt,
            },
          ] as never,
          payload: {
            provider,
            external_id: record.externalId ?? null,
            source_url: record.sourceUrl ?? null,
            mode: status.mode,
          } as never,
          observed_at: fetchedAt,
          first_seen_at: nowIso,
        })
        .select("id")
        .single();
      if (insertError) {
        failedCount += 1;
        warnings.push(`Record ${record.externalId ?? normalized.name}: candidate insert failed.`);
        continue;
      }
      createdCount += 1;
      const candidateId = inserted.id;
      if (sourceRecordId) {
        await supabase
          .from("source_records")
          .update({ candidate_id: candidateId, updated_at: nowIso })
          .eq("tenant_id", tenantId)
          .eq("id", sourceRecordId);
      }
      for (const field of normalizedFields(normalized)) {
        if (field.value == null) continue;
        await recordObservation(supabase, tenantId, {
          candidateId,
          sourceRecordId,
          provider,
          fieldPath: `candidate.${field.path}`,
          observedValue: field.value,
          currentValue: field.value,
          confidence: 0.7,
          sourceUrl: record.sourceUrl ?? null,
          observedAt: fetchedAt,
        });
      }
      // Signal the matching context so later records in the same run see it.
      lookup.push({
        id: candidateId,
        name: normalized.name,
        provider,
        external_id: record.externalId ?? null,
        dedupe_key: record.externalId ? `${provider}:${record.externalId}` : null,
        domain: normalized.domain,
        phone_e164: normalized.phoneE164,
        address_line1: normalized.addressLine1,
        city: normalized.city,
        region: normalized.region,
        score: score.score,
        duplicate_of: null,
        status: "new",
        merchant_id: null,
        refresh_count: 0,
        normalized,
      });
    }
  }

  // 3) Website probing — lightweight, non-fatal, wired into the run.
  await probeCandidateWebsites(
    supabase,
    tenantId,
    job.id,
    records.filter((r) => r.website),
    warnings,
  );

  const outcome: RunOutcome = failedCount > 0 || warnings.length > 0 ? "partially" : "succeeded";
  const finishedAt = new Date().toISOString();

  await Promise.all([
    supabase
      .from("discovery_jobs")
      .update({
        status: "succeeded",
        mode: status.mode,
        received_count: receivedCount,
        created_count: createdCount,
        updated_count: updatedCount,
        deduped_count: dedupedCount,
        failed_count: failedCount,
        warnings: warnings as never,
        finished_at: finishedAt,
        error: null,
      })
      .eq("tenant_id", tenantId)
      .eq("id", job.id),
    supabase
      .from("source_connectors")
      .update({
        status: "configured",
        last_run_at: finishedAt,
        last_success_at: finishedAt,
        last_error: null,
        records_received: (connector.records_received ?? 0) + receivedCount,
        records_ingested: (connector.records_ingested ?? 0) + createdCount + updatedCount,
      })
      .eq("tenant_id", tenantId)
      .eq("id", connector.id),
    supabase.from("events").insert({
      tenant_id: tenantId,
      actor_id: actorId,
      kind: "discovery.run_completed",
      subject_type: "discovery_job",
      subject_id: job.id,
      payload: {
        provider,
        received: receivedCount,
        created: createdCount,
        updated: updatedCount,
        deduped: dedupedCount,
        failed: failedCount,
      },
    }),
  ]);

  return {
    jobId: job.id,
    provider,
    label: meta.label,
    status: outcome,
    mode: status.mode,
    query,
    vertical: input.vertical?.trim() || null,
    city: input.city?.trim() || null,
    region: input.region?.trim() || null,
    foundCount: records.length,
    receivedCount,
    createdCount,
    updatedCount,
    dedupedCount,
    failedCount,
    warnings,
    startedAt: nowIso,
    finishedAt,
  };
}

async function probeCandidateWebsites(
  supabase: Db,
  tenantId: string,
  jobId: string,
  records: SourceBusinessRecord[],
  warnings: string[],
) {
  const probeAdapter = websiteProbeAdapter();
  const candidates = await supabase
    .from("discovery_candidates")
    .select("id, name, website, provider")
    .eq("tenant_id", tenantId)
    .eq("job_id", jobId)
    .not("website", "is", null)
    .limit(12);
  if (candidates.error) throw candidates.error;

  const toProbe = (candidates.data ?? []).slice(0, 8);
  if (toProbe.length === 0) return;

  let probeConnectorId: string | null = null;
  const existing = await supabase
    .from("source_connectors")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("provider", "website-probe")
    .maybeSingle();
  if (existing.data) {
    probeConnectorId = existing.data.id;
  } else {
    const { data, error } = await supabase
      .from("source_connectors")
      .insert({
        tenant_id: tenantId,
        provider: "website-probe",
        name: "Website presence probe",
        category: "discovery",
        status: "configured",
        config: { builtin: true } as never,
      })
      .select("id")
      .single();
    if (error) throw error;
    probeConnectorId = data.id;
  }

  for (const candidate of toProbe) {
    const url = candidate.website!;
    let probe: WebsiteProbeResult;
    try {
      probe = await probeAdapter.probeSite(url);
    } catch (err) {
      warnings.push(
        `Probe failed for ${candidate.name}: ${err instanceof Error ? err.message : "unknown error"}`,
      );
      continue;
    }

    const probeHash = contentHash(JSON.stringify({ ...probe, url }));
    const hasExisting = await supabase
      .from("source_records")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("connector_id", probeConnectorId!)
      .eq("external_id", `probe:${candidate.id}`)
      .maybeSingle();
    if (hasExisting.data) continue;

    const { data: probeRecord, error: probeInsertError } = await supabase
      .from("source_records")
      .insert({
        tenant_id: tenantId,
        connector_id: probeConnectorId!,
        candidate_id: candidate.id,
        external_id: `probe:${candidate.id}`,
        provider: "website-probe",
        kind: "website_probe",
        payload: probe as never,
        fetched_at: new Date().toISOString(),
        source_url: url,
        content_hash: probeHash,
      })
      .select("id")
      .single();
    if (probeInsertError) {
      warnings.push(`Probe result could not be stored for ${candidate.name}.`);
      continue;
    }

    const observedValue = probe.reachable
      ? `reachable (${probe.statusCode ?? "ok"})`
      : `unreachable: ${probe.error ?? "no response"}`;
    await recordObservation(supabase, tenantId, {
      candidateId: candidate.id,
      sourceRecordId: probeRecord.id,
      provider: "website-probe",
      fieldPath: "website.probe",
      observedValue: observedValue.length > 400 ? observedValue.slice(0, 400) : observedValue,
      currentValue: null,
      confidence: 1,
      sourceUrl: url,
    });
  }
}

export type CandidateRefreshInput = { candidateId: string };

export type CandidateRefreshResult = {
  candidateId: string;
  found: boolean;
  refreshed: boolean;
  externalId: string | null;
  provider: string;
  changedFields: Array<{ field: string; previous: string | null; observed: string | null }>;
  score: number | null;
  message: string;
};

export async function refreshCandidatePipeline(
  supabase: Db,
  tenantId: string,
  actorId: string,
  candidateId: string,
): Promise<CandidateRefreshResult> {
  const { data: candidate, error: fetchError } = await supabase
    .from("discovery_candidates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", candidateId)
    .single();
  if (fetchError) throw fetchError;

  const provider = candidate.provider;
  const meta = discoverySourceMeta(provider);
  if (!meta) throw new Error(`Candidate source no longer recognised: ${provider}`);
  const adapter = discoveryAdapter(provider);
  const status = adapter.status();
  if (!status.configured) {
    throw new Error(`Cannot refresh — ${meta.label} is not configured.`);
  }

  const nowIso = new Date().toISOString();
  const connector = await getOrCreateConnector(
    supabase,
    tenantId,
    provider,
    meta.label,
    "discovery",
    true,
  );

  let records: SourceBusinessRecord[] = [];
  try {
    records = await adapter.search({
      query: candidate.name,
      ...(candidate.city ? { city: candidate.city } : {}),
      limit: 5,
    });
  } catch (err) {
    await supabase
      .from("source_connectors")
      .update({
        last_failure_at: nowIso,
        last_error: err instanceof Error ? err.message : "Refresh failed",
      })
      .eq("tenant_id", tenantId)
      .eq("id", connector.id);
    throw err;
  }

  const canonicalId = candidate.external_id;
  const matched = records.find(
    (record) =>
      (record.externalId && canonicalId && record.externalId === canonicalId) ||
      normalizeName(record.name) === normalizeName(candidate.name),
  );

  if (!matched) {
    await recordObservation(supabase, tenantId, {
      candidateId,
      sourceRecordId: null,
      provider,
      fieldPath: "source.presence",
      observedValue: "no longer returned by source",
      currentValue: "present",
      confidence: 0.9,
      observedAt: nowIso,
    });
    await supabase
      .from("discovery_candidates")
      .update({ last_refreshed_at: nowIso, updated_at: nowIso })
      .eq("tenant_id", tenantId)
      .eq("id", candidateId);
    return {
      candidateId,
      found: false,
      refreshed: false,
      externalId: candidate.external_id,
      provider,
      changedFields: [],
      score: candidate.score,
      message: "Source no longer returns this record — logged an observation.",
    };
  }

  const normalized = normalizeRecord(matched);
  const current = normalizeRecord({
    ...matched,
    name: candidate.name,
    raw: {},
    externalId: candidate.external_id ?? matched.externalId,
  });

  const previousByName = normalizedFields(current);
  const incoming = normalizedFields(normalized);
  const changedFields = previousByName
    .map((field, index) => ({
      field: field.path,
      previous: field.value,
      observed: incoming[index]?.value ?? null,
    }))
    .filter((change) => String(change.previous ?? "") !== String(change.observed ?? ""));

  const hash = contentHash(canonicalContent(normalized));
  const previousRecord = await supabase
    .from("source_records")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("connector_id", connector.id)
    .eq("external_id", matched.externalId ?? "missing")
    .maybeSingle();

  let sourceRecordId: string | null = null;
  if (previousRecord.data) {
    sourceRecordId = previousRecord.data.id;
    const { error } = await supabase
      .from("source_records")
      .update({
        payload: matched.raw as never,
        fetched_at: nowIso,
        source_url: matched.sourceUrl ?? null,
        content_hash: hash,
        candidate_id: candidateId,
      })
      .eq("tenant_id", tenantId)
      .eq("id", sourceRecordId);
    if (error) throw error;
  } else if (matched.externalId) {
    const { data, error } = await supabase
      .from("source_records")
      .insert({
        tenant_id: tenantId,
        connector_id: connector.id,
        candidate_id: candidateId,
        external_id: matched.externalId,
        provider,
        payload: matched.raw as never,
        fetched_at: nowIso,
        source_url: matched.sourceUrl ?? null,
        content_hash: hash,
        kind: "discovery",
      })
      .select("id")
      .single();
    if (error) throw error;
    sourceRecordId = data.id;
  }

  const score = computeScore(normalized, {
    provider,
    retrievedAt: nowIso,
    verticalHintMatched: false,
  });

  for (const change of changedFields) {
    await recordObservation(supabase, tenantId, {
      candidateId,
      sourceRecordId,
      provider,
      fieldPath: `candidate.${change.field}`,
      observedValue: change.observed,
      currentValue: change.previous,
      confidence: 0.8,
      sourceUrl: matched.sourceUrl ?? null,
      observedAt: nowIso,
    });
  }

  await supabase
    .from("discovery_candidates")
    .update({
      name: normalized.name,
      vertical: normalized.vertical as never,
      category_label: normalized.categoryLabel,
      address_line1: normalized.addressLine1,
      city: normalized.city,
      region: normalized.region,
      postal_code: normalized.postalCode,
      country: normalized.country,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      phone: normalized.phone,
      phone_e164: normalized.phoneE164,
      website: normalized.website,
      domain: normalized.domain,
      source_url: normalized.sourceUrl,
      normalized: normalized as never,
      score: score.score,
      score_components: score.components as never,
      signals: score.signals as never,
      last_refreshed_at: nowIso,
      refresh_count: (candidate.refresh_count ?? 0) + 1,
      updated_at: nowIso,
    })
    .eq("tenant_id", tenantId)
    .eq("id", candidateId);

  await supabase.from("events").insert({
    tenant_id: tenantId,
    actor_id: actorId,
    kind: "candidate.refreshed",
    subject_type: "candidate",
    subject_id: candidateId,
    payload: { changed: changedFields.length, provider },
  });

  return {
    candidateId,
    found: true,
    refreshed: true,
    externalId: candidate.external_id,
    provider,
    changedFields,
    score: score.score,
    message:
      changedFields.length === 0
        ? "Source record is unchanged."
        : `Detected ${changedFields.length} changed field(s); logged as pending observations.`,
  };
}
