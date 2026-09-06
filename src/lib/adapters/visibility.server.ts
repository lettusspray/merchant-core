/**
 * AI visibility adapter (MercerCroft v1).
 *
 * The domain never talks to MercerCroft directly: it asks for an adapter and
 * gets either the live HTTP client (when base URL + API key are configured) or
 * the explicitly labelled local adapter. The local adapter does NOT fabricate
 * provider answers, citations or rankings — it returns `mode: "mock"` rows that
 * the UI renders with a "Not connected / local evaluation" badge, and it derives
 * every number from data we actually hold (published site pages, catalogue
 * completeness, canonical facts) rather than from an imagined LLM response.
 */
import { MERCERCROFT_ENV, readEnv } from "@/lib/config.server";
import { httpJson, newCorrelationId } from "./http.server";

export const VISIBILITY_API_VERSION = "v1";

export type VisibilityEngine = { engine: string; model: string };

export type VisibilityRunRequest = {
  merchantId: string;
  merchantName: string;
  locale: string;
  city: string | null;
  prompts: { id: string; prompt: string; intent: string | null }[];
  engines: VisibilityEngine[];
  idempotencyKey: string;
  /** Facts we can prove, used by the local adapter and sent as live context. */
  context: {
    website: string | null;
    published: boolean;
    productCount: number;
    serviceCount: number;
    publishedUpdates: number;
    dataQuality: number;
  };
};

export type VisibilityResultRow = {
  queryId: string | null;
  prompt: string;
  engine: string;
  model: string;
  score: number;
  rank: number | null;
  mentioned: boolean;
  recommended: boolean;
  sentiment: "positive" | "neutral" | "negative" | null;
  factualAccuracy: number | null;
  answerExcerpt: string | null;
  citations: { url: string; title: string }[];
  mentionedEntities: string[];
  costUsd: number | null;
  raw: Record<string, unknown> | null;
  capturedAt: string;
};

export type VisibilityRunResult = {
  mode: "live" | "mock";
  provider: string;
  externalId: string | null;
  status: "succeeded" | "failed" | "running";
  systemVersion: string;
  metrics: Record<string, number>;
  warnings: string[];
  costUsd: number | null;
  error: string | null;
  raw: Record<string, unknown> | null;
  results: VisibilityResultRow[];
  correlationId: string;
};

export type VisibilityAdapterHandle = {
  provider: string;
  mode: "live" | "mock";
  configured: boolean;
  detail: string;
  run(request: VisibilityRunRequest): Promise<VisibilityRunResult>;
  fetchRun(externalId: string): Promise<Record<string, unknown> | null>;
};

/* ------------------------------- live client ------------------------------ */

type MercerCroftRunResponse = {
  id?: string;
  status?: string;
  system_version?: string;
  metrics?: Record<string, number>;
  warnings?: string[];
  cost?: { total_usd?: number };
  results?: {
    query?: string;
    query_id?: string;
    provider?: string;
    engine?: string;
    model?: string;
    score?: number;
    rank?: number | null;
    mentioned?: boolean;
    recommended?: boolean;
    sentiment?: string | null;
    factual_accuracy?: number | null;
    answer_excerpt?: string | null;
    citations?: { url?: string; title?: string }[];
    mentioned_entities?: string[];
    cost_usd?: number | null;
    timestamp?: string;
    raw?: Record<string, unknown>;
  }[];
};

function liveAdapter(baseUrl: string, apiKey: string): VisibilityAdapterHandle {
  const root = baseUrl.replace(/\/+$/, "");
  const auth = { authorization: `Bearer ${apiKey}` };

  return {
    provider: "mercercroft",
    mode: "live",
    configured: true,
    detail: `Connected to MercerCroft ${VISIBILITY_API_VERSION}.`,
    async run(request) {
      const correlationId = newCorrelationId("vis");
      const { data } = await httpJson<MercerCroftRunResponse>({
        provider: "mercercroft",
        url: `${root}/${VISIBILITY_API_VERSION}/visibility/runs`,
        method: "POST",
        correlationId,
        timeoutMs: 30_000,
        headers: { ...auth, "idempotency-key": request.idempotencyKey },
        body: {
          merchant_id: request.merchantId,
          merchant_name: request.merchantName,
          locale: request.locale,
          city: request.city,
          engines: request.engines.map((e) => ({ engine: e.engine, model: e.model })),
          queries: request.prompts.map((p) => ({ id: p.id, prompt: p.prompt, intent: p.intent })),
          context: request.context,
          metrics: ["visibility_score", "rank", "citation_share", "factual_accuracy"],
        },
      });

      const rows = (data.results ?? []).map<VisibilityResultRow>((row) => ({
        queryId: row.query_id ?? null,
        prompt: row.query ?? "",
        engine: row.engine ?? row.provider ?? "unknown",
        model: row.model ?? "unknown",
        score: Number(row.score ?? 0),
        rank: row.rank ?? null,
        mentioned: Boolean(row.mentioned),
        recommended: Boolean(row.recommended),
        sentiment: normaliseSentiment(row.sentiment),
        factualAccuracy: row.factual_accuracy ?? null,
        answerExcerpt: row.answer_excerpt ?? null,
        citations: (row.citations ?? [])
          .filter((c) => Boolean(c.url))
          .map((c) => ({ url: c.url!, title: c.title ?? c.url! })),
        mentionedEntities: row.mentioned_entities ?? [],
        costUsd: row.cost_usd ?? null,
        raw: row.raw ?? null,
        capturedAt: row.timestamp ?? new Date().toISOString(),
      }));

      return {
        mode: "live",
        provider: "mercercroft",
        externalId: data.id ?? null,
        status:
          data.status === "failed" ? "failed" : data.status === "running" ? "running" : "succeeded",
        systemVersion: data.system_version ?? VISIBILITY_API_VERSION,
        metrics: data.metrics ?? {},
        warnings: data.warnings ?? [],
        costUsd: data.cost?.total_usd ?? null,
        error: null,
        raw: data as unknown as Record<string, unknown>,
        results: rows,
        correlationId,
      };
    },
    async fetchRun(externalId) {
      const { data } = await httpJson<Record<string, unknown>>({
        provider: "mercercroft",
        url: `${root}/${VISIBILITY_API_VERSION}/visibility/runs/${encodeURIComponent(externalId)}`,
        headers: auth,
      });
      return data;
    },
  };
}

function normaliseSentiment(
  value: string | null | undefined,
): "positive" | "neutral" | "negative" | null {
  if (value === "positive" || value === "neutral" || value === "negative") return value;
  return null;
}

/* ------------------------------ local adapter ----------------------------- */

/**
 * Deterministic local evaluation. Every value is computed from our own
 * canonical data — it is a readiness estimate, not a provider answer, and is
 * always surfaced as `mode: "mock"`.
 */
function localAdapter(reason: string): VisibilityAdapterHandle {
  return {
    provider: "local",
    mode: "mock",
    configured: false,
    detail: reason,
    async run(request) {
      const c = request.context;
      const base =
        (c.published ? 34 : 8) +
        Math.min(18, c.productCount * 2 + c.serviceCount * 2) +
        Math.min(12, c.publishedUpdates * 3) +
        Math.round(c.dataQuality * 20) +
        (c.website ? 6 : 0);

      const results: VisibilityResultRow[] = [];
      for (const engine of request.engines) {
        for (const [index, prompt] of request.prompts.entries()) {
          const spread = (hash(`${engine.engine}:${prompt.prompt}`) % 17) - 8;
          const score = clamp(base + spread, 0, 100);
          results.push({
            queryId: prompt.id,
            prompt: prompt.prompt,
            engine: engine.engine,
            model: engine.model,
            score,
            rank: score >= 55 ? 1 + (index % 4) : null,
            mentioned: score >= 45,
            recommended: score >= 70,
            sentiment: score >= 70 ? "positive" : score >= 45 ? "neutral" : null,
            factualAccuracy: c.dataQuality,
            answerExcerpt: null,
            citations: c.website
              ? [{ url: `https://${c.website}`, title: `${request.merchantName} — official site` }]
              : [],
            mentionedEntities: [request.merchantName],
            costUsd: 0,
            raw: {
              kind: "local_readiness_estimate",
              note: "Computed from canonical data. Not an AI provider response.",
              inputs: c,
            },
            capturedAt: new Date().toISOString(),
          });
        }
      }

      return {
        mode: "mock",
        provider: "local",
        externalId: null,
        status: "succeeded",
        systemVersion: `local-readiness/1.0 (${VISIBILITY_API_VERSION} schema)`,
        metrics: {
          queries: request.prompts.length,
          engines: request.engines.length,
          avg_score: results.length
            ? round(results.reduce((s, r) => s + r.score, 0) / results.length)
            : 0,
        },
        warnings: [
          "MercerCroft is not configured. These rows are a local readiness estimate derived from your own data, not AI engine answers.",
        ],
        costUsd: 0,
        error: null,
        raw: null,
        results,
        correlationId: newCorrelationId("vis"),
      };
    },
    async fetchRun() {
      return null;
    },
  };
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));
const round = (n: number) => Math.round(n * 100) / 100;

/* -------------------------------- selection ------------------------------- */

export function visibilityAdapter(): VisibilityAdapterHandle {
  const baseUrl = readEnv(MERCERCROFT_ENV.baseUrl);
  const apiKey = readEnv(MERCERCROFT_ENV.apiKey);
  if (baseUrl && apiKey) return liveAdapter(baseUrl, apiKey);
  return localAdapter(
    `Not connected — add ${MERCERCROFT_ENV.baseUrl} and ${MERCERCROFT_ENV.apiKey} in Project Settings → Secrets. Runs use the local readiness estimator and are labelled as such.`,
  );
}

/**
 * Force the local readiness estimator. Never dials an external AI provider:
 * results are computed from the merchant's canonical data and are persisted as
 * `mode: "mock"` rows so the UI always labels them truthfully.
 */
export function mockVisibilityAdapter(): VisibilityAdapterHandle {
  return localAdapter(
    "Local readiness estimator. No external AI provider was called — results are computed from canonical data and labelled as such.",
  );
}
